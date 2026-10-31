// Real ranking view with fictional rows: points breakdown and locating the viewer; never contacts production.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React,{act} from 'react';
import {create} from 'react-test-renderer';

mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['app/ranking-view.tsx'],outfile:'.test-output/ranking-breakdown-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'ranking-shells',setup(builder){
 builder.onResolve({filter:/^\.\//},a=>a.importer.replaceAll('\\','/').endsWith('/app/ranking-view.tsx')&&!a.path.endsWith('.css')?{path:a.path,namespace:'ui'}:undefined);
 builder.onLoad({filter:/.*/,namespace:'ui'},({path})=>({loader:'js',contents:path==='./disclosure'?`export default function Disclosure({children}){return children}`:path==='./avatar'?`export const Avatar=()=>null;`:path==='./realm-badge'?`export default function Badge(){return null}export const PlacementBadge=()=>null;`:path==='./month-picker'?`export const QuarterPicker=()=>null,YearPicker=()=>null;`:`export default function Shell(){return null}`}));
}}]});
const Ranking=(await import(pathToFileURL(resolve('.test-output/ranking-breakdown-ui.mjs')).href)).default;
const prior=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const priorWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),motions=[];let reducedMotion=false;
Object.defineProperty(globalThis,'window',{configurable:true,value:{matchMedia:query=>{assert.equal(query,'(prefers-reduced-motion: reduce)');return {matches:reducedMotion}}}});
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.children?.map(text).join('')??'';
try{
 const row=(playerId,name,rank,fields)=>({playerId,name,rank,realm:'炼气',realmScore:{score:1000,stage:'初期',progressPercent:0},provisional:false,total:fields.wins+fields.losses,totalMatches:fields.wins+fields.losses,games:fields.wins+fields.losses,rate:fields.wins/(fields.wins+fields.losses||1),margin:0,upsetPoints:0,streakPoints:0,notificationPoints:0,attendancePoints:0,mvpPoints:0,bountyPoints:0,manualPoints:0,pendingPoints:0,pendingGames:0,...fields});
 const rows=[row('ann','Fictional Ann',1,{wins:15,losses:6,upsetPoints:3,streakPoints:4,mvpPoints:5,attendancePoints:-1,manualPoints:-8,pendingGames:2,pendingPoints:5,points:42}),row('ben','Fictional Ben',2,{wins:0,losses:0,points:0})];
 const data={rankingQuarter:'2026-Q4',quarterlyLeaderboard:rows,seasons:[],settings:{rules:{}},players:rows.map(r=>({id:r.playerId,name:r.name})),me:{playerId:'ben'}};
 const profiles=[];
 const baseProps={data,period:'2026-10',setPeriod(){},year:2026,onProfile:id=>profiles.push(id)};
 await act(async()=>{ui=create(React.createElement(Ranking,baseProps),{createNodeMock:element=>element.props.id==='rv-my-ranking-row'?{focus:options=>motions.push(['focus',element.props.id,options]),scrollIntoView:options=>motions.push(['scroll',element.props.id,options])}:null})});
 const toggle=name=>ui.root.findAllByType('button').find(b=>b.props['aria-label']===name+'的积分明细');
 assert.equal(toggle('Fictional Ann').props['aria-expanded'],false,'collapsed at first');
 assert.equal(ui.root.findAll(n=>n.props.className==='rv-breakdown').length,0);
 await act(async()=>toggle('Fictional Ann').props.onClick());
 assert.equal(toggle('Fictional Ann').props['aria-expanded'],true);
 const panel=ui.root.findByProps({className:'rv-breakdown'});
 assert.equal(panel.props.id,toggle('Fictional Ann').props['aria-controls'],'the toggle controls its panel');
 const lines=panel.findAllByType('dt').map((dt,i)=>[text(dt),text(panel.findAllByType('dd')[i])]);
 assert.deepEqual(lines,[['胜局 15 × 3','+45'],['负局 6 × 1','-6'],['强弱加成','+3'],['连胜加分','+4'],['MVP 加分','+5'],['迟到扣分','-1'],['群主调整','-8']],'non-zero sources only, signed');
 assert.equal(lines.reduce((n,[,v])=>n+Number(v),0),42);
 assert.match(text(panel.findByProps({className:'rv-breakdown-total'})),/^合计42 分$/);
 assert.match(text(panel),/含进行中 2 局（\+5），活动结束后确认。/);
 await act(async()=>toggle('Fictional Ben').props.onClick());
 assert.equal(toggle('Fictional Ann').props['aria-expanded'],false,'one breakdown open at a time');
 const ben=ui.root.findByProps({className:'rv-breakdown'});
 assert.equal(ben.findAllByType('dl').length,0,'no sources: no empty list');assert.match(text(ben),/合计0 分/);
 await act(async()=>toggle('Fictional Ben').props.onClick());
 assert.equal(ui.root.findAll(n=>n.props.className==='rv-breakdown').length,0,'tapping again closes it');
 await act(async()=>ui.root.findAllByType('button').find(b=>b.props.className==='rv-name-link'&&text(b)==='Fictional Ann').props.onClick());
 assert.deepEqual(profiles,['ann'],'the name still opens the profile');
 assert.ok(readFileSync('app/ranking-view.css','utf8').includes('.rv-breakdown{grid-column:1/-1;min-width:0'),'the panel spans the whole row and cannot widen it');
 console.log('PASS ranking breakdown: collapsed by default, accessible toggle per row, non-zero signed sources adding up to the total, in-progress note, one open at a time, profile links unchanged');

 const summary=()=>ui.root.findByProps({className:'rv-my-ranking'});
 const summaryText=()=>text(summary()).replace(/\s+/g,'');
 const locate=()=>ui.root.findAllByType('button').find(button=>button.props.className==='rv-locate-me');
 const update=async props=>{await act(async()=>ui.update(React.createElement(Ranking,{...baseProps,...props})))};
 const assertRank=(rank,points,count)=>{
  assert.equal(summary().props['aria-label'],'我的排名');
  const status=summary().findByProps({role:'status'});
  assert.ok(text(status).replace(/\s+/g,'').includes('第'+rank+'名'),'rank changes are announced');
  assert.equal(status.findAllByType('button').length,0,'the locating button stays outside the live announcement');
  assert.match(summaryText(),/我的排名/);
  assert.ok(summaryText().includes('第'+rank+'名'),'uses the current board rank');
  assert.ok(summaryText().includes('/'+count+'位球友'),'uses the current board population');
  assert.ok(summaryText().includes(points+'积分'),'uses the current board points');
  assert.equal(text(locate()),'定位到我');
  const target=ui.root.findByProps({id:locate().props['aria-controls']});
  assert.equal(target.props.id,'rv-my-ranking-row');
  assert.equal(target.props.tabIndex,-1,'the located row can receive programmatic focus');
  assert.equal(target.props.role,'group','the focused row supports an accessible name');
  assert.match(target.props.className,/\bis-me\b/);
  assert.match(text(target),/Fictional Ben/,'locates the signed-in player rather than the first row');
 };
 assertRank(2,0,2);
 assert.match(summaryText(),/2026年第4季度.*双打/);
 const provisionalRows=[rows[0],{...rows[1],provisional:true,realmScore:{...rows[1].realmScore,placement:true}}];
 await update({data:{...data,quarterlyLeaderboard:provisionalRows}});
 assertRank(2,0,2);
 assert.doesNotMatch(summaryText(),/暂未上榜/,'zero points and realm placement do not remove an assigned ranking');

 const deepRows=Array.from({length:30},(_,index)=>row('fictional-'+index,'Fictional Player '+index,index+1,{wins:1,losses:0,points:100-index}));
 deepRows.push(row('ben','Fictional Ben',30,{wins:1,losses:0,points:71}));
 const boardData={...data,rankingYear:2026,quarterlyLeaderboard:deepRows,annualLeaderboard:[{...rows[1],rank:1,points:150},{...rows[0],rank:2,points:90}],singlesQuarterlyLeaderboard:[{...rows[0],points:12},{...rows[1],points:4}],singlesAnnualLeaderboard:[{...rows[1],rank:1,points:20}]};
 await update({data:boardData});
 assertRank(30,71,31);
 assert.doesNotMatch(summaryText(),/第31名/,'ties use the stored rank, not array position');
 await act(async()=>locate().props.onClick());
 assert.deepEqual(motions,[['focus','rv-my-ranking-row',{preventScroll:true}],['scroll','rv-my-ranking-row',{behavior:'smooth',block:'center'}]],'locating focuses and centers the actual self row');
 reducedMotion=true;motions.length=0;
 await act(async()=>locate().props.onClick());
 assert.deepEqual(motions,[['focus','rv-my-ranking-row',{preventScroll:true}],['scroll','rv-my-ranking-row',{behavior:'instant',block:'center'}]],'reduced motion does not animate the jump');

 await update({data:boardData,rankingPeriod:'annual'});
 assertRank(1,150,2);assert.match(summaryText(),/2026年.*双打/);
 await update({data:boardData,rankingFormat:'singles'});
 assertRank(2,4,2);assert.match(summaryText(),/2026年第4季度.*单打/);
 await update({data:boardData,rankingPeriod:'annual',rankingFormat:'singles'});
 assertRank(1,20,1);assert.match(summaryText(),/2026年.*单打/);

 for(const selection of [{period:'2026-04'},{rankingPeriod:'annual',year:2025}]){
  await update({data:boardData,...selection});
  assert.match(summaryText(),/正在读取我的排名…/);
  assert.doesNotMatch(summaryText(),/第\d+名|150积分|71积分|暂未上榜/,'loading does not show a stale rank or imply absence');
  assert.equal(locate(),undefined);
  assert.equal(ui.root.findAllByProps({id:'rv-my-ranking-row'}).length,0);
 }
 await update({period:'2026-04',data:{...boardData,rankingQuarter:'2026-Q2',quarterlyLeaderboard:[{...rows[1],rank:1,points:-1}]}});
 assertRank(1,-1,1);assert.match(summaryText(),/2026年第2季度/);
 for(const singlesRows of [[rows[0]],[]]){
  await update({data:{...boardData,singlesQuarterlyLeaderboard:singlesRows},rankingFormat:'singles'});
  assert.match(summaryText(),/暂未上榜/);
  assert.doesNotMatch(summaryText(),/第\d+名/);
  assert.equal(locate(),undefined,'an absent player has no jump action');
  assert.equal(ui.root.findAllByProps({id:'rv-my-ranking-row'}).length,0);
 }
 await update({data:{...boardData,me:{}}});
 assert.equal(ui.root.findAllByProps({className:'rv-my-ranking'}).length,0,'an account without a linked player has no personal rank');
 assert.equal(locate(),undefined);
 console.log('PASS personal ranking: signed-in identity, zero/provisional/tied ranks, every board selection, loading and absence, focus target, reduced-motion scrolling');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=prior;if(priorWindow)Object.defineProperty(globalThis,'window',priorWindow);else delete globalThis.window}
