import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../lib/admin-simulation';
import {apply} from '../lib/domain/commands';
import {leaderboard,replayRating} from '../lib/domain/ranking';
import {startDuePointsSessions} from '../lib/domain/points-auto-start';
const now=Date.parse('2030-10-10T13:00:00Z'),minute=60000;

test('unchanged scheduled and occupied live courts do not clone the whole club during read maintenance',async()=>{
 for(const mode of ['live','round'] as const){
  const s=createSimulation(now).state,e=s.events[0];e.schedulingMode=mode;
  await startDuePointsSessions(s,now,apply);
  const before=structuredClone(s),clone=globalThis.structuredClone;let copies=0;
  globalThis.structuredClone=(...args)=>{copies++;return clone(...args)};
  try{assert.equal(await startDuePointsSessions(s,now+1000,apply),false)}finally{globalThis.structuredClone=clone}
  assert.deepEqual(s,before);assert.equal(copies,0,mode+' should use a read-only no-work guard');
 }
});

test('due clock starts live and first generated round once, with scheduled session time and actual match time',async()=>{
 for(const mode of ['live','round'] as const){
  const s=createSimulation(now).state,e=s.events[0];e.start=now-minute;e.schedulingMode=mode;
  assert.equal(await startDuePointsSessions(s,now,apply),true);assert.equal(s.events[0].pointsSession?.startedAt,e.start);
  assert.equal(s.matches.filter(m=>m.status==='playing').length,2);assert.ok(s.matches.every(m=>m.start===now));
  const before=structuredClone(s);assert.equal(await startDuePointsSessions(s,now+1,apply),false);assert.deepEqual(s,before);
  assert.ok(s.audits.filter(a=>a.action==='pointsAutoStart').length===1);
  for(const m of s.matches.filter(m=>m.status==='playing'))await apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:19},now+minute);
  if(mode==='round'){assert.equal(await startDuePointsSessions(s,now+2*minute,apply),false);assert.equal(s.rounds.length,1,'later rounds need explicit generate')}
 }
});
test('published planned slots start in order only after prior scores; drafts never publish implicitly',async()=>{
 const s=createSimulation(now).state,e=s.events[0],a=s.accounts[0];
 await apply(s,a,'planPoints',{eventId:e.id,at:now,pointsMinutes:30,roundMinutes:15,seed:1,pairing:'rotate'},now-1);
 assert.equal(await startDuePointsSessions(s,now,apply),true);assert.ok(s.matches.every(m=>m.status==='draft'));assert.ok(s.rounds.every(r=>r.status==='draft'));
 await apply(s,a,'publishPoints',{eventId:e.id},now);assert.equal(await startDuePointsSessions(s,now,apply),true);
 const first=s.rounds[0].id;assert.equal(s.matches.filter(m=>m.status==='playing').length,2);assert.equal(await startDuePointsSessions(s,now+16*minute,apply),false,'do not interrupt existing courts');
 for(const m of s.matches.filter(m=>m.roundId===first))await apply(s,a,'score',{matchId:m.id,a:21,b:19},now+16*minute);
 const history=structuredClone(s.matches.filter(m=>m.roundId===first));assert.equal(await startDuePointsSessions(s,now+17*minute,apply),true);
 assert.deepEqual(s.matches.filter(m=>m.roundId===first),history);assert.ok(s.matches.filter(m=>m.roundId!==first).every(m=>m.status==='playing'&&m.start===now+17*minute));
});
test('future, ended, deleted, draft, cancelled, practice and tournament activities never auto-start or replay',async()=>{
 for(const kind of ['future','window-future','ended','clock-ended','deleted','draft','cancelled','practice','tournament']){
  const s=createSimulation(now).state,e=s.events[0];
  if(kind==='future')e.start=now+minute;if(kind==='window-future')e.pointsPlan={start:now+minute,end:e.end,roundMinutes:15,seed:1,generatedAt:now};
  if(kind==='ended')e.status='ended';if(kind==='clock-ended')e.end=now;if(kind==='deleted')e.deletedAt=now;if(kind==='draft')e.status='draft';if(kind==='cancelled')e.status='cancelled';if(kind==='practice')e.matchFormat='practice';if(kind==='tournament')e.tournament={status:'draft'} as never;
  const before=structuredClone(s);assert.equal(await startDuePointsSessions(s,now,apply),false,kind);assert.deepEqual(s,before,kind);
 }
});
test('unavailable arrivals do not partially generate; paused live sessions are preserved',async()=>{
 const s=createSimulation(now).state,e=s.events[0];s.players.forEach(p=>p.enabled=false);e.schedulingMode='round';
 assert.equal(await startDuePointsSessions(s,now,apply),true);assert.equal(s.rounds.length,0);assert.equal(s.matches.length,0);assert.equal(s.audits.length,1);
 const before=structuredClone(s);assert.equal(await startDuePointsSessions(s,now+1,apply),false);assert.deepEqual(s,before);
 const live=createSimulation(now).state;await apply(live,live.accounts[0],'livePause',{eventId:live.events[0].id,paused:true},now);
 assert.equal(await startDuePointsSessions(live,now+1,apply),true);assert.equal(live.events[0].livePlay?.paused,true);assert.equal(live.matches.length,0);
});

test('live clock fills a later booking without a manual button, and a due switch keeps current games',async()=>{
 const s=createSimulation(now).state;s.bookings[1].start=now+minute;
 await startDuePointsSessions(s,now,apply);assert.equal(s.matches.length,1);const first=structuredClone(s.matches[0]);
 assert.equal(await startDuePointsSessions(s,now+minute,apply),true);assert.equal(s.matches.length,2);assert.deepEqual(s.matches[0],first);const before=structuredClone(s);assert.equal(await startDuePointsSessions(s,now+minute+1,apply),false);assert.deepEqual(s,before);
 const r=createSimulation(now).state; r.events[0].schedulingMode='round';await startDuePointsSessions(r,now,apply);const original=structuredClone(r.matches);
 await apply(r,r.accounts[0],'schedulingMode',{eventId:r.events[0].id,mode:'live',expectedMode:'round',expectedPendingIds:[]},now);
 assert.equal(await startDuePointsSessions(r,now,apply),true);assert.ok(r.events[0].livePlay?.enabled);assert.deepEqual(r.matches,original);
});
test('cancelled first-round drafts remain cancelled instead of being generated again on every read',async()=>{
 const s=createSimulation(now).state,e=s.events[0];e.schedulingMode='round';await apply(s,s.accounts[0],'generate',{eventId:e.id,at:now,duration:15,seed:1},now);
 await apply(s,s.accounts[0],'cancelRound',{roundId:s.rounds[0].id,reason:'Fixture cancellation'},now);await startDuePointsSessions(s,now,apply);assert.equal(s.rounds.length,1);assert.ok(s.matches.every(m=>m.status==='cancelled'));
});

test('published delayed rounds catch up after their planned end while activity and bookings remain available',async()=>{
 const s=createSimulation(now).state,e=s.events[0],a=s.accounts[0];await apply(s,a,'planPoints',{eventId:e.id,at:now,pointsMinutes:15,roundMinutes:15,seed:1,pairing:'rotate'},now-1);await apply(s,a,'publishPoints',{eventId:e.id},now);
 assert.equal(await startDuePointsSessions(s,now+20*minute,apply),true);assert.equal(s.matches.filter(m=>m.status==='playing').length,2);assert.ok(s.matches.every(m=>m.start===now+20*minute));
});

test('manual and automatic starts preserve early-scored or forfeited courts exactly and start only the other court',async()=>{
 for(const method of ['manual','automatic'] as const)for(const terminal of ['complete','forfeit'] as const){
  const s=createSimulation(now).state,e=s.events[0],a=s.accounts[0],scheduled=now+5*minute;
  await apply(s,a,'planPoints',{eventId:e.id,at:scheduled,pointsMinutes:15,roundMinutes:15,seed:4,pairing:'rotate'},now);
  await apply(s,a,'publishPoints',{eventId:e.id},now);
  const [recorded,pending]=s.matches,roundId=s.rounds[0].id;
  await apply(s,a,'score',{matchId:recorded.id,a:21,b:19,end:scheduled+minute},now+1);
  assert.equal(recorded.earlyScoreAt,now+1);assert.equal(s.rounds[0].status,'published');
  if(terminal==='forfeit')await apply(s,a,'void',{matchId:recorded.id,status:'forfeit',reason:'Fixture forfeit'},now+2);
  const recordedIds=[...recorded.a,...recorded.b];
  for(const playerId of recordedIds)await apply(s,a,'pointsParticipation',{eventId:e.id,playerId,playing:false},now+3);
  const facts=structuredClone(s.matches.find(m=>m.id===recorded.id)!),ratings=structuredClone(s.players.map(p=>({id:p.id,rating:p.rating,ratedGames:p.ratedGames})));
  if(method==='manual')await apply(s,a,'start',{roundId,at:scheduled+minute,monthly:true,elo:true},scheduled+minute);
  else assert.equal(await startDuePointsSessions(s,scheduled+minute,apply),true);
  assert.deepEqual(s.matches.find(m=>m.id===recorded.id),facts,method+' '+terminal+' exact preserved result');
  const active=s.matches.find(m=>m.id===pending.id)!;assert.equal(active.status,'playing');assert.equal(active.start,scheduled+minute);assert.equal(active.end,null);assert.deepEqual(active.games,[]);assert.equal(s.rounds[0].status,'playing');
  assert.deepEqual(s.players.map(p=>({id:p.id,rating:p.rating,ratedGames:p.ratedGames})),ratings,'start does not replay or duplicate ratings');
  await apply(s,a,'score',{matchId:pending.id,a:21,b:18},scheduled+2*minute);
  replayRating(s,scheduled+2*minute);assert.equal(s.rounds[0].status,'complete');assert.deepEqual(s.matches.find(m=>m.id===recorded.id),facts);
  for(const playerId of recordedIds)assert.equal(s.players.find(p=>p.id===playerId)!.ratedGames,terminal==='complete'?1:0,'the recorded court is counted once');
  for(const playerId of [...active.a,...active.b])assert.equal(s.players.find(p=>p.id===playerId)!.ratedGames,1,'the remaining court is counted once');
 }
});

test('cancelling a partly early-scored round cancels only pending courts and keeps results visible and counted',async()=>{
 for(const terminal of ['complete','forfeit'] as const){
  const s=createSimulation(now).state,e=s.events[0],a=s.accounts[0],scheduled=now+5*minute;
  await apply(s,a,'planPoints',{eventId:e.id,at:scheduled,pointsMinutes:15,roundMinutes:15,seed:6,pairing:'rotate'},now);await apply(s,a,'publishPoints',{eventId:e.id},now);
  const [recorded,pending]=s.matches,roundId=s.rounds[0].id;await apply(s,a,'score',{matchId:recorded.id,a:21,b:19,end:scheduled+minute},now+1);
  if(terminal==='forfeit')await apply(s,a,'void',{matchId:recorded.id,status:'forfeit',reason:'Fixture forfeit'},now+2);
  const facts=structuredClone(recorded),ratings=structuredClone(s.players.map(p=>({id:p.id,rating:p.rating,ratedGames:p.ratedGames}))),points=leaderboard(s,'2030-10',now+3).map(p=>({id:p.playerId,points:p.points,games:p.games}));
  await apply(s,a,'cancelRound',{roundId,reason:'Cancel only the unplayed court'},now+4);
  assert.deepEqual(s.matches.find(m=>m.id===recorded.id),facts);assert.equal(s.matches.find(m=>m.id===pending.id)!.status,'cancelled');assert.equal(s.rounds[0].status,'complete','a round with real results stays in completed history');
  replayRating(s,now+4);assert.deepEqual(s.players.map(p=>({id:p.id,rating:p.rating,ratedGames:p.ratedGames})),ratings);assert.deepEqual(leaderboard(s,'2030-10',now+4).map(p=>({id:p.playerId,points:p.points,games:p.games})),points);
 }
});
