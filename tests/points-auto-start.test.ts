import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../lib/admin-simulation';
import {apply} from '../lib/domain/commands';
import {startDuePointsSessions} from '../lib/domain/points-auto-start';
const now=Date.parse('2030-10-10T13:00:00Z'),minute=60000;

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
