import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Event,type Round,type Match} from '../lib/domain/types';
import {schedulingMode,pendingSchedulingIds,cancelPendingScheduling} from '../lib/domain/scheduling';
import {startDuePointsSessions} from '../lib/domain/points-auto-start';
import {liveLineupSnapshot} from '../lib/domain/live-lineup';
const start=Date.parse('2030-10-10T13:00:00Z'),minute=60000;
function fixture(){const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';for(let i=0;i<8;i++){const id=i?'member'+i:'owner';s.accounts.push({id,email:'',playerId:'p'+i,role:i?'member':'admin'});s.players.push({id:'p'+i,name:'p'+i,ownerId:id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''})}const e:Event={id:'e',creatorId:'owner',title:'Fixture scheduling',start,end:start+120*minute,venue:'Fixture venue',address:'',capacity:8,signupDeadline:start+120*minute,cancelDeadline:start-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};s.events=[e];s.bookings=[{id:'court',eventId:e.id,name:'Court',start,end:e.end,pricing:'total',cents:1380}];s.registrations=s.players.map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,sequence:i,status:'confirmed',arrival:start,departure:e.end,registeredAt:start-minute,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));return {s,e,owner:s.accounts[0]}}
const payload=(s:ReturnType<typeof emptyState>,e:Event,mode:'planned'|'round'|'live')=>({eventId:e.id,mode,expectedMode:schedulingMode(s,e),expectedPendingIds:pendingSchedulingIds(s,e.id)});
test('old planned and ordinary rounds retain their mode while an unscheduled activity defaults to planned',()=>{
 const {s,e}=fixture();assert.equal(schedulingMode(s,e),'planned');
 s.rounds=[{id:'live-only',eventId:e.id,start,duration:15,status:'complete',eligible:[],rest:[],seed:1,live:true}];assert.equal(schedulingMode(s,e),'live','an activity that only has live games stays live');const r:Round={id:'old',eventId:e.id,start,duration:15,status:'published',eligible:[],rest:[],seed:1,pointsSlot:1};s.rounds=[r];assert.equal(schedulingMode(s,e),'planned');r.status='cancelled';assert.equal(schedulingMode(s,e),'planned');delete r.pointsSlot;assert.equal(schedulingMode(s,e),'round');e.livePlay={enabled:true,paused:false,preferences:[],rest:[],completions:[]};assert.equal(schedulingMode(s,e),'live');
});
test('switching cancels only unstarted games and preserves active games, completed scores and break preferences',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'liveStart',{eventId:e.id},start);const current=s.matches[0],before=structuredClone(current);e.livePlay!.preferences=[{playerId:'p0',avoidConsecutive:true}];
 const r:Round={...s.rounds[0],id:'future',status:'draft',pointsSlot:1,start:start+30*minute};s.rounds.push(r);s.matches.push({...structuredClone(current),id:'future-game',roundId:r.id,status:'draft',start:null});
 await apply(s,owner,'schedulingMode',payload(s,e,'planned'),start+minute);assert.deepEqual(current,before);assert.equal(s.matches[1].status,'cancelled');assert.equal(r.status,'cancelled');assert.equal(e.livePlay!.enabled,false);assert.equal(e.livePlay!.preferences[0].avoidConsecutive,true);
 await apply(s,owner,'score',{matchId:current.id,a:21,b:19},start+2*minute);assert.equal(s.matches.length,2,'switching off live prevents automatic replacement');const scored=structuredClone(current);
 await apply(s,owner,'planPoints',{eventId:e.id,at:start+30*minute,pointsMinutes:30,roundMinutes:15,seed:7,pairing:'rotate'},start+3*minute);assert.deepEqual(current,scored);assert.equal(s.rounds.filter(r=>r.status==='draft').length,2);assert.equal(e.schedulingMode,'planned');
});
test('planned, legacy one-round and live workflows can be switched through with independent score advancement',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'schedulingMode',payload(s,e,'planned'),start-minute);
 await apply(s,owner,'planPoints',{eventId:e.id,at:start,pointsMinutes:60,roundMinutes:15,seed:1,pairing:'rotate'},start-minute);await apply(s,owner,'publishPoints',{eventId:e.id},start-minute);assert.equal(s.rounds.filter(r=>r.status==='published').length,4);
 const offered=structuredClone(s);await assert.rejects(()=>apply(s,owner,'schedulingMode',payload(s,e,'round'),start),/逐轮安排已停用/);assert.deepEqual(s,offered);
 // An activity that already used one-round mode before it was retired keeps working until it ends.
 cancelPendingScheduling(s,e.id);e.schedulingMode='round';assert.ok(s.rounds.every(r=>r.status==='cancelled'));
 await apply(s,owner,'generate',{eventId:e.id,at:start,duration:15,seed:2},start);const round=s.rounds.find(r=>r.status==='draft')!;await apply(s,owner,'publish',{roundId:round.id},start);await apply(s,owner,'start',{roundId:round.id,at:start,monthly:true,elo:true},start);
 await assert.rejects(()=>apply(s,owner,'generate',{eventId:e.id,at:start+minute,duration:15,seed:3},start+minute),/录完当前轮/);
 const m=s.matches.find(m=>m.status==='playing')!;await apply(s,owner,'score',{matchId:m.id,a:21,b:19},start+10*minute);assert.equal(s.matches.filter(m=>m.status==='playing').length,0);
 await apply(s,owner,'generate',{eventId:e.id,at:start+10*minute,duration:15,seed:3},start+10*minute);await apply(s,owner,'schedulingMode',payload(s,e,'live'),start+11*minute);assert.equal(e.livePlay?.enabled??false,false);
 await apply(s,owner,'liveStart',{eventId:e.id},start+11*minute);const live=s.matches.find(m=>m.status==='playing')!;const count=s.matches.length;await apply(s,owner,'score',{matchId:live.id,a:21,b:19},start+20*minute);assert.equal(s.matches.length,count,'the finished court waits for 开始组队');await apply(s,owner,'liveNext',{eventId:e.id,courtId:live.courtId,allowSame:true},start+20*minute);assert.equal(s.matches.length,count+1);assert.equal(s.matches.filter(m=>m.status==='playing').length,1);assert.equal(s.matches.find(x=>x.id===m.id)!.scoreA,21);
});
test('unauthorized, stale mode, changed pending IDs, practice and ended requests leave state untouched',async()=>{
 const {s,e,owner}=fixture();const p=payload(s,e,'live'),before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[2],'schedulingMode',p,start),/403/);assert.deepEqual(s,before);
 await apply(s,owner,'schedulingMode',p,start);const after=structuredClone(s);await assert.rejects(()=>apply(s,owner,'schedulingMode',p,start),/409/);assert.deepEqual(s,after);
 const stale=payload(s,e,'planned');s.matches.push({id:'new-draft',eventId:e.id,roundId:'pending',status:'draft'} as Match);const pending=structuredClone(s);await assert.rejects(()=>apply(s,owner,'schedulingMode',stale,start),/409/);assert.deepEqual(s,pending);
 e.status='ended';const ended=structuredClone(s);await assert.rejects(()=>apply(s,owner,'schedulingMode',payload(s,e,'planned'),e.end),/结束前/);assert.deepEqual(s,ended);e.status='open';e.matchFormat='practice';await assert.rejects(()=>apply(s,owner,'schedulingMode',payload(s,e,'planned'),start),/练球/);
});
test('a mixed round never cancels a playing or completed match when its remaining draft is withdrawn',()=>{
 const {s,e}=fixture();const r:Round={id:'mixed',eventId:e.id,start,duration:15,status:'playing',eligible:[],rest:[],seed:1};s.rounds=[r];s.matches=[{id:'running',roundId:r.id,eventId:e.id,status:'playing'},{id:'done',roundId:r.id,eventId:e.id,status:'complete',scoreA:21,scoreB:19},{id:'pending',roundId:r.id,eventId:e.id,status:'published'}] as Match[];assert.deepEqual(cancelPendingScheduling(s,e.id),['pending']);assert.deepEqual(s.matches.map(m=>m.status),['playing','complete','cancelled']);assert.equal(r.status,'playing');
});

test('remaining-time planning preserves the confirmed partner mode and previously fixed teams',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'planPoints',{eventId:e.id,at:start,pointsMinutes:15,roundMinutes:15,seed:3,pairing:'fixed'},start-minute);await apply(s,owner,'publishPoints',{eventId:e.id},start-minute);const first=s.rounds[0];await apply(s,owner,'start',{roundId:first.id,at:start,monthly:true,elo:true},start);const m=s.matches.find(m=>m.roundId===first.id)!;await apply(s,owner,'score',{matchId:m.id,a:21,b:19},start+10*minute);const teams=structuredClone(e.pointsChoice!.teams),before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'planPoints',{eventId:e.id,at:start+30*minute,pointsMinutes:30,roundMinutes:15,seed:4,pairing:'rotate'},start+11*minute),/保留已确认搭档/);assert.deepEqual(s,before);
 await apply(s,owner,'planPoints',{eventId:e.id,at:start+30*minute,pointsMinutes:30,roundMinutes:15,seed:4,pairing:'fixed'},start+11*minute);assert.deepEqual(e.pointsChoice!.teams,teams);assert.equal(m.scoreA,21);
});

test('a planned activity that nobody planned is planned, published and started on the clock, once',async()=>{
 const {s,e}=fixture();assert.equal(schedulingMode(s,e),'planned');
 assert.equal(await startDuePointsSessions(s,start-1,apply),false,'nothing happens before the activity starts');
 assert.equal(await startDuePointsSessions(s,start+20000,apply),true);
 const rounds=s.rounds.filter(r=>r.eventId===e.id&&r.status!=='cancelled');
 assert.ok(rounds.length>=7,'the whole two hours are planned');assert.ok(rounds.every(r=>r.pointsSlot!==undefined&&r.status!=='draft'),'and published');
 assert.equal(s.events[0].pointsPlan!.start,start+minute,'from the next whole minute');
 assert.equal(await startDuePointsSessions(s,start+minute,apply),true);assert.equal(s.matches.filter(m=>m.status==='playing').length,1,'the first game starts on the minute');
 assert.ok(s.audits.some(a=>a.action==='planPoints'&&a.actor==='system:points-clock'));
 const after=structuredClone(s);assert.equal(await startDuePointsSessions(s,start+minute+40000,apply),false);assert.deepEqual(s,after,'it never plans again');
});

test('a schedule planned before the start is kept, and starting by hand plans an unplanned activity first',async()=>{
 const planned=fixture();await apply(planned.s,planned.owner,'planPoints',{eventId:'e',at:start,pointsMinutes:30,roundMinutes:15,seed:5,pairing:'rotate'},start-minute);await apply(planned.s,planned.owner,'publishPoints',{eventId:'e'},start-minute);
 const ids=planned.s.rounds.map(r=>r.id);await startDuePointsSessions(planned.s,start+1000,apply);assert.deepEqual(planned.s.rounds.map(r=>r.id),ids);
 const manual=fixture();await apply(manual.s,manual.owner,'pointsStart',{eventId:'e',expectedMode:'planned',expectedPendingIds:[]},start+5*minute);
 assert.ok(manual.s.rounds.length>=6);assert.equal(manual.s.rounds[0].start,start+5*minute,'the rest of the activity from now');assert.equal(manual.s.matches.filter(m=>m.status==='playing').length,1);
});

async function liveFixture(){
 const f=fixture();f.s.bookings.push({id:'court-2',eventId:'e',name:'Court 2',start,end:f.e.end,pricing:'total',cents:1380});
 for(let i=8;i<10;i++){f.s.accounts.push({id:'member'+i,email:'',playerId:'p'+i,role:'member'});f.s.players.push({id:'p'+i,name:'p'+i,ownerId:'member'+i,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});f.s.registrations.push({...f.s.registrations[0],id:'reg'+i,playerId:'p'+i,sequence:i})}
 await apply(f.s,f.owner,'liveStart',{eventId:'e'},start+minute);
 const [m1,m2]=f.s.matches.filter(m=>m.status==='playing').sort((a,b)=>a.courtId.localeCompare(b.courtId));
 const bench=f.s.players.map(p=>p.id).filter(id=>![...m1.a,...m1.b,...m2.a,...m2.b].includes(id));
 const swap=(p1:string,p2:string,at=start+2*minute)=>apply(f.s,f.owner,'liveSwap',{eventId:'e',p1,p2,expectedLineup:liveLineupSnapshot(f.s,'e')},at);
 return {...f,m1,m2,bench,swap};
}

test('live play swaps players like a planned round: partners, the bench and across courts',async()=>{
 const {s,m1,m2,bench,swap}=await liveFixture();assert.equal(bench.length,2);
 const [a0,a1]=m1.a,[b0]=m1.b;
 await swap(a1,b0);assert.deepEqual([m1.a,m1.b],[[a0,b0],[a1,m1.b[1]]],'partners on one court');
 await swap(a0,bench[0]);assert.ok(m1.a.includes(bench[0])&&![...m1.a,...m1.b].includes(a0),'a waiting player comes on');
 const x=m1.b[0],y=m2.a[0];await swap(x,y);assert.ok(m1.b.includes(y)&&m2.a.includes(x),'players on two courts trade places');
 assert.equal(s.audits.filter(a=>a.action==='liveSwap').length,3);
 assert.ok(s.matches.every(m=>m.status!=='playing'||m.scoreA===null),'no game is completed');
});

test('a live swap rejects stale lineups, scored games, fixed partners, unavailable players and outsiders',async()=>{
 const {s,owner,m1,m2,bench,swap}=await liveFixture();
 const before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'liveSwap',{eventId:'e',p1:m1.a[0],p2:bench[0],expectedLineup:[]},start+2*minute),/409/);assert.deepEqual(s,before);
 await assert.rejects(()=>swap(bench[0],bench[1]),/正在场上/);
 await assert.rejects(()=>apply(s,{...s.accounts[1],id:'outsider',playerId:'unknown'},'liveSwap',{eventId:'e',p1:m1.a[0],p2:bench[0],expectedLineup:liveLineupSnapshot(s,'e')},start+2*minute),/403/);
 s.events[0].livePlay!.rest.push({playerId:bench[0],venue:s.events[0].venue,after:start});await assert.rejects(()=>swap(m1.a[0],bench[0]),/409/,'a player taking a break is not put on court');s.events[0].livePlay!.rest=[];
 m2.games=[{a:5,b:3}];await assert.rejects(()=>swap(m2.a[0],bench[0]),/已录分/);m2.games=[];
 s.events[0].pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed'};await assert.rejects(()=>swap(m1.a[0],bench[0]),/固定搭档/);
 assert.deepEqual(s.matches,before.matches);
});

test('with too few players at the start, planning waits for a signup or an arrival and never repeats a failed attempt',async()=>{
 const {s,owner}=fixture();s.registrations=s.registrations.slice(0,3);
 assert.equal(await startDuePointsSessions(s,start+1000,apply),true,'the start is recorded');assert.equal(s.rounds.length,0,'three players cannot be planned');
 const failed=structuredClone(s);assert.equal(await startDuePointsSessions(s,start+60000,apply),false);assert.deepEqual(s,failed,'nothing changed, so no new attempt');
 // A fourth player who arrives later: planning happens once they are present.
 s.registrations.push({...s.registrations[0],id:'late',playerId:'p3',sequence:3,arrival:start+30*minute});
 assert.equal(await startDuePointsSessions(s,start+2*minute,apply),true,'the new signup is remembered');assert.equal(s.rounds.length,0,'still three present');
 assert.equal(await startDuePointsSessions(s,start+30*minute+1000,apply),true);assert.ok(s.rounds.length>0,'planned once four are present');
 assert.equal(await startDuePointsSessions(s,start+31*minute,apply),true);assert.ok(s.matches.some(m=>m.status==='playing'),'and started on the next minute');
 // Cancelling a schedule on purpose is not undone by a later signup.
 const cancelled=fixture();await startDuePointsSessions(cancelled.s,start+1000,apply);for(const r of cancelled.s.rounds)if(r.status!=='complete')await apply(cancelled.s,owner,'cancelRound',{roundId:r.id},start+2000).catch(()=>{});
 cancelled.s.matches.filter(m=>m.status==='playing').forEach(m=>{m.status='cancelled'});cancelled.s.rounds.forEach(r=>{r.status='cancelled'});
 cancelled.s.registrations.push({...cancelled.s.registrations[0],id:'extra',playerId:'p8',sequence:9});const count=cancelled.s.rounds.length;
 await startDuePointsSessions(cancelled.s,start+3*minute,apply);assert.equal(cancelled.s.rounds.length,count);
});
