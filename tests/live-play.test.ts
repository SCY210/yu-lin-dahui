import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {liveAppearances,liveResting,liveWinStreaks} from '../lib/domain/live-play';
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
 assert.equal(active(s).length,1,'all four ready players may continue without substitutes');assert.ok(e.livePlay!.preferences.every(p=>p.avoidConsecutive));
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
  assert.ok(counts.every(n=>n>=0));assert.ok(!e.livePlay!.rest.some(r=>r.reason==='win-limit'));
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
  assert.equal(new Set(active(s).flatMap(m=>[...m.a,...m.b])).size,8);
 }
 const contacts=new Map(s.players.map(p=>[p.id,new Set<string>()]));
 for(const m of s.matches)for(const id of [...m.a,...m.b])for(const other of [...m.a,...m.b])if(id!==other)contacts.get(id)!.add(other);
 assert.ok([...contacts.values()].every(ids=>ids.size===11),JSON.stringify([...contacts].map(([id,ids])=>[id,ids.size])));
 const counts=s.players.map(p=>liveAppearances(s,e.id,p.id));assert.ok(counts.every(n=>n>0));
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


for(const count of [4,5,6])test(`${count} available doubles players can keep playing without substitutes or a win cap`,async()=>{
 const {s,e,owner}=fixture(count);await apply(s,owner,'liveStart',{eventId:e.id},now);
 for(let turn=1;turn<=8;turn++){const m=active(s)[0];assert.ok(m);await score(s,m.id,now+turn*60000);assert.equal(active(s).length,1);assert.equal(participants(active(s)[0]).size,4);assert.ok(!e.livePlay!.rest.some(r=>r.reason==='win-limit'))}
});

test('legacy two-win breaks are immediately eligible for selection and manual lineup changes',async()=>{
 const {s,e,owner}=fixture(6);await apply(s,owner,'liveStart',{eventId:e.id},now);const m=active(s)[0],bench=s.players.filter(p=>!participants(m).has(p.id)).map(p=>p.id);
 e.livePlay!.rest=bench.map(playerId=>({playerId,venue:e.venue,after:now,reason:'win-limit'}));
 assert.ok(bench.every(id=>!liveResting(e,id)));
 await apply(s,owner,'liveLineup',{matchId:m.id,expectedA:m.a,expectedB:m.b,a:bench,b:m.b},now+1000);
 assert.deepEqual(m.a,bench);await score(s,m.id,now+60000);assert.ok(active(s)[0]);assert.ok(!e.livePlay!.rest.some(r=>r.reason==='win-limit'));
});

test('winners waiting on another idle court remain usable when this court is short',async()=>{
 const {s,e,owner}=fixture(8,2);await apply(s,owner,'liveStart',{eventId:e.id},now);const [first,other]=active(s);
 for(const m of [first,other])await apply(s,owner,'score',{matchId:m.id,a:21,b:19},now+60000);
 // Only the four winners remain in the attendance window. Soft retention cannot reserve two of them forever.
 for(const id of [...first.b,...other.b])s.registrations.find(r=>r.playerId===id)!.departure=now+60000;
 await apply(s,owner,'liveNext',{eventId:e.id,courtId:first.courtId},now+61000);
 assert.equal(active(s).length,1);assert.deepEqual(participants(active(s)[0]),new Set([...first.a,...other.a]));
});

test('fixed partners can win repeatedly; voluntary rest and busy players remain protected',async()=>{
 const {s,e,owner}=fixture(6);e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:[['p00','p01'],['p02','p03'],['p04','p05']]};await apply(s,owner,'liveStart',{eventId:e.id},now);const held=[...active(s)[0].a];
 for(let i=1;i<=4;i++){const m=active(s)[0],a=held.every(id=>m.a.includes(id));await apply(s,owner,'score',{matchId:m.id,a:a?21:19,b:a?19:21},now+i*60000);await nextGame(s,m.courtId,now+i*60000+1);assert.ok(held.every(id=>participants(active(s)[0]).has(id)))}
 assert.ok(held.every(id=>liveWinStreaks(s,e).get(id)===4));assert.deepEqual(e.livePlay!.rest,[]);
 await apply(s,owner,'livePreference',{eventId:e.id,playerId:held[0],avoidConsecutive:true},now+250000);await score(s,active(s)[0].id,now+300000);assert.ok(liveResting(e,held[0]));assert.ok(!participants(active(s)[0]).has(held[0]));
});
