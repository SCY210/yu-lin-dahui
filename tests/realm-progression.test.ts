import {projectClubState} from '../lib/club-view';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eloChange,enableEloRealms,expectedScore,gameChanges,kFactor,realmByScore,realmPolicy,realmProgress,realmSnapshot,realms,replayRealmScores,roundDelta,settleRealmIndex,visibleRealm} from '../lib/domain/realm-rating';
import {annualLeaderboard,leaderboard,quarterlyLeaderboard,replayRating,settledRatings} from '../lib/domain/ranking';
import {playerStats,personality} from '../lib/domain/social';
import {emptyState,type Match,type Event,type State} from '../lib/domain/types';
import {clubViewValidUntil} from '../lib/club-read-cache';
import {doublesExample,exchangeRow,getFeatureGuide} from '../lib/feature-guides';
const start=Date.parse('2026-10-04T13:00:00Z'),now=start+20*86400000;
function fixture(ids=['A','B','C','D']){const s=emptyState();for(const id of ids)s.players.push({id,name:id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'测试'});s.accounts=s.players.map(p=>({id:p.ownerId,email:'',role:'member',playerId:p.id}));return s}
function match(id:string,at=start,win=true,a=['A','B'],b=['C','D']):Match{return {id,eventId:'event',roundId:'round',courtId:'court',a,b,status:'complete',start:at,end:at+60000,scoreA:win?21:19,scoreB:win?19:21,monthly:true,elo:true,locked:false,enteredBy:'admin',games:[{a:win?21:19,b:win?19:21}]}}
const rated=(score:number,games:number=realmPolicy.provisionalGames)=>({score,games});
const deltas=(c:ReturnType<typeof gameChanges>)=>({a:c.a.map(x=>x.delta),b:c.b.map(x=>x.delta)});
const score=(s:State,id:string,at=now)=>realmSnapshot(s,at).get(id)!;

test('双打按队伍平均计算：两队平均分决定预期，同队两人加减相同，示例 1200+900 对 1050+1050',()=>{
 assert.equal(realmPolicy.doubles,'team');
 const a=[rated(1200),rated(900)],b=[rated(1050),rated(1050)];
 assert.deepEqual(deltas(gameChanges(a,b,'a')),{a:[8,8],b:[-8,-8]});
 assert.deepEqual(deltas(gameChanges(a,b,'b')),{a:[-8,-8],b:[8,8]});
 assert.equal(gameChanges(a,b,'a').a[0].opponent,1050);assert.ok(gameChanges(a,b,'a').a.every(x=>x.expected===.5));
 // Every score enters through the averages: a stronger partner raises the team's expectation for both.
 assert.deepEqual(deltas(gameChanges([rated(1300),rated(900)],b,'a')),{a:[7,7],b:[-7,-7]});
 assert.deepEqual(deltas(gameChanges([rated(1300),rated(900)],b,'b')),{a:[-9,-9],b:[9,9]});
 // Each partner keeps their own K: a provisional partner moves twice as much.
 assert.deepEqual(deltas(gameChanges([rated(1000,3),rated(1000)],[rated(1000),rated(1000)],'a')),{a:[16,8],b:[-8,-8]});
 assert.ok(doublesExample().includes('A 队赢，A 队两人各 +8，B 队两人各 −8；A 队输，A 队两人各 −8，B 队两人各 +8'));
 assert.equal(getFeatureGuide('rating').example?.title,'双打队伍平均示例');
 // The individual comparison mode is kept in code and still gives its own numbers.
 assert.deepEqual(deltas(gameChanges(a,b,'a','individual')),{a:[5,11],b:[-8,-8]});
 assert.deepEqual(deltas(gameChanges(a,b,'b','individual')),{a:[-11,-5],b:[8,8]});
});

test('单打为标准一对一 Elo，换算表与说明一致',()=>{
 assert.equal(expectedScore(1000,1000),.5);assert.ok(Math.abs(expectedScore(1100,1000)-.64)<.001);
 assert.equal(eloChange(1000,1000,1,20),8);assert.equal(eloChange(1000,1000,0,20),-8);
 assert.equal(eloChange(1100,1000,1,20),6);assert.equal(eloChange(1000,1100,1,20),10);assert.equal(eloChange(1100,1000,0,20),-10);
 assert.deepEqual(deltas(gameChanges([rated(1100)],[rated(1000)],'b')),{a:[-10],b:[10]});
 assert.deepEqual(exchangeRow(0),['0','各 +8 / −8','各 +8 / −8']);assert.deepEqual(exchangeRow(100),['100','强方 +6，弱方 −6','弱方 +10，强方 −10']);
 assert.equal(roundDelta(-4.5),-5);assert.equal(roundDelta(4.5),5);
 const guide=getFeatureGuide('rating');assert.deepEqual(guide.table?.rows,realms.map(r=>[r.name,r.range]));assert.equal(guide.tables?.[0].rows[2][1],'强方 +6，弱方 −6');
 assert.ok(!JSON.stringify([guide,getFeatureGuide('ranking'),getFeatureGuide('annualRanking'),getFeatureGuide('matches'),getFeatureGuide('modes')]).includes('修为'));
});

test('新手期前20个计分小局 K=32，之后 K=16，搭档各用自己的 K',()=>{
 assert.equal(kFactor(0),32);assert.equal(kFactor(19),32);assert.equal(kFactor(20),16);
 assert.deepEqual(deltas(gameChanges([rated(1000,19),rated(1000,20)],[rated(1000,5),rated(1000,40)],'a')),{a:[16,8],b:[-16,-8]});
 const s=fixture(['A','B']);for(let i=0;i<22;i++)s.matches.push(match('m'+String(i).padStart(2,'0'),start+i*120000,i%2===0,['A'],['B']));
 const {games}=replayRealmScores(s,()=>true);const a=games.filter(g=>g.playerId==='A');
 assert.deepEqual(a.map(g=>g.k),[...Array(20).fill(32),16,16]);
 assert.equal(score(s,'A').ratedGames,22);
});

test('每局双方合计基本为零，长期全群平均分不漂移',()=>{
 for(const [a,b] of [[[1200,900],[1050,1050]],[[1000,1000],[1000,1000]],[[1300,1250],[800,900]]] as const)for(const w of ['a','b'] as const){const c=gameChanges(a.map(x=>rated(x)),b.map(x=>rated(x)),w);const sum=[...c.a,...c.b].reduce((n,x)=>n+x.delta,0);assert.ok(Math.abs(sum)<=2,'game sum '+sum)}
 // A deterministic 8-player club, 40 weekly sessions of 6 doubles games.
 const ids=['P1','P2','P3','P4','P5','P6','P7','P8'],skill=[1250,1150,1100,1000,1000,900,850,750],s=fixture(ids);let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
 for(let w=0;w<40;w++)for(let g=0;g<6;g++){const order=[...ids].sort(()=>rnd()-.5),a=order.slice(0,2),b=order.slice(2,4),team=(t:string[])=>t.reduce((n,id)=>n+skill[ids.indexOf(id)],0)/2,win=rnd()<expectedScore(team(a),team(b));s.matches.push({...match('w'+String(w).padStart(2,'0')+g,start+w*7*86400000+g*600000,win,a,b),eventId:'e'+w})}
 const later=start+400*86400000,snap=realmSnapshot(s,later),mean=ids.reduce((n,id)=>n+snap.get(id)!.score,0)/ids.length;
 assert.ok(Math.abs(mean-1000)<3,'club mean '+mean);
 assert.ok(snap.get('P1')!.score>snap.get('P8')!.score);
 // Ranking points over the whole year equal the change of 段位分 from 1000.
 const year=annualLeaderboard(s,2026,later),next=annualLeaderboard(s,2027,later);for(const id of ids)assert.equal((year.find(r=>r.playerId===id)?.pointsChange??0)+(next.find(r=>r.playerId===id)?.pointsChange??0),snap.get(id)!.score-1000);
});

test('境界门槛：达到即晋升，跌破门槛减15分才降级',()=>{
 assert.deepEqual(realms.map(r=>r.minimum),[-Infinity,900,1000,1100,1200]);
 for(const [value,realm] of [[899,'炼气'],[900,'筑基'],[999,'筑基'],[1000,'金丹'],[1099,'金丹'],[1100,'元婴'],[1199,'元婴'],[1200,'化神']] as const)assert.equal(realmByScore(value),realm);
 assert.equal(settleRealmIndex(2,1100),3,'promotion at the threshold');
 assert.equal(settleRealmIndex(3,1090),3);assert.equal(settleRealmIndex(3,1085),3);assert.equal(settleRealmIndex(3,1084),2);
 assert.equal(settleRealmIndex(4,1090),3,'a fall from 化神 still keeps 元婴 inside its buffer');assert.equal(settleRealmIndex(4,1084),2);
 assert.equal(settleRealmIndex(1,880),0);assert.equal(settleRealmIndex(1,885),1);
 const guarded=realmProgress(1090,3);assert.deepEqual([guarded.realm,guarded.progressPercent,guarded.guarded,guarded.demotionAt],['元婴',0,true,1085]);
 const mid=realmProgress(1050);assert.deepEqual([mid.realm,mid.stage,mid.progressPercent,mid.nextRealm,mid.remaining],['金丹','中期',50,'元婴',50]);
 assert.deepEqual([realmProgress(850).realm,realmProgress(850).progressPercent,realmProgress(700).progressPercent],['炼气',50,0]);
 assert.deepEqual([realmProgress(1200).stage,realmProgress(1250).stage,realmProgress(1300).stage,realmProgress(1300).progressPercent],['初期','中期','圆满',100]);
 for(const bad of [NaN,Infinity])assert.equal(realmProgress(bad).score,1000);
});

test('保级缓冲按活动结算后判断：同一活动中途跌破又回升不降级，下一次活动跌入缓冲区仍保留',()=>{
 const s=fixture(['A','B']);let at=start,n=0;const play=(event:string,wins:boolean[])=>{for(const w of wins){const m=match('g'+String(n++).padStart(3,'0'),at,w,['A'],['B']);m.eventId=event;s.matches.push(m);at+=120000}at+=86400000};
 play('e1',Array(9).fill(true));const top=score(s,'A');assert.deepEqual([top.score,top.realm,top.placement],[1103,'元婴',true]);
 play('e2',[false,true]);const path=replayRealmScores(s,()=>true).games.filter(g=>g.playerId==='A'&&g.eventId==='e2').map(g=>g.after);
 assert.deepEqual(path,[1078,1087],'dips below 1085 inside e2, ends inside the buffer');const back=score(s,'A');
 assert.deepEqual([back.realm,back.guarded,back.demotionAt,back.placement],['元婴',true,1085,false]);
 play('e3',[false]);const fall=score(s,'A');assert.deepEqual([fall.score,fall.realm,fall.guarded],[1064,'金丹',false]);
});

test('少于10个计分小局为定级中：内部仍按段位分记境界且不用缓冲',()=>{
 const s=fixture(['A','B']);for(let i=0;i<9;i++){const m=match('p'+i,start+i*120000,false,['A'],['B']);m.eventId='e'+i;s.matches.push(m)}
 const a=score(s,'A');assert.equal(a.placement,true);assert.equal(a.ratedGames,9);assert.equal(a.realm,realmByScore(a.score));assert.ok(a.score<900);
 const m=match('p9',start+20*120000,false,['A'],['B']);m.eventId='e9';s.matches.push(m);assert.equal(score(s,'A').placement,false);
 assert.equal(playerStats(s,'A',score(s,'A')).provisional,false);assert.equal(playerStats(s,'B',realmSnapshot(s,start).get('B')).provisional,true);
});

test('定级期间页面不显示境界：只给已结算局数与段位分，进行中小局不计入，第10局结算后才显示境界',()=>{
 const s=fixture(),member={id:'C',email:'',role:'member' as const,playerId:'C'},admin={id:'D',email:'',role:'admin' as const,playerId:'D'};
 for(let i=0;i<9;i++){const m=match('q'+i,start+i*120000);m.eventId='q'+i;s.matches.push(m)}
 const internal=score(s,'A');assert.equal(internal.realm,realmByScore(internal.score),'the full snapshot keeps the realm internally');
 const hidden={placement:true,ratedGames:9,placementGames:realmPolicy.placementGames,score:internal.score,wins:9,losses:0,pendingGames:0,pendingChange:0,realm:null,stage:null};
 assert.deepEqual(visibleRealm(internal),hidden);
 for(const account of [member,admin]){const view=projectClubState(s,account,'2026-10',2026,now),st=view.social.stats.find(p=>p.playerId==='A')!;
  assert.equal(st.tier,null);assert.equal(st.provisional,true);assert.deepEqual(st.realmScore,hidden);
  for(const rows of [view.leaderboard,view.quarterlyLeaderboard,view.annualLeaderboard]){const row=rows.find(r=>r.playerId==='A')!;assert.equal(row.realm,null);assert.equal(row.provisional,true);assert.deepEqual(row.realmScore,hidden)}
  assert.ok(!JSON.stringify([st,view.quarterlyLeaderboard.find(r=>r.playerId==='A')]).match(/progressPercent|nextRealm|初期|中期|后期/),'no realm stage or progress during placement');
 }
 const e:Event={id:'live',creatorId:'A',title:'周四活动',start:now-3600000,end:now+3600000,venue:'测试',address:'',capacity:8,signupDeadline:now-3600000,cancelDeadline:now-3600000,note:'',status:'live',courtMode:'interval',ballMode:'interval'};s.events.push(e);
 const tenth=match('q9',now-1800000);tenth.eventId='live';s.matches.push(tenth);
 const during=projectClubState(s,member,'2026-10',2026,now).social.stats.find(p=>p.playerId==='A')!;
 assert.equal(during.tier,null);assert.equal(during.realmScore.placement,true);assert.equal(during.realmScore.ratedGames,9,'a running activity does not count towards placement');assert.equal(during.realmScore.pendingGames,1);
 const view=projectClubState(s,member,'2026-10',2026,e.end),after=view.social.stats.find(p=>p.playerId==='A')!,settled=score(s,'A',e.end);
 assert.equal(settled.ratedGames,10);assert.equal(after.provisional,false);assert.equal(after.tier,realmByScore(settled.score));
 assert.equal(after.realmScore.placement,false);assert.equal(after.realmScore.realm,after.tier);assert.equal(after.realmScore.stage,settled.stage);assert.equal(after.realmScore.progressPercent,settled.progressPercent);
 assert.equal(view.quarterlyLeaderboard.find(r=>r.playerId==='A')!.realm,after.tier);
});

test('友谊赛、让分局、弃权、取消、未完成和未来完赛不改段位分；作废与纠错按历史回放',()=>{
 const s=fixture();s.matches=[match('real')];assert.equal(score(s,'A').score,1016);assert.equal(score(s,'A',now+30*86400000).score,1016,'absence costs nothing');
 const friendly=match('friend');friendly.monthly=false;const handicap=match('handicap');handicap.handicap={side:'a',points:4,applied:true};handicap.elo=false;const forfeit=match('forfeit');forfeit.status='forfeit';const playing=match('playing');playing.status='playing';const future=match('future',now+86400000);
 s.matches.push(friendly,handicap,forfeit,playing,future,{...match('real')});assert.equal(score(s,'A').score,1016);assert.equal(score(s,'A').ratedGames,1);
 const row=leaderboard(s,'2026-10',now).find(r=>r.playerId==='A')!;assert.deepEqual([row.pointsChange,row.games],[16,1]);assert.ok(row.total>row.games,'unrated records still count as actual games');
 for(const m of s.matches)if(m.id==='real')m.status='cancelled';assert.equal(score(s,'A').score,1000);s.matches=[...s.matches.filter(m=>m.id!=='real'),match('real',start,false)];assert.equal(score(s,'A').score,984);
});

test('回放顺序确定：按完赛时间、比赛编号与小局顺序，与输入顺序无关',()=>{
 const s=fixture(),bo3=match('bo3',start+60000);bo3.games=[{a:21,b:19},{a:19,b:21},{a:21,b:15}];bo3.scoreA=2;bo3.scoreB=1;
 s.matches=[match('z',start,false),match('a',start,true),bo3,match('next',start+3600000,true,['A','C'],['B','D'])];
 const forward=realmSnapshot(s,now);s.matches.reverse();assert.deepEqual(realmSnapshot(s,now),forward);
 const {games}=replayRealmScores(s,()=>true);assert.deepEqual([...new Set(games.map(g=>g.matchId+':'+g.gameIndex))],['a:0','z:0','bo3:0','bo3:1','bo3:2','next:0']);
 assert.equal(forward.get('A')!.ratedGames,6);assert.equal(forward.get('A')!.wins,4);
 // Hidden strength is untouched and still updates once per match.
 replayRating(s);assert.equal(s.players[0].ratedGames,4);
});

test('活动进行中段位分与境界保持，显示待结算局数和暂计变化；结束后一次结算',()=>{
 const s=fixture(),e:Event={id:'event',creatorId:'A',title:'周四活动',start,end:start+3*3600000,venue:'测试',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'live',courtMode:'interval',ballMode:'interval'};s.events.push(e);
 s.matches=[match('first'),match('second',start+3600000,false)];const mid=start+2*3600000;
 const live=score(s,'A',mid);assert.deepEqual([live.score,live.realm,live.pendingGames,live.ratedGames],[1000,'金丹',2,0]);assert.equal(live.pendingChange,16-17);
 for(const rows of [leaderboard(s,'2026-10',mid),quarterlyLeaderboard(s,'2026-Q4',mid),annualLeaderboard(s,2026,mid)]){const a=rows.find(r=>r.playerId==='A')!;assert.deepEqual([a.pointsChange,a.pendingPoints,a.pendingGames,a.games],[-1,-1,2,2]);assert.equal(a.realmScore.score,1000)}
 const settled=score(s,'A',e.end);assert.deepEqual([settled.score,settled.pendingGames,settled.ratedGames],[999,0,2]);
 assert.deepEqual(realmSnapshot(s,e.end),realmSnapshot({...s,events:[]},e.end));assert.equal(score(s,'A',e.end-1).score,1000);
 e.status='ended';assert.equal(score(s,'A',mid).score,999);e.status='cancelled';assert.equal(score(s,'A',mid).score,999);
 e.status='open';assert.equal(score(s,'A',mid).score,1000);e.end+=3600000;assert.equal(score(s,'A',start+3*3600000).score,1000);
 s.matches.forEach(m=>{m.eventId='legacy-without-record'});assert.equal(score(s,'A',mid).score,999);
});

test('一次性迁移：所有人从1000按全部历史回算，忽略初始实力与旧成长底分，写入版本并幂等',()=>{
 const s=fixture();s.players[0].initialRating=1400;s.players[0].rating=1400;s.players[0].cultivationBase=380;s.settings.progressionVersion='weekly-v2';s.matches=[match('old',start),match('older',start-86400000,false)];
 const before=structuredClone(s);assert.equal(enableEloRealms({...structuredClone(s),settings:{...s.settings,initialized:false}},now),null);
 s.settings.initialized=true;const audit=enableEloRealms(s,now)!;assert.equal(s.settings.realmVersion,'elo-v1');assert.equal(audit.version,'elo-v1');
 const a=audit.players.find(p=>p.playerId==='A')!;assert.equal(a.legacyBase,380);assert.equal(a.ratedGames,2);assert.equal(a.score,score(s,'A').score);assert.equal(a.score,1000-16+17);
 assert.deepEqual(s.players,before.players);assert.deepEqual(s.matches,before.matches);
 assert.equal(enableEloRealms(s,now+1),null);assert.equal(s.settings.realmVersion,'elo-v1');
});

test('页面境界与队伍参考实力在活动中保持，结束时自动结算且与完整重放一致，读取缓存在结束时刷新',()=>{
 const s=fixture();for(const p of s.players.slice(0,2)){p.initialRating=1090;p.rating=1090}const e:Event={id:'event',creatorId:'A',title:'周四活动',start,end:start+3*3600000,venue:'测试',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'live',courtMode:'interval',ballMode:'interval'};s.events.push(e);s.matches=[match('late')];replayRating(s);const member={id:'C',email:'',role:'member' as const,playerId:'C'},mid=start+3600000;
 assert.ok(s.players[0].rating>1100);
 const during=projectClubState(s,member,'2026-10',2026,mid),a=(data:typeof during)=>data.social.stats.find(p=>p.playerId==='A')!;
 assert.equal(during.events[0].status,'live');assert.equal(a(during).tier,null);assert.equal(a(during).realmScore.placement,true);assert.equal(a(during).realmScore.score,1000);assert.equal(a(during).realmScore.pendingGames,1);assert.equal(during.leaderboard.find(r=>r.playerId==='A')!.pointsChange,16);assert.equal(during.leaderboard.find(r=>r.playerId==='A')!.realmScore.score,1000);assert.equal(during.social.matchLevels.late.a,'入门');
 const after=projectClubState(s,member,'2026-10',2026,e.end);assert.equal(after.events[0].status,'ended');assert.equal(a(after).realmScore.score,1016);assert.equal(after.leaderboard.find(r=>r.playerId==='A')!.realmScore.score,1016);assert.equal(after.social.matchLevels.late.a,'基础');
 assert.equal(settledRatings(s,mid).get('A'),1090);assert.equal(settledRatings(s,e.end).get('A'),s.players[0].rating);assert.equal(s.events[0].status,'live');
 assert.ok(after.players.every(p=>p.rating===null));
 e.status='draft';e.creatorId='someone-else';assert.equal(clubViewValidUntil(s,member,e.end-60000),e.end);
});

test('自动预计出勤不产生早到或压线称号，手动和旧历史出勤保持实际记录',()=>{
 const s=fixture();const e:Event={id:'manual',creatorId:'A',title:'活动',start,end:start+3600000,venue:'测试',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'live',courtMode:'interval',ballMode:'interval'};
 s.events.push(e,{...e,id:'legacy'},{...e,id:'automatic'});
 s.attendance.push({id:'expected',eventId:'manual',playerId:'A',start:start-600000,end:null,state:'ready',source:'automatic'},
  {id:'actual',eventId:'manual',playerId:'A',start:start+120000,end:null,state:'ready'},
  {id:'legacy',eventId:'legacy',playerId:'A',start:start-300000,end:null,state:'ready'},
  {id:'only-expected',eventId:'automatic',playerId:'A',start,end:null,state:'ready',source:'automatic'});
 const p=personality(s,2026).find(p=>p.playerId==='A')!;assert.equal(p.early,1);assert.equal(p.onTime,1);
});
