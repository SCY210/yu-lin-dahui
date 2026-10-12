import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../lib/admin-simulation';
import {apply} from '../lib/domain/commands';
import {applyPointsPlan} from '../lib/domain/points-plan';
const now=Date.parse('2030-10-10T13:00:00Z'),minute=60000;
const payload=(s:ReturnType<typeof createSimulation>['state'])=>({eventId:'sim-event',expectedRoundIds:s.rounds.filter(r=>r.status!=='cancelled').map(r=>r.id).sort()});
async function fixture(format:'doubles'|'singles'='doubles',fixed=false){
 const s=createSimulation(now).state,e=s.events[0],a=s.accounts[0];e.matchFormat=format;
 await apply(s,a,'planPoints',{eventId:e.id,at:now,pointsMinutes:15,roundMinutes:15,seed:1,pairing:fixed?'fixed':'rotate'},now);
 await apply(s,a,'publishPoints',{eventId:e.id},now);await apply(s,a,'start',{roundId:s.rounds[0].id,at:now,monthly:true,elo:true},now);
 for(const m of s.matches)await apply(s,a,'score',{matchId:m.id,a:21,b:19},now+10*minute);
 return {s,e,a};
}
test('completed preplan appends and immediately starts one round across two courts without rewriting history or changing mode',async()=>{
 const {s,e,a}=await fixture(),rounds=structuredClone(s.rounds),history=structuredClone(s.matches),bench=new Set(s.rounds[0].rest),stale=payload(s);
 await apply(s,a,'pointsNext',stale,now+16*minute);
 assert.deepEqual(s.rounds.slice(0,-1),rounds);assert.deepEqual(s.matches.slice(0,history.length),history);assert.equal(e.schedulingMode,'planned');assert.equal(s.rounds.length,2);assert.equal(s.rounds[1].pointsSlot,2);assert.equal(s.rounds[1].status,'playing');assert.equal(s.rounds[1].start,now+16*minute);assert.ok(s.events[0].pointsPlan!.end>=now+31*minute);assert.equal(s.events[0].pointsSession!.startedAt,now+16*minute);assert.ok(s.seasons.length>0);
 const added=s.matches.filter(m=>m.roundId===s.rounds[1].id);assert.equal(added.length,2);assert.ok(added.every(m=>m.monthly&&m.elo&&m.status==='playing'&&m.start===now+16*minute));assert.ok([...bench].every(id=>added.some(m=>[...m.a,...m.b].includes(id))));assert.equal(new Set(added.flatMap(m=>[...m.a,...m.b])).size,8);
 const before=structuredClone(s);await assert.rejects(()=>apply(s,a,'pointsNext',stale,now+16*minute),/409/);assert.deepEqual(s,before);await assert.rejects(()=>apply(s,a,'pointsNext',payload(s),now+16*minute),/请先录完/);assert.deepEqual(s,before);
 for(const m of added)await apply(s,a,'score',{matchId:m.id,a:21,b:18},now+20*minute);await apply(s,a,'pointsNext',payload(s),now+21*minute);assert.equal(s.rounds.at(-1)!.pointsSlot,3);
});
test('extra preplanned singles and fixed doubles preserve their team format and partners',async()=>{
 for(const fixed of [false,true]){const {s,e,a}=await fixture(fixed?'doubles':'singles',fixed),teams=structuredClone(e.pointsChoice?.teams);await apply(s,a,'pointsNext',payload(s),now+16*minute);const added=s.matches.filter(m=>m.roundId===s.rounds.at(-1)!.id);assert.equal(added.length,2);for(const m of added)for(const team of [m.a,m.b]){assert.equal(team.length,fixed?2:1);if(fixed)assert.ok(teams!.some(t=>t.length===team.length&&t.every(id=>team.includes(id))))}assert.deepEqual(e.pointsChoice?.teams,teams)}
});
test('unfinished, expired, wrong-mode, unauthorized and unavailable attempts preserve the whole state',async()=>{
 for(const kind of ['playing','published','ended','clock-ended','wrong-mode','member','no-courts','no-players','short-time','practice','tournament','deleted','future-score']){
  const {s,e,a}=await fixture();let at=now+16*minute,actor=a;
  if(kind==='playing'){s.matches[0].status='playing';s.rounds[0].status='playing'}
  if(kind==='published'){s.matches[0].status='published';s.rounds[0].status='published'}
  if(kind==='ended')e.status='ended';if(kind==='clock-ended')at=e.end;if(kind==='wrong-mode')e.schedulingMode='round';if(kind==='member')actor=s.accounts[1];if(kind==='no-courts')s.bookings=[];if(kind==='no-players')s.players.forEach(p=>p.enabled=false);if(kind==='short-time')e.end=at+4*minute;if(kind==='practice')e.matchFormat='practice';if(kind==='tournament')e.tournament={status:'draft'} as never;if(kind==='deleted')e.deletedAt=now;if(kind==='future-score')s.matches[0].end=at+minute;
  const before=structuredClone(s);await assert.rejects(()=>apply(s,actor,'pointsNext',payload(s),at),kind);assert.deepEqual(s,before,kind);
 }
});

test('a failure while auto-starting rolls back the entire addition and its publish audit',async()=>{const {s,a}=await fixture(),before=structuredClone(s);await assert.rejects(()=>applyPointsPlan(s,a,'pointsNext',payload(s),now+16*minute,async(work,actor,action,input,at)=>{if(action==='start')throw Error('injected start failure');return apply(work,actor,action,input,at)}),/injected start failure/);assert.deepEqual(s,before)});
