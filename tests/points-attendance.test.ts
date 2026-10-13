import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Event,type Match} from '../lib/domain/types';
import {schedulingMode,pendingSchedulingIds} from '../lib/domain/scheduling';
import {attendancePointAdjustments,awaitingArrival} from '../lib/domain/points-attendance';
import {doublesLeaderboard,singlesLeaderboard} from '../lib/domain/ranking';
import {liveAppearances,livePresentIds} from '../lib/domain/live-play';
const now=Date.parse('2030-10-10T13:00:00Z');
function fixture(count=8,singles=false){const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';s.accounts=Array.from({length:count},(_,i)=>({id:i?'m'+i:'owner',email:'',playerId:'p'+i,role:i?'member' as const:'admin' as const}));s.players=s.accounts.map(a=>({id:a.playerId,name:a.playerId,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));const e:Event={id:'e',creatorId:'owner',matchFormat:singles?'singles':'doubles',title:'Fictional points attendance',start:now-600000,end:now+7200000,venue:'Fixture venue',address:'',capacity:count,signupDeadline:now,cancelDeadline:now-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};s.events=[e];s.bookings=[{id:'court',eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:1380}];s.registrations=s.players.map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));return {s,a:s.accounts[0]}}
const start=(s:ReturnType<typeof emptyState>)=>({eventId:'e',expectedMode:schedulingMode(s,s.events[0]),expectedPendingIds:pendingSchedulingIds(s,'e')});
const late=(m:Match,replacement:'player'|'group'='player')=>({matchId:m.id,playerId:m.a[0],expectedA:[...m.a],expectedB:[...m.b],replacement});
test('one start button begins live, generated round or first planned round and repeated start does not create games',async()=>{
 for(const mode of ['live','round','planned'] as const){const {s,a}=fixture();s.events[0].schedulingMode=mode;if(mode==='planned')await apply(s,a,'planPoints',{eventId:'e',at:now,pointsMinutes:30,roundMinutes:15,pairing:'rotate',seed:2},now-1);await apply(s,a,'pointsStart',start(s),now);assert.ok(s.events[0].pointsSession!.startedAt);assert.equal(s.matches.filter(m=>m.status==='playing').length,1);const before=structuredClone(s);await apply(s,a,'pointsStart',start(s),now+1);assert.deepEqual(s,before)}
});
test('single late replacement retains the other three, deducts exactly one doubles point and never changes wins or 修为',async()=>{
 const {s,a}=fixture();await apply(s,a,'pointsStart',start(s),now);const m=s.matches[0],payload=late(m),original=[...m.a,...m.b],ratings=structuredClone(s.players);await apply(s,a,'pointsLate',payload,now+1000);const next=s.matches.find(m=>m.status==='playing')!;assert.equal(s.matches.find(x=>x.id===m.id)!.status,'cancelled');assert.deepEqual(new Set([...next.a,...next.b].filter(id=>original.includes(id))),new Set(original.filter(id=>id!==payload.playerId)));assert.equal(next.a.length,2);assert.equal(next.start,now+1000);assert.equal(liveAppearances(s,'e',payload.playerId),0);assert.equal(awaitingArrival(s.events[0],payload.playerId),true);assert.ok(!livePresentIds(s,s.events[0],now+1000).includes(payload.playerId));assert.deepEqual(s.players,ratings);
 const board=doublesLeaderboard(s,'2030-10',now+1001).find(r=>r.playerId===payload.playerId)!;assert.equal(board.points,-1);assert.equal(board.attendancePoints,-1);assert.equal(board.games,0);assert.equal(board.wins,0);assert.equal(board.losses,0);assert.equal(singlesLeaderboard(s,'2030-10',now+1001).length,0);
 const before=structuredClone(s);await assert.rejects(()=>apply(s,a,'pointsLate',payload,now+2000),/尚未录分/);assert.deepEqual(s,before);
 await apply(s,a,'pointsPresence',{eventId:'e',playerId:payload.playerId,status:'arrived'},now+3000);assert.equal(awaitingArrival(s.events[0],payload.playerId),false);assert.equal(doublesLeaderboard(s,'2030-10',now+3001).find(r=>r.playerId===payload.playerId)!.points,-1);
 await apply(s,a,'pointsPresence',{eventId:'e',playerId:payload.playerId,status:'clear-late'},now+4000);await apply(s,a,'pointsPresence',{eventId:'e',playerId:payload.playerId,status:'clear-late'},now+5000);assert.equal(attendancePointAdjustments(s).reduce((n,g)=>n+g.delta,0),0);assert.equal(doublesLeaderboard(s,'2030-10',now+5001).find(r=>r.playerId===payload.playerId)!.points,0);
});
test('not enough substitutes waits without fake results, late points persist and retry resumes after arrival',async()=>{
 const {s,a}=fixture(4);await apply(s,a,'pointsStart',start(s),now);const m=s.matches[0],p=late(m);await apply(s,a,'pointsLate',p,now+1000);assert.equal(s.matches.filter(m=>m.status==='playing').length,0);assert.equal(s.events[0].pointsSession!.waiting.length,1);assert.ok(s.matches.every(m=>m.scoreA===null&&m.scoreB===null));assert.equal(attendancePointAdjustments(s).reduce((n,g)=>n+g.delta,0),-1);
 await apply(s,a,'pointsReplace',{eventId:'e',matchId:m.id,replacement:'player'},now+2000);assert.equal(s.events[0].pointsSession!.waiting.length,1);assert.equal(attendancePointAdjustments(s).reduce((n,g)=>n+g.delta,0),-1);
 await apply(s,a,'pointsPresence',{eventId:'e',playerId:p.playerId,status:'arrived'},now+3000);await apply(s,a,'pointsReplace',{eventId:'e',matchId:m.id,replacement:'player'},now+4000);assert.equal(s.events[0].pointsSession!.waiting.length,0);assert.equal(s.matches.filter(m=>m.status==='playing').length,1);const before=structuredClone(s);await assert.rejects(()=>apply(s,a,'pointsReplace',{eventId:'e',matchId:m.id,replacement:'player'},now+5000),/409/);assert.deepEqual(s,before);
});
test('whole-group option uses the bench only, and a late singles signup affects the singles board only',async()=>{
 const {s,a}=fixture();await apply(s,a,'pointsStart',start(s),now);const m=s.matches[0],original=new Set([...m.a,...m.b]);await apply(s,a,'pointsLate',late(m,'group'),now+1000);assert.ok(s.matches.find(m=>m.status==='playing')!.a.concat(s.matches.find(m=>m.status==='playing')!.b).every(id=>!original.has(id)));
 const f=fixture(4,true);await apply(f.s,f.a,'pointsStart',start(f.s),now);const p=late(f.s.matches[0]);await apply(f.s,f.a,'pointsLate',p,now+1000);assert.equal(singlesLeaderboard(f.s,'2030-10',now+2000).find(r=>r.playerId===p.playerId)!.points,-1);assert.equal(doublesLeaderboard(f.s,'2030-10',now+2000).find(r=>r.playerId===p.playerId)!.points,0);
});
test('members, stale teams, ended activities, scored matches and wrong event IDs cannot mutate attendance or points',async()=>{
 const {s,a}=fixture();const before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[1],'pointsStart',start(s),now),/403/);assert.deepEqual(s,before);await apply(s,a,'pointsStart',start(s),now);const m=s.matches[0],p=late(m),started=structuredClone(s),outsider=s.accounts.find(x=>![...m.a,...m.b].includes(x.playerId))!;await assert.rejects(()=>apply(s,outsider,'pointsLate',{...p,eventId:'forged'},now+1000),/403/);assert.deepEqual(s,started);await assert.rejects(()=>apply(s,a,'pointsLate',{...p,expectedA:[...p.expectedA].reverse()},now+1000),/409/);assert.deepEqual(s,started);
 await apply(s,a,'score',{matchId:m.id,a:21,b:19},now+1000);const scored=structuredClone(s);await assert.rejects(()=>apply(s,a,'pointsLate',p,now+2000),/已完成/);assert.deepEqual(s,scored);await assert.rejects(()=>apply(s,a,'pointsPresence',{eventId:'e',playerId:p.playerId,status:'arrived'},s.events[0].end),/活动进行时/);assert.deepEqual(s,scored);
});
test('late replacement respects other current courts and never changes a completed score or creates an extra live round after scoring correction',async()=>{
 const {s,a}=fixture(12);s.bookings.push({...s.bookings[0],id:'court2',name:'Court2'});await apply(s,a,'pointsStart',start(s),now);const first=s.matches[0],other=s.matches[1],otherBefore=structuredClone(other);await apply(s,a,'pointsLate',late(first),now+1000);assert.deepEqual(s.matches.find(m=>m.id===other.id),otherBefore);const next=s.matches.find(m=>m.status==='playing'&&m.id!==other.id)!;assert.ok([...next.a,...next.b].every(id=>![...other.a,...other.b].includes(id)));await apply(s,a,'score',{matchId:next.id,a:21,b:19},now+2000);const count=s.matches.length;await apply(s,a,'score',{matchId:next.id,a:19,b:21},now+3000);assert.equal(s.matches.length,count);
});
test('a due preplanned draft can replace a late player, then publish and start without resurrecting the withdrawn lineup',async()=>{
 const {s,a}=fixture();await apply(s,a,'planPoints',{eventId:'e',at:now,pointsMinutes:30,roundMinutes:15,pairing:'rotate',seed:2},now-1);await apply(s,a,'pointsStart',start(s),now);const first=s.matches.find(m=>m.status==='playing')!;await apply(s,a,'score',{matchId:first.id,a:21,b:19},now+60000);const pending=s.matches.find(m=>m.status==='draft')!,roundId=pending.roundId,p=late(pending);await apply(s,a,'pointsLate',p,now+16*60000);await apply(s,a,'publish',{roundId},now+16*60000);await apply(s,a,'start',{roundId,at:now+16*60000,monthly:true,elo:true},now+16*60000);assert.equal(s.matches.find(m=>m.id===pending.id)!.status,'cancelled');assert.equal(s.matches.filter(m=>m.roundId===roundId&&m.status==='playing').length,1);assert.ok(!s.matches.find(m=>m.roundId===roundId&&m.status==='playing')!.a.concat(s.matches.find(m=>m.roundId===roundId&&m.status==='playing')!.b).includes(p.playerId));assert.equal(s.matches.find(m=>m.id===first.id)!.scoreA,21);
});

test('normal live refill clears a stale waiting notice without charging another point',async()=>{
 const {s,a}=fixture(4);await apply(s,a,'pointsStart',start(s),now);const p=late(s.matches[0]);await apply(s,a,'pointsLate',p,now+1000);await apply(s,a,'pointsPresence',{eventId:'e',playerId:p.playerId,status:'arrived'},now+2000);await apply(s,a,'liveStart',{eventId:'e'},now+3000);assert.equal(s.events[0].pointsSession!.waiting.length,0);assert.equal(s.matches.filter(m=>m.status==='playing').length,1);assert.equal(attendancePointAdjustments(s).reduce((n,g)=>n+g.delta,0),-1);
});
test('everyone is present by default; a player of the same match can report a late player, who can report their own arrival',async()=>{
 const {s,a}=fixture();await apply(s,a,'pointsStart',start(s),now);
 const m=s.matches.find(m=>m.status==='playing')!,members=[...m.a,...m.b].filter(id=>id!=='p0'),lateId=members[0],reporter=s.accounts.find(x=>x.playerId===members[1])!,outsider=s.accounts.find(x=>x.id!=='owner'&&![...m.a,...m.b].includes(x.playerId))!;
 const lateInput={matchId:m.id,playerId:lateId,expectedA:[...m.a],expectedB:[...m.b],replacement:'player' as const};
 assert.ok(livePresentIds(s,s.events[0],now).length===8,'nobody needs to confirm arrival to be scheduled');
 const before=structuredClone(s);
 await assert.rejects(()=>apply(s,outsider,'pointsLate',lateInput,now+1000),/403/,'a player of another match cannot report');
 await assert.rejects(()=>apply(s,s.accounts.find(x=>x.playerId===lateId)!,'pointsLate',lateInput,now+1000),/403/,'the late player cannot report themselves');
 assert.deepEqual(s,before);
 await apply(s,reporter,'pointsLate',lateInput,now+1000);assert.equal(awaitingArrival(s.events[0],lateId),true);
 await assert.rejects(()=>apply(s,outsider,'pointsPresence',{eventId:'e',playerId:lateId,status:'arrived'},now+2000),/403/);
 await assert.rejects(()=>apply(s,s.accounts.find(x=>x.playerId===lateId)!,'pointsPresence',{eventId:'e',playerId:lateId,status:'clear-late'},now+2000),/403/,'only organisers refund a mistaken mark');
 await apply(s,s.accounts.find(x=>x.playerId===lateId)!,'pointsPresence',{eventId:'e',playerId:lateId,status:'arrived'},now+2000);
 assert.equal(awaitingArrival(s.events[0],lateId),false);
});
