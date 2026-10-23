import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {liveAppearances,liveResting,liveForcedRest,liveWinStreaks} from '../lib/domain/live-play';
import {matchupKey} from '../lib/domain/match-history';
import {emptyState,type Event} from '../lib/domain/types';

const now=Date.parse('2026-10-10T15:00:00Z');
function fixture(count=8,courts=1){
 const s=emptyState();s.settings.initialized=true;
 const e:Event={id:'event',creatorId:'owner',title:'虚构实时活动',start:now-3600000,end:now+3*3600000,venue:'球馆',address:'',capacity:count,signupDeadline:now,cancelDeadline:now-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal'};
 s.events.push(e);s.settings.ownerAccountId='owner';
 for(let i=0;i<count;i++){
  const id='p'+String(i).padStart(2,'0'),accountId=i?'member'+i:'owner';
  s.players.push({id,name:id,ownerId:accountId,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
  s.accounts.push({id:accountId,email:'',role:i?'member':'admin',playerId:id});
  s.registrations.push({id:'reg'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 for(let i=0;i<courts;i++)s.bookings.push({id:'court'+i,eventId:e.id,name:'场地'+i,start:e.start,end:e.end,pricing:'total',cents:1000});
 return {s,e,owner:s.accounts[0]};
}
const active=(s:ReturnType<typeof emptyState>)=>s.matches.filter(m=>m.status==='playing');
// A finished court waits for 开始组队 (liveNext); these tests press it right away, keeping the same players if nobody else can play.
const nextGame=(s:ReturnType<typeof emptyState>,courtId:string,at:number)=>apply(s,s.accounts[1],'liveNext',{eventId:s.events[0].id,courtId,allowSame:true},at).catch(()=>{});
const score=async(s:ReturnType<typeof emptyState>,matchId:string,at=now+60000)=>{const court=s.matches.find(m=>m.id===matchId)!.courtId,result=await apply(s,s.accounts[1],'score',{matchId,a:21,b:19,reason:'本局结束'},at);await nextGame(s,court,at);return result};

test('各场独立推进，录分后自动开下一局且不重复安排正在打的人',async()=>{
 const {s,e,owner}=fixture(12,2);await apply(s,owner,'liveStart',{eventId:e.id},now);
 const original=active(s);assert.equal(original.length,2);assert.equal(e.status,'open');
 await score(s,original[0].id);
 assert.equal(s.matches.find(m=>m.id===original[0].id)!.status,'complete');
 assert.equal(s.matches.find(m=>m.id===original[1].id)!.status,'playing');
 assert.equal(active(s).length,2);assert.equal(s.matches.length,3);
 const ids=active(s).flatMap(m=>[...m.a,...m.b]);assert.equal(new Set(ids).size,ids.length);
 const replacement=active(s).find(m=>m.id!==original[1].id)!;
 assert.equal(s.rounds.find(r=>r.id===replacement.roundId)!.liveSequence,2);
 assert.equal(s.rounds.find(r=>r.id===replacement.roundId)!.duration,0);
 assert.equal(s.matches[0].end,now+60000);
});

test('不连续上场跳过下一局，再下一局恢复候选且偏好仍保留',async()=>{
 const {s,e,owner}=fixture();
 for(const account of s.accounts.slice(0,4))await apply(s,account,'livePreference',{eventId:e.id,playerId:account.playerId,avoidConsecutive:true},now);
 await apply(s,owner,'liveStart',{eventId:e.id},now);
 const first=active(s)[0],firstPlayers=[...first.a,...first.b];await score(s,first.id);
 const second=active(s)[0];assert.ok([...second.a,...second.b].every(id=>!firstPlayers.includes(id)));
 assert.ok(firstPlayers.every(id=>liveResting(e,id)));
 await score(s,second.id,now+120000);
 assert.equal([...active(s)[0].a,...active(s)[0].b].filter(id=>firstPlayers.includes(id)).length,2,'two returning bench players join the retained winners');
 assert.ok(firstPlayers.every(id=>!liveResting(e,id)));
 assert.equal(e.livePlay!.preferences.filter(p=>p.avoidConsecutive).length,4);
});

test('没有替补就等待，球友可在休息好后主动准备，不强迫连续上场',async()=>{
 const {s,e,owner}=fixture(4);
 for(const a of s.accounts)await apply(s,a,'livePreference',{eventId:e.id,playerId:a.playerId,avoidConsecutive:true},now);
 await apply(s,owner,'liveStart',{eventId:e.id},now);await score(s,active(s)[0].id);
 assert.equal(active(s).length,0);assert.equal(s.matches.length,1);
 for(const a of s.accounts)await apply(s,a,'liveReady',{eventId:e.id,playerId:a.playerId},now+120000);
 assert.equal(active(s).length,0,'a court that has had a game waits for 开始组队');await nextGame(s,s.matches[0].courtId,now+120000);
 assert.equal(active(s).length,0,'marking ready does not create substitutes');assert.ok(e.livePlay!.preferences.every(p=>p.avoidConsecutive));
});

test('另一片场仍在打的上一轮结束，不会误清除刚申请的轮休',async()=>{
 const {s,e,owner}=fixture(8,2);
 await apply(s,owner,'livePreference',{eventId:e.id,playerId:'p00',avoidConsecutive:true},now);
 await apply(s,owner,'liveStart',{eventId:e.id},now);const first=[...active(s)];
 await score(s,first[0].id,now+60000);assert.ok(liveResting(e,'p00'));
 await score(s,first[1].id,now+65000);assert.ok(liveResting(e,'p00'));
 assert.ok(active(s).every(m=>![...m.a,...m.b].includes('p00')));
 await score(s,active(s)[0].id,now+120000);assert.equal(liveResting(e,'p00'),false);
 assert.ok(!liveResting(e,'p00'),'eligible again, without displacing retained winners');
});

test('14人两场保留胜者且等待球友持续轮换',async()=>{
 const {s,e,owner}=fixture(14,2);await apply(s,owner,'liveStart',{eventId:e.id},now);
 for(let cycle=0;cycle<24;cycle++){
  for(const match of [...active(s)])await score(s,match.id,now+(cycle+1)*60000);
  const counts=s.players.map(p=>liveAppearances(s,e.id,p.id));
  assert.ok(Math.max(...counts)-Math.min(...counts)<=3,JSON.stringify(counts));
  assert.equal(new Set(active(s).flatMap(m=>[...m.a,...m.b])).size,8);
 }
});

test('权限按存储身份验证，成员不能替别人设轮休或启动排场',async()=>{
 const {s,e,owner}=fixture(),member=s.accounts[1];const before=structuredClone(s);
 await assert.rejects(()=>apply(s,member,'liveStart',{eventId:e.id,isOwner:true},now),/403/);
 await assert.rejects(()=>apply(s,member,'livePreference',{eventId:e.id,playerId:owner.playerId,avoidConsecutive:true,role:'admin'},now),/403/);
 assert.deepEqual(s,before);
 const friend={...s.players[0],id:'friend',ownerId:member.id};s.players.push(friend);s.registrations.push({...s.registrations[0],id:'friend-reg',playerId:friend.id});
 await apply(s,member,'livePreference',{eventId:e.id,playerId:friend.id,avoidConsecutive:true},now);
 assert.equal(e.livePlay!.preferences[0].playerId,friend.id);
});

test('候补、未到、停用和其他活动正在打的人不会被安排',async()=>{
 const {s,e,owner}=fixture();s.registrations[4].status='waitlist';s.registrations[5].arrival=now+60000;s.players[6].enabled=false;
 s.matches.push({id:'elsewhere',eventId:'other',roundId:'other-round',courtId:'other-court',a:['p07','x'],b:['y','z'],start:now,end:null,status:'playing',scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]});
 await apply(s,owner,'liveStart',{eventId:e.id},now);
 assert.deepEqual(new Set(s.matches.find(m=>m.eventId===e.id)!.a.concat(s.matches.find(m=>m.eventId===e.id)!.b)),new Set(['p00','p01','p02','p03']));
});

test('固定搭档完整上场，搭档轮休时不拆队',async()=>{
 const {s,e,owner}=fixture();e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:[['p00','p01'],['p02','p03'],['p04','p05'],['p06','p07']]};
 await apply(s,owner,'livePreference',{eventId:e.id,playerId:'p00',avoidConsecutive:true},now);
 await apply(s,owner,'liveStart',{eventId:e.id},now);await score(s,active(s)[0].id);
 const next=active(s)[0];assert.ok(![...next.a,...next.b].includes('p00'));
 assert.ok([next.a,next.b].every(team=>e.pointsChoice!.teams!.some(t=>t.every(id=>team.includes(id)))));
});

test('同一真实场地不会被重复使用；暂停允许录分但不继续排场',async()=>{
 const {s,e,owner}=fixture(8,2);s.bookings[1].name=s.bookings[0].name;
 await apply(s,owner,'liveStart',{eventId:e.id},now);assert.equal(active(s).length,1);
 await apply(s,owner,'livePause',{eventId:e.id,paused:true},now);
 await score(s,active(s)[0].id);assert.equal(active(s).length,0);
 await apply(s,owner,'livePause',{eventId:e.id,paused:false},now+120000);assert.equal(active(s).length,0,'the finished court waits for 开始组队');
 await nextGame(s,s.bookings[0].id,now+120000);assert.equal(active(s).length,1);
});

test('纠正已完成比分不重复推进，实时对局不接受三局结果',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'liveStart',{eventId:e.id},now);
 const first=active(s)[0];await assert.rejects(()=>apply(s,owner,'score',{matchId:first.id,a:21,b:19,games:[{a:21,b:19},{a:21,b:17}],reason:'测试'},now+60000),/一局/);
 await score(s,first.id);const count=s.matches.length,cooldown=structuredClone(e.livePlay);
 await apply(s,s.accounts[1],'score',{matchId:first.id,a:19,b:21,reason:'纠正比分'},now+120000);
 assert.equal(s.matches.length,count);assert.deepEqual(e.livePlay,cooldown);assert.equal(first.end,now+60000);
});

test('未来活动不启动且不留下部分配置，既有完成结果保留',async()=>{
 const {s,e,owner}=fixture();e.start=now+60000;const before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'liveStart',{eventId:e.id},now),/活动进行/);assert.deepEqual(s,before);
});

const participants=(m:{a:string[];b:string[]})=>new Set([...m.a,...m.b]);
test('two courts with staggered finishes: waiting players get priority while equal-count cohorts can mix',async()=>{
 const {s,e,owner}=fixture(12,2);await apply(s,owner,'liveStart',{eventId:e.id},now);
 const [first,second]=[...active(s)];const waiting=participants(second);
 await score(s,second.id,now+60000);
 await score(s,first.id,now+90000);
 const next=participants(active(s).find(m=>m.courtId===first.courtId)!);
 assert.equal([...next].filter(id=>waiting.has(id)).length,0,'other court winners stay there; its losers do not jump ahead of unplayed bench players');
 assert.equal([...next].filter(id=>participants(first).has(id)).length,2);assert.ok(first.a.every(id=>next.has(id)));
 assert.ok(![...next].some(id=>participants(active(s).find(m=>m.courtId!==first.courtId)!).has(id)));
});
for(const fixed of [false,true])test(`bench priority beats smaller game counts; fixed partners: ${fixed}`,async()=>{
 const {s,e,owner}=fixture(12,2);
 if(fixed)e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:Array.from({length:6},(_,i)=>['p'+String(i*2).padStart(2,'0'),'p'+String(i*2+1).padStart(2,'0')])};
 const bench=['p08','p09','p10','p11'];
 for(let i=0;i<2;i++)s.matches.push({id:'past'+i,eventId:e.id,roundId:'past-round'+i,courtId:'court1',a:bench.slice(0,2),b:bench.slice(2),start:now-(4-i)*60000,end:now-(3-i)*60000,status:'complete',scoreA:21,scoreB:19,monthly:true,elo:true,locked:false,enteredBy:owner.id,games:[{a:21,b:19}]});
 await apply(s,owner,'liveStart',{eventId:e.id},now);const first=active(s).find(m=>m.courtId==='court0')!;
 await score(s,first.id,now+60000);
 const picked=participants(active(s).find(m=>m.courtId==='court0')!);assert.ok(first.a.every(id=>picked.has(id)));assert.equal(bench.filter(id=>picked.has(id)).length,2);
 if(fixed)assert.ok([active(s)[0].a,active(s)[0].b].every(team=>e.pointsChoice!.teams!.some(t=>t.every(id=>team.includes(id)))));
});
test('two waiting players get both places before willing just-finished players fill the other two',async()=>{
 const {s,e,owner}=fixture(10,2);await apply(s,owner,'liveStart',{eventId:e.id},now);const first=active(s)[0];
 const playingIds=new Set(active(s).flatMap(m=>[...m.a,...m.b]));const waiting=s.players.filter(p=>!playingIds.has(p.id)).map(p=>p.id);
 await score(s,first.id,now+60000);const next=active(s).find(m=>m.courtId===first.courtId)!;
 assert.ok(waiting.every(id=>participants(next).has(id)));assert.equal([...participants(next)].filter(id=>participants(first).has(id)).length,2);
});

test('live doubles rotate all three matchups before repeating and never immediately repeat at equal strength',async()=>{
 const {s,e,owner}=fixture(6);await apply(s,owner,'liveStart',{eventId:e.id},now);
 const seen:string[]=[];
 for(let turn=0;turn<10;turn++){
  const m=active(s)[0],key=matchupKey(m.a,m.b);
  if(turn)assert.notEqual(key,seen.at(-1));
  seen.push(key);await score(s,m.id,now+(turn+1)*60000);
 }
 assert.equal(new Set(seen.slice(0,3)).size,3);
});
for(const format of ['singles','rotate','fixed'] as const)test(`equally entitled waiting players can mix cohorts to avoid a rematch: ${format}`,async()=>{
 const size=format==='singles'?2:4,{s,e,owner}=fixture(size*3,1);
 if(format==='singles')e.matchFormat='singles';
 if(format==='fixed')e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:Array.from({length:6},(_,i)=>s.players.slice(i*2,i*2+2).map(p=>p.id))};
 const oldKeys=new Set<string>();
 for(let group=0;group<3;group++){
  const ids=s.players.slice(group*size,(group+1)*size).map(p=>p.id),a=ids.slice(0,size/2),b=ids.slice(size/2);
  oldKeys.add(matchupKey(a,b));
  s.matches.push({id:'old'+group,eventId:e.id,roundId:'past'+group,courtId:'court0',a,b,start:now-(6-group)*60000,end:now-(5-group)*60000,status:'complete',scoreA:21,scoreB:19,monthly:true,elo:true,locked:false,enteredBy:owner.id,games:[{a:21,b:19}]});
 }
 await apply(s,owner,'liveStart',{eventId:e.id},now);
 const next=active(s)[0];assert.ok(!oldKeys.has(matchupKey(next.a,next.b)));
 assert.ok([...next.a,...next.b].filter(id=>!s.players.slice(size*2).some(p=>p.id===id)).length>=(format==='rotate'?3:size),'waiting players retain priority while one position may introduce a new contact');
 if(format==='fixed')assert.ok([next.a,next.b].every(t=>e.pointsChoice!.teams!.some(original=>original.every(id=>t.includes(id)))));
});
test('12 players on two staggered courts meet the whole roster instead of cycling three four-player groups',async()=>{
 const {s,e,owner}=fixture(12,2);await apply(s,owner,'liveStart',{eventId:e.id},now);
 for(let turn=0;turn<48;turn++)for(const m of [...active(s)]){
  await score(s,m.id,now+(turn+1)*60000);
  const counts=s.players.map(p=>liveAppearances(s,e.id,p.id));assert.ok(Math.max(...counts)-Math.min(...counts)<=2,'including games still in progress');
 }
 const contacts=new Map(s.players.map(p=>[p.id,new Set<string>()]));
 for(const m of s.matches)for(const id of [...m.a,...m.b])for(const other of [...m.a,...m.b])if(id!==other)contacts.get(id)!.add(other);
 assert.ok([...contacts.values()].every(ids=>ids.size===11),JSON.stringify([...contacts].map(([id,ids])=>[id,ids.size])));
 const counts=s.players.map(p=>liveAppearances(s,e.id,p.id));assert.ok(Math.max(...counts)-Math.min(...counts)<=2);
});

test('winners retain their places and existing balance rules may keep them partnered',async()=>{
 const {s,e,owner}=fixture(8);await apply(s,owner,'liveStart',{eventId:e.id},now);const first=active(s)[0];
 await apply(s,owner,'score',{matchId:first.id,a:21,b:19},now+60000);
 const bench=s.players.filter(p=>![...first.a,...first.b].includes(p.id));bench[0].rating=1400;bench[1].rating=600;bench[2].rating=1800;bench[3].rating=1800;
 await apply(s,owner,'liveNext',{eventId:e.id,courtId:first.courtId},now+60001);const next=active(s)[0];
 assert.ok(first.a.every(id=>participants(next).has(id)));assert.ok(first.b.every(id=>!participants(next).has(id)));
 assert.ok([next.a,next.b].some(team=>first.a.every(id=>team.includes(id))),'no forced winner split overrides the existing balance algorithm');
 assert.deepEqual(new Set(s.rounds.find(r=>r.id===next.roundId)!.liveRetained),new Set(first.a));
});

test('two-win limit follows the individual through a partner change and cannot be overridden',async()=>{
 const {s,e,owner}=fixture(8);await apply(s,owner,'liveStart',{eventId:e.id},now);const first=active(s)[0],winner=first.a[0];
 await score(s,first.id,now+60000);const second=active(s)[0],fresh=[...second.a,...second.b].filter(id=>!first.a.includes(id));
 await apply(s,owner,'liveLineup',{matchId:second.id,expectedA:[...second.a],expectedB:[...second.b],a:[winner,fresh[0]],b:[first.a[1],fresh[1]]},now+61000);
 await apply(s,owner,'score',{matchId:second.id,a:21,b:19},now+120000);
 assert.equal(liveWinStreaks(s,e).get(winner),2);assert.ok(liveForcedRest(e,winner));assert.ok(!liveForcedRest(e,fresh[0]));
 await assert.rejects(()=>apply(s,owner,'liveReady',{eventId:e.id,playerId:winner},now+120001),/连赢两局/);
 await apply(s,owner,'livePreference',{eventId:e.id,playerId:winner,avoidConsecutive:false},now+120002);assert.ok(liveForcedRest(e,winner));
 await apply(s,owner,'liveNext',{eventId:e.id,courtId:second.courtId,allowSame:true},now+120003);const third=active(s)[0];
 assert.ok(!participants(third).has(winner));assert.ok(participants(third).has(fresh[0]));
 await assert.rejects(()=>apply(s,owner,'liveLineup',{matchId:third.id,expectedA:[...third.a],expectedB:[...third.b],a:[winner,third.a[1]],b:third.b},now+120004),/可上场/);
 await apply(s,owner,'score',{matchId:third.id,a:21,b:19},now+180000);assert.ok(!liveForcedRest(e,winner),'a whole later-started game completed during the break');
});

test('six fixed partners keep rotating when both winners must leave after their second win',async()=>{
 const {s,e,owner}=fixture(6);e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:[['p00','p01'],['p02','p03'],['p04','p05']]};
 await apply(s,owner,'liveStart',{eventId:e.id},now);const first=active(s)[0],held=[...first.a];await score(s,first.id,now+60000);
 const second=active(s)[0];const retainedSide=held.every(id=>second.a.includes(id))?'a':'b';
 await apply(s,owner,'score',{matchId:second.id,a:retainedSide==='a'?21:19,b:retainedSide==='b'?21:19},now+120000);
 assert.ok(held.every(id=>liveForcedRest(e,id)));await nextGame(s,second.courtId,now+120001);
 assert.equal(active(s).length,1);assert.ok(held.every(id=>!participants(active(s)[0]).has(id)));assert.equal(participants(active(s)[0]).size,4);
 await apply(s,owner,'score',{matchId:active(s)[0].id,a:21,b:19},now+180000);assert.ok(held.every(id=>!liveForcedRest(e,id)));
 await nextGame(s,first.courtId,now+180001);const returned=active(s)[0];assert.ok(held.every(id=>participants(returned).has(id)));
 await apply(s,owner,'score',{matchId:returned.id,a:held.every(id=>returned.a.includes(id))?21:19,b:held.every(id=>returned.b.includes(id))?21:19},now+240000);
 assert.ok(held.every(id=>liveWinStreaks(s,e).get(id)===1),'returning from the bench resets the personal run');
});

test('starting another court does not reset a retained winner waiting for their own next game',async()=>{
 const {s,e,owner}=fixture(12,2);await apply(s,owner,'liveStart',{eventId:e.id},now);const [first,other]=active(s);
 await apply(s,owner,'score',{matchId:first.id,a:21,b:19},now+60000);await score(s,other.id,now+65000);
 await nextGame(s,first.courtId,now+70000);const next=active(s).find(m=>m.courtId===first.courtId)!;
 assert.ok(first.a.every(id=>participants(next).has(id)));
 const fresh=[...next.a,...next.b].filter(id=>!first.a.includes(id));await apply(s,owner,'liveLineup',{matchId:next.id,expectedA:next.a,expectedB:next.b,a:first.a,b:fresh},now+71000);
 await apply(s,owner,'score',{matchId:next.id,a:21,b:19},now+120000);assert.ok(first.a.every(id=>liveForcedRest(e,id)));
});

test('moving a retained winner to an earlier-started court preserves their personal win limit',async()=>{
 const {s,e,owner}=fixture(12,2);await apply(s,owner,'liveStart',{eventId:e.id},now);const [first,other]=active(s);await score(s,first.id,now+60000);const id=first.a[0];
 await apply(s,owner,'liveSwap',{eventId:e.id,p1:id,p2:other.a[0],expectedLineup:active(s).map(m=>({id:m.id,a:[...m.a],b:[...m.b]}))},now+70000);
 await apply(s,owner,'score',{matchId:other.id,a:21,b:19},now+120000);assert.ok(liveForcedRest(e,id));
 const ongoing=active(s)[0];await apply(s,owner,'void',{matchId:ongoing.id,status:'cancelled'},now+130000);assert.ok(liveForcedRest(e,id),'cancelling a court is not a completed rest game');
});

test('a completed break on another court returns a two-win player to the bench, not to the old retained slot',async()=>{
 const {s,e,owner}=fixture(8,2);s.bookings[1].start=now+180000;
 await apply(s,owner,'liveStart',{eventId:e.id},now);const first=active(s)[0],held=[...first.a];await score(s,first.id,now+60000);
 const second=active(s)[0],fresh=[...second.a,...second.b].filter(id=>!held.includes(id));await apply(s,owner,'liveLineup',{matchId:second.id,expectedA:second.a,expectedB:second.b,a:held,b:fresh},now+61000);
 await apply(s,owner,'score',{matchId:second.id,a:21,b:19},now+120000);assert.ok(held.every(id=>liveForcedRest(e,id)));
 await apply(s,owner,'liveNext',{eventId:e.id,courtId:s.bookings[1].id},now+180001);const other=active(s)[0];await apply(s,owner,'score',{matchId:other.id,a:21,b:19},now+240000);assert.ok(held.every(id=>!liveForcedRest(e,id)));
 await apply(s,owner,'liveNext',{eventId:e.id,courtId:first.courtId},now+240001);const returned=active(s)[0],round=s.rounds.find(r=>r.id===returned.roundId)!;
 assert.ok(held.every(id=>!round.liveRetained?.includes(id)),'the old two-win court does not resurrect its retained slot after a break');
});

test('briefly swapping a retained winner to the bench and back does not clear their win count',async()=>{
 const {s,e,owner}=fixture(8);await apply(s,owner,'liveStart',{eventId:e.id},now);const first=active(s)[0];await score(s,first.id,now+60000);const second=active(s)[0],id=first.a[0],spare=s.players.find(p=>!participants(second).has(p.id))!.id;
 const swap=async(p1:string,p2:string,at:number)=>apply(s,owner,'liveSwap',{eventId:e.id,p1,p2,expectedLineup:active(s).map(m=>({id:m.id,a:[...m.a],b:[...m.b]}))},at);
 await swap(id,spare,now+61000);await swap(spare,id,now+62000);
 await apply(s,owner,'score',{matchId:second.id,a:second.a.includes(id)?21:19,b:second.b.includes(id)?21:19},now+120000);assert.ok(liveForcedRest(e,id));
});
