import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClubNavigation,clubRouteUrl,homeRoute,normalizeRoute,readClubRoute,type NavigationPort} from '../lib/client/club-navigation';

test('malformed route values and browser history markers cannot become trusted navigation state',()=>{
 assert.deepEqual(normalizeRoute({page:42,eventId:{id:'private'},tab:['fees']}),homeRoute);
 for(const marker of [null,[],{session:'s',owner:'member-A',index:Infinity,route:{}},{session:'s',owner:'member-A',index:-1,route:{}},{session:'s',owner:'member-A',index:0,route:[]}]){
  const b=browser('https://club.example/?page=events',{__yulinNavigation:marker});
  assert.equal(b.navigation.route.page,'events');
  assert.doesNotThrow(()=>b.navigation.pop({__yulinNavigation:marker}));
 }
});

function browser(href='https://club.example/',state:unknown=null){
 const entries=[{href,state}],moves:number[]=[];let index=0,scroll=0;
 const port:NavigationPort={href:()=>entries[index].href,state:()=>entries[index].state,push:(state,url)=>{entries.splice(index+1);entries.push({state,href:new URL(url,entries[index].href).href});index++},replace:(state,url)=>{entries[index]={state,href:new URL(url,entries[index].href).href}},go:delta=>{moves.push(delta)},scrollY:()=>scroll,scrollTo:y=>{scroll=y}};
 const navigation=new ClubNavigation(port,'member-A','session-one');
 const flush=(controller=navigation)=>{const delta=moves.shift();assert.notEqual(delta,undefined);index+=delta!;assert.ok(index>=0&&index<entries.length);controller.pop(port.state())};
 const back=(controller=navigation)=>{port.go(-1);flush(controller)},forward=(controller=navigation)=>{port.go(1);flush(controller)};
 return {navigation,port,entries,moves,flush,back,forward,setScroll:(y:number)=>{scroll=y},get scroll(){return scroll}};
}

test('initial page only replaces the existing entry; repeated navigation does not add duplicates',()=>{
 const b=browser();assert.equal(b.entries.length,1);assert.equal(b.moves.length,0);
 b.navigation.navigate({page:'home'});assert.equal(b.entries.length,1);
 b.navigation.navigate({page:'ranking'});b.navigation.navigate({page:'ranking'});assert.equal(b.entries.length,2);
});
test('browser back and forward restore activities, detail and event tabs without pushing',()=>{
 const b=browser();b.navigation.navigate({page:'events'});b.navigation.navigate({page:'events',eventId:'event-1'});b.navigation.navigate({page:'events',eventId:'event-1',tab:'signup'});
 b.back();assert.equal(b.navigation.route.tab,'overview');b.back();assert.equal(b.navigation.route.eventId,'');b.forward();assert.equal(b.navigation.route.eventId,'event-1');assert.equal(b.entries.length,4);
});
test('player detail return uses the actual list entry and browser forward restores detail',()=>{
 const b=browser();b.navigation.navigate({page:'social'});b.navigation.navigate({page:'social',playerId:'player-1'});b.navigation.navigate({page:'social',playerId:'player-2'});
 b.navigation.backTo({page:'social'});assert.deepEqual(b.moves,[-2]);b.flush();assert.equal(b.navigation.route.playerId,'');b.forward();assert.equal(b.navigation.route.playerId,'player-1');
});
test('direct profile/detail links replace with a list instead of adding a return loop',()=>{
 const b=browser('https://club.example/?page=social&player=player-1');b.navigation.backTo({page:'social'});assert.equal(b.entries.length,1);assert.equal(b.navigation.route.playerId,'');assert.equal(new URL(b.port.href()).searchParams.has('player'),false);
 const e=browser('https://club.example/?event=event-1');e.navigation.backTo({page:'events'});assert.equal(e.entries.length,1);assert.equal(e.navigation.route.page,'events');assert.equal(e.navigation.route.eventId,'');
});
test('legacy event links and every social/event tab round-trip through the URL',()=>{
 assert.equal(readClubRoute('https://club.example/?event=E').page,'events');assert.equal(readClubRoute('https://club.example/?event=E&tab=matches').tab,'rounds');
 for(const route of [{page:'reminders'},{page:'me'},{page:'admin'},{page:'ranking'},{page:'events',eventId:'event /你好',tab:'fees'},{page:'social',socialTab:'network'},{page:'social',socialTab:'challenges'},{page:'social',socialTab:'funny'},{page:'social',playerId:'player ?你好'}]){
  const expected=normalizeRoute(route as any),url=clubRouteUrl('https://club.example/?campaign=friend',expected);assert.deepEqual(readClubRoute(new URL(url,'https://club.example').href),expected);assert.equal(new URL(url,'https://club.example').searchParams.get('campaign'),'friend');
 }
 assert.deepEqual(readClubRoute('https://club.example/?page=bogus&player=P'),homeRoute);
});
test('back closes a dialog first; history contains no form data and forward cannot reopen an old form',()=>{
 const b=browser();let closed=0;b.navigation.navigate({page:'events'});const href=b.port.href();b.navigation.openDialog('opaque-dialog-id',()=>{closed++;b.navigation.dismissDialog('opaque-dialog-id')});
 assert.equal(b.port.href(),href);assert.deepEqual(Object.keys((b.port.state() as any).__yulinNavigation).sort(),['dialog','index','owner','route','session']);
 b.back();assert.equal(closed,1);assert.equal(b.navigation.route.page,'events');assert.equal(b.moves.length,0);b.forward();assert.equal(closed,1);assert.equal((b.port.state() as any).__yulinNavigation.dialog,null);
});
test('closing a dialog followed immediately by navigation waits for the pending pop',()=>{
 const b=browser();b.navigation.navigate({page:'me'});b.navigation.openDialog('dialog',()=>{});b.navigation.dismissDialog('dialog');b.navigation.navigate({page:'ranking'});
 assert.deepEqual(b.moves,[-1]);assert.equal(b.navigation.route.page,'me');b.flush();assert.equal(b.navigation.route.page,'ranking');assert.equal(b.entries.length,3);b.back();assert.equal(b.navigation.route.page,'me');
});
test('branching after back drops stale forward pages',()=>{
 const b=browser();b.navigation.navigate({page:'events'});b.navigation.navigate({page:'ranking'});b.back();b.navigation.navigate({page:'me'});assert.equal(b.entries.length,3);assert.equal(new URL(b.entries[2].href).searchParams.get('page'),'me');
});
test('reload restores same-account URL history; another account cannot restore its old route',()=>{
 const b=browser();b.navigation.navigate({page:'events'});b.navigation.navigate({page:'events',eventId:'event-1'});
 const reloaded=new ClubNavigation(b.port,'member-A','session-two');assert.equal(reloaded.route.eventId,'event-1');
 b.back(reloaded);const old=b.port.state();assert.equal(reloaded.route.page,'events');assert.equal(reloaded.route.eventId,'');
 b.forward(reloaded);assert.equal(reloaded.route.eventId,'event-1');b.back(reloaded);assert.equal(reloaded.route.eventId,'');
 const other=new ClubNavigation(b.port,'member-B','session-three');assert.deepEqual(other.route,homeRoute);other.pop(old);assert.deepEqual(other.route,homeRoute);
});
test('scroll position belongs to each history entry and restores on back',()=>{
 const b=browser();b.setScroll(640);b.navigation.navigate({page:'social'});assert.equal(b.scroll,0);b.setScroll(200);b.navigation.navigate({page:'social',playerId:'player-1'});b.back();assert.equal(b.scroll,200);b.back();assert.equal(b.scroll,640);
});

test('signup profile return restores the exact activity, signup tab and scrolled list; related profiles retain source',()=>{
 const b=browser();b.navigation.navigate({page:'events',eventId:'event-original',tab:'signup'});b.setScroll(680);
 b.navigation.openPlayer('peer-one');assert.equal(b.navigation.route.playerId,'peer-one');assert.equal(b.navigation.profileBackLabel,'返回接龙');
 b.navigation.openPlayer('peer-two');assert.equal(b.navigation.profileSource!.route.eventId,'event-original');assert.equal(b.navigation.profileSource!.scrollY,680);
 b.navigation.returnFromProfile();assert.deepEqual(b.moves,[-2]);b.flush();assert.equal(b.navigation.route.eventId,'event-original');assert.equal(b.navigation.route.tab,'signup');assert.equal(b.scroll,680);
 b.forward();assert.equal(b.navigation.route.playerId,'peer-one');assert.equal(b.navigation.profileBackLabel,'返回接龙');
});

test('annual ranking profile return preserves ranking year, month selection and scroll independently of player identity',()=>{
 const b=browser();b.navigation.navigate({page:'ranking'});b.setScroll(945);
 const selection={period:'2025-08',year:2025,rankingPeriod:'annual' as const};b.navigation.openPlayer('peer',selection);
 assert.equal(b.navigation.profileBackLabel,'返回榜单');assert.deepEqual(b.navigation.rankingSelection,selection);
 b.navigation.returnFromProfile();b.flush();assert.equal(b.navigation.route.page,'ranking');assert.equal(b.scroll,945);assert.deepEqual(b.navigation.rankingSelection,selection);
 assert.equal((b.port.state() as any).__yulinNavigation.owner,'member-A');
});

test('refreshing a profile keeps a safe source; return without memory frames replaces that source and preserves filters',()=>{
 const b=browser();b.navigation.navigate({page:'ranking'});b.setScroll(510);const selection={period:'2024-02',year:2024,rankingPeriod:'quarterly' as const};b.navigation.openPlayer('peer',selection);
 const reloaded=new ClubNavigation(b.port,'member-A','session-two');assert.equal(reloaded.profileBackLabel,'返回榜单');assert.deepEqual(reloaded.rankingSelection,selection);
 reloaded.returnFromProfile();assert.equal(reloaded.route.page,'ranking');assert.equal(b.scroll,510);assert.equal(b.moves.length,0);assert.equal(b.entries.length,3);
 assert.deepEqual(reloaded.rankingSelection,selection);
});

test('my profile returns to My; direct links fall back to player list and foreign account metadata cannot restore source',()=>{
 const b=browser();b.navigation.navigate({page:'me'});b.navigation.openPlayer('mine');assert.equal(b.navigation.profileBackLabel,'返回我的');b.navigation.returnFromProfile();b.flush();assert.equal(b.navigation.route.page,'me');
 const direct=browser('https://club.example/?page=social&player=peer');direct.navigation.openPlayer('another');assert.equal(direct.navigation.profileBackLabel,'返回球友列表');direct.navigation.returnFromProfile();assert.equal(direct.navigation.route.page,'social');assert.equal(direct.navigation.route.playerId,'');
 b.navigation.openPlayer('peer');const other=new ClubNavigation(b.port,'member-B','session-three');assert.deepEqual(other.route,homeRoute);assert.equal(other.profileSource,undefined);assert.equal(other.rankingSelection,undefined);
});

test('source metadata stores only whitelisted route/filter scalars and rejects profile loops or invalid filter snapshots',()=>{
 const source={route:{page:'ranking',password:'must-not-persist'},scrollY:400,ranking:{period:'2024-03',year:2024,rankingPeriod:'annual',token:'must-not-persist'},notes:'must-not-persist'};
 const state={__yulinNavigation:{session:'old',owner:'member-A',index:2,route:normalizeRoute({page:'social',playerId:'peer'}),dialog:null,profileSource:source}};
 const b=browser('https://club.example/?page=social&player=peer',state);assert.equal(b.navigation.profileBackLabel,'返回榜单');assert.ok(!JSON.stringify(b.port.state()).includes('must-not-persist'));
 const loop={...state,__yulinNavigation:{...state.__yulinNavigation,profileSource:{route:{page:'social',playerId:'loop'},scrollY:200}}};const bad=browser('https://club.example/?page=social&player=peer',loop);assert.equal(bad.navigation.profileSource,undefined);assert.equal(bad.navigation.profileBackLabel,'返回球友列表');
});

test('changing ranking filters after returning from a profile persists latest selections on subsequent browser back and reload',()=>{
 const b=browser();b.navigation.navigate({page:'ranking'});b.navigation.openPlayer('peer',{period:'2025-08',year:2025,rankingPeriod:'annual'});
 b.navigation.returnFromProfile();b.flush();let emitted=0;const unsubscribe=b.navigation.subscribe(()=>emitted++);const count=emitted;
 const latest={period:'2024-11',year:2024,rankingPeriod:'annual' as const};b.navigation.updateRankingSelection(latest);
 assert.equal(emitted,count,'Updating a filter must not emit a route restoration that resets React state');assert.equal(b.entries.length,3,'Filters update this ranking entry rather than pushing another route');
 b.navigation.navigate({page:'me'});b.back();assert.equal(b.navigation.route.page,'ranking');assert.deepEqual(b.navigation.rankingSelection,latest);
 const reloaded=new ClubNavigation(b.port,'member-A','session-two');assert.deepEqual(reloaded.rankingSelection,latest);
 reloaded.updateRankingSelection({...latest,rankingPeriod:'quarterly'});assert.equal(reloaded.rankingSelection!.rankingPeriod,'quarterly');
 unsubscribe();
});

test('旧月榜历史记录升级为所属季度，季度筛选返回球友档案后保留',()=>{
 const state={__yulinNavigation:{session:'old',owner:'member-A',index:0,route:normalizeRoute({page:'ranking'}),dialog:null,ranking:{period:'2025-08',year:2025,rankingPeriod:'monthly'}}};
 const b=browser('https://club.example/?page=ranking',state);assert.deepEqual(b.navigation.rankingSelection,{period:'2025-08',year:2025,rankingPeriod:'quarterly'});
 const selection={period:'2024-10',year:2024,rankingPeriod:'quarterly' as const};b.navigation.openPlayer('peer',selection);b.navigation.returnFromProfile();b.flush();assert.deepEqual(b.navigation.rankingSelection,selection);
});
test('保存中的弹窗拒绝手机返回时恢复原历史位置，完成后可正常返回且不重复关闭',()=>{
 const b=browser();let busy=true,closed=0;b.navigation.navigate({page:'events'});
 b.navigation.openDialog('saving',()=>{if(busy)return false;closed++;return true});
 b.back();assert.deepEqual(b.moves,[1]);assert.equal(b.navigation.route.page,'events');b.flush();assert.equal((b.port.state() as any).__yulinNavigation.dialog,'saving');assert.equal(closed,0);
 b.back();b.flush();assert.equal(closed,0);assert.equal(b.entries.length,3);
 busy=false;b.back();assert.equal(closed,1);assert.equal((b.port.state() as any).__yulinNavigation.dialog,null);assert.equal(b.navigation.route.page,'events');
 b.forward();assert.equal(closed,1);assert.equal((b.port.state() as any).__yulinNavigation.dialog,null);
});

 test('reminder center, activity detail and mobile back restore the exact source',()=>{const b=browser();b.navigation.navigate({page:'reminders'});b.setScroll(300);b.navigation.navigate({page:'events',eventId:'event',tab:'fees'});b.back();assert.equal(b.navigation.route.page,'reminders');assert.equal(b.scroll,300);b.forward();assert.equal(b.navigation.route.tab,'fees')});
