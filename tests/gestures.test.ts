import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backDistance,backSwipeBlocked,edgeBackProgress,edgeWidth,neighbourTab,tabSwipeBlocked,tabSwipeStep} from '../lib/client/swipe-gestures';
import {transitionKind} from '../lib/client/page-transition';
import {ClubNavigation,homeRoute,type NavigationPort} from '../lib/client/club-navigation';

test('从屏幕左缘向右滑够距离才算返回，起点不在边缘或滑得太斜都不算',()=>{
 assert.deepEqual(edgeBackProgress(10,30,4),{distance:30,ready:false});
 assert.equal(edgeBackProgress(10,backDistance,10).ready,true);
 assert.equal(edgeBackProgress(10,400,0).distance,110,'the indicator stops following after a point');
 assert.deepEqual(edgeBackProgress(edgeWidth+1,200,0),{distance:0,ready:false},'not from the edge');
 assert.deepEqual(edgeBackProgress(10,-50,0),{distance:0,ready:false},'leftwards');
 assert.deepEqual(edgeBackProgress(10,60,90),{distance:0,ready:false},'a vertical scroll that drifted');
});

test('活动页左右滑动切换到相邻页签，到头不再动，竖向滚动不触发',()=>{
 assert.equal(tabSwipeStep(-80,10),1);assert.equal(tabSwipeStep(80,-10),-1);
 assert.equal(tabSwipeStep(-40,0),0,'too short');assert.equal(tabSwipeStep(-80,60),0,'too steep');
 const tabs=['signup','rounds','fees','social'] as const;
 assert.equal(neighbourTab(tabs,'signup',1),'rounds');assert.equal(neighbourTab(tabs,'fees',-1),'rounds');
 assert.equal(neighbourTab(tabs,'signup',-1),undefined);assert.equal(neighbourTab(tabs,'social',1),undefined);
 assert.equal(neighbourTab(tabs,'rounds',0),undefined);
});

test('输入框、记分台、大屏和横向滚动的区域不响应滑动手势',()=>{
 const inside=(selector:string)=>({parentElement:null,closest:(asked:string)=>asked.split(',').includes(selector)?{}:null});
 for(const selector of ['input','.referee-console','.live-board','[data-no-swipe]']){assert.equal(backSwipeBlocked(inside(selector)),true,selector);assert.equal(tabSwipeBlocked(inside(selector),()=>false),true,selector)}
 assert.equal(backSwipeBlocked(inside('[role="dialog"]')),false,'the back swipe closes a dialog');
 assert.equal(tabSwipeBlocked(inside('[role="dialog"]'),()=>false),true,'a tab swipe leaves dialogs alone');
 const plain={parentElement:null,closest:()=>null},table={parentElement:plain,closest:()=>null};
 assert.equal(tabSwipeBlocked(table,()=>false),false);assert.equal(tabSwipeBlocked(table,el=>el===plain),true,'inside something that scrolls sideways');
 assert.equal(backSwipeBlocked(null),false);
});

test('页面切换方向：前进、返回，以及活动页签按先后顺序',()=>{
 const event={...homeRoute,page:'events' as const,eventId:'e',tab:'signup' as const};
 assert.equal(transitionKind(homeRoute,event,'forward'),'forward');assert.equal(transitionKind(event,homeRoute,'back'),'back');
 assert.equal(transitionKind(event,{...event,tab:'fees'},'forward'),'tab-forward');
 assert.equal(transitionKind({...event,tab:'fees'},{...event,tab:'rounds'},'forward'),'tab-back');
 assert.equal(transitionKind({...event,tab:'fees'},event,'back'),'tab-back','Back across tabs follows the tab order');
 assert.equal(transitionKind(event,{...event},'forward'),'','nothing changed');
});

test('导航记录最近一次是前进还是返回，以及应用内还能不能返回',()=>{
 const entries:{state:unknown;href:string}[]=[{state:null,href:'https://club.example/'}];let index=0;
 const port:NavigationPort={href:()=>entries[index].href,state:()=>entries[index].state,push:(state,url)=>{entries.splice(index+1);entries.push({state,href:new URL(url,entries[index].href).href});index++},replace:(state,url)=>{entries[index]={state,href:new URL(url,entries[index].href).href}},go:delta=>{index+=delta;navigation.pop(entries[index].state)},scrollY:()=>0,scrollTo:()=>{}};
 const navigation=new ClubNavigation(port,'member','session');
 assert.equal(navigation.canGoBack,false);
 navigation.navigate({page:'events'});assert.equal(navigation.direction,'forward');assert.equal(navigation.canGoBack,true);
 navigation.navigate({page:'events',eventId:'e'});
 navigation.backTo({page:'events'});assert.equal(navigation.direction,'back');assert.equal(navigation.route.eventId,'');
 port.go(1);assert.equal(navigation.direction,'forward','browser Forward');
 port.go(-2);assert.equal(navigation.direction,'back');assert.equal(navigation.canGoBack,false);
});
