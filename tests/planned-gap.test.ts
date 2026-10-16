import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from './helpers/scheduling-fixture';
import {apply} from '../lib/domain/commands';
import {advanceScheduledCourts,scheduledCourtProgress} from '../lib/domain/scheduled-courts';
import {startDuePointsSessions} from '../lib/domain/points-auto-start';
import {clubViewValidUntil} from '../lib/club-read-cache';
import type {Match,Round} from '../lib/domain/types';
const start=Date.parse('2030-10-10T09:00:00Z'),minute=60000,cut=start+120*minute;
function fixture(format:'singles'|'doubles'='doubles',fixed=false){
 const s=createSimulation(start).state,e=s.events[0],ids=s.players.map(p=>p.id);e.schedulingMode='planned';e.matchFormat=format;e.end=start+240*minute;e.pointsPlan={start,end:e.end,roundMinutes:15};e.pointsSession={startedAt:start,attendance:[],waiting:[]};
 s.bookings.forEach(b=>b.end=e.end);s.registrations.forEach((r,i)=>{r.departure=i===8||i===9?cut:e.end;if(i>=10)r.arrival=cut});
 if(fixed)e.pointsChoice={selectedMode:'fixed',votingOpen:false,votes:[],teams:Array.from({length:6},(_,i)=>ids.slice(i*2,i*2+2))};
 for(let n=0;n<2;n++){
  const r:Round={id:'r'+n,eventId:e.id,start:n?cut:start,duration:15,status:n?'published':'complete',eligible:ids.filter((_,i)=>n?i<8||i>=10:i<10),rest:[],seed:n+1,pointsSlot:n+1};s.rounds.push(r);
  for(let c=0;c<2;c++){
   const pick=format==='singles'?ids.slice(c*2,c*2+2):ids.slice(c*4,c*4+4),size=pick.length/2;
   const m:Match={id:'m'+n+c,eventId:e.id,roundId:r.id,courtId:s.bookings[c].id,a:pick.slice(0,size),b:pick.slice(size),status:n?'published':'complete',start:n?null:start,end:n?null:start+15*minute,scoreA:n?null:21,scoreB:n?null:19,games:n?[]:[{a:21,b:19}],monthly:true,elo:true,locked:false,enteredBy:n?null:s.accounts[0].id};s.matches.push(m);
  }
 }
 return {s,e,ids};
}
test('finishing the morning plan early starts new current-player games without changing the afternoon plan',async()=>{
 const {s,e,ids}=fixture(),at=cut-30*minute,future=structuredClone(s.matches.filter(m=>m.roundId==='r1')),regs=structuredClone(s.registrations);
 assert.ok(scheduledCourtProgress(s,e,at).gap);assert.equal(await startDuePointsSessions(s,at,apply),true);
 const active=s.matches.filter(m=>m.status==='playing');assert.equal(active.length,2);assert.ok(active.every(m=>m.start===at));assert.ok(active.flatMap(m=>[...m.a,...m.b]).every(id=>!ids.slice(10).includes(id)));
 assert.equal(new Set(active.flatMap(m=>[...m.a,...m.b])).size,8);assert.deepEqual(s.matches.filter(m=>m.roundId==='r1'),future);assert.deepEqual(s.registrations,regs);
 assert.equal(s.audits.filter(a=>a.action==='pointsGapFill').length,1);const saved=structuredClone(s);assert.equal(await startDuePointsSessions(s,at+1,apply),false);assert.deepEqual(s,saved);
 // The appended slot number exceeds the original afternoon slots. Scoring it
 // still refills the current phase instead of blocking behind the future queue.
 await apply(s,s.accounts[0],'score',{matchId:active[0].id,a:21,b:17},at+5*minute);
 const replacement=s.matches.find(m=>m.status==='playing'&&m.courtId===active[0].courtId&&m.id!==active[0].id)!;assert.ok(replacement);assert.equal(replacement.start,at+5*minute);
 assert.deepEqual(s.matches.filter(m=>m.roundId==='r1'),future);assert.equal(s.matches.filter(m=>m.status==='playing').length,2);
});
test('a gap game crossing 13:00 stays intact, then scoring switches to the confirmed new phase',async()=>{
 const {s,e,ids}=fixture(),at=cut-10*minute;assert.equal(advanceScheduledCourts(s,e,at),true);
 const gap=s.rounds.at(-1)!;assert.equal(gap.duration,10);
 const playing=structuredClone(s.matches.filter(m=>m.status==='playing'));
 assert.equal(await startDuePointsSessions(s,cut,apply),false);for(const m of playing)assert.deepEqual(s.matches.find(row=>row.id===m.id),m);
 for(const m of playing)await apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:19},cut+minute);
 assert.ok(s.matches.some(m=>m.roundId==='r1'&&m.status==='playing'));
 assert.ok(s.matches.filter(m=>m.status==='playing').flatMap(m=>[...m.a,...m.b]).every(id=>!ids.slice(8,10).includes(id)));
});
for(const [format,fixed] of [['singles',false],['doubles',true]] as const)test(`automatic gap games retain ${format}, fixed teams: ${fixed}`,()=>{
 const {s,e}=fixture(format,fixed);assert.equal(advanceScheduledCourts(s,e,cut-20*minute),true);
 const active=s.matches.filter(m=>m.status==='playing');assert.equal(active.length,2);assert.ok(active.every(m=>m.a.length===(format==='singles'?1:2)&&m.b.length===m.a.length));
 if(fixed)assert.ok(active.flatMap(m=>[m.a,m.b]).every(t=>e.pointsChoice!.teams!.some(team=>team.every(id=>t.includes(id)))));
});
test('gap filling does not bypass current pending lineups, future draft confirmation or an intentionally cancelled schedule',()=>{
 for(const kind of ['current-draft','current-published','future-draft','cancelled','no-future','absent','too-short','ended','future-fact'] as const){
  const {s,e,ids}=fixture();let at=cut-30*minute;
  if(kind==='current-draft'||kind==='current-published'){const status=kind==='current-draft'?'draft':'published';s.rounds[0].status=status;Object.assign(s.matches[0],{status,start:null,end:null,scoreA:null,scoreB:null,games:[]})}
  if(kind==='future-draft'){s.rounds[1].status='draft';s.matches.filter(m=>m.roundId==='r1').forEach(m=>m.status='draft')}
  if(kind==='cancelled'){s.rounds[0].status='cancelled';s.matches.filter(m=>m.roundId==='r0').forEach(m=>m.status='cancelled')}
  if(kind==='no-future'){s.rounds=s.rounds.slice(0,1);s.matches=s.matches.filter(m=>m.roundId==='r0')}
  if(kind==='absent')e.noShowHold=ids;
  if(kind==='too-short')at=cut-5*minute+1;
  if(kind==='ended')at=e.end;
  if(kind==='future-fact')s.matches.filter(m=>m.roundId==='r0').forEach(m=>m.end=cut);
  const before=structuredClone(s);assert.equal(scheduledCourtProgress(s,e,at).gap,undefined,kind);assert.deepEqual(s,before);
 }
});
test('physical courts and players occupied by another activity are unavailable for gap games',()=>{
 const {s,e,ids}=fixture(),other={...e,id:'other'};s.events.push(other);s.bookings.push({...s.bookings[0],id:'alias',eventId:other.id});
 s.matches.push({...s.matches[0],id:'foreign',eventId:other.id,roundId:'other-round',courtId:'alias',status:'playing',start:cut-40*minute,end:null,scoreA:null,scoreB:null,games:[],a:[ids[0],ids[1]],b:[ids[2],ids[3]]});
 assert.equal(advanceScheduledCourts(s,e,cut-30*minute),true);const active=s.matches.filter(m=>m.eventId===e.id&&m.status==='playing');assert.equal(active.length,1);assert.equal(active[0].courtId,s.bookings[1].id);assert.ok([...active[0].a,...active[0].b].every(id=>!ids.slice(0,4).includes(id)));
});
test('conditional reads expire at the exact final five-minute eligibility boundary',()=>{
 const {s}=fixture(),at=cut-5*minute;assert.ok(scheduledCourtProgress(s,s.events[0],at).gap);assert.equal(clubViewValidUntil(s,s.accounts[0],at),at+1);assert.equal(scheduledCourtProgress(s,s.events[0],at+1).gap,undefined);
});
test('paused and opted-out players are excluded from the actual gap proposal',()=>{
 const {s,e,ids}=fixture();s.attendance.push({id:'break',eventId:e.id,playerId:ids[0],state:'paused',start:cut-40*minute,end:null});e.matchingStopped=[ids[1]];
 assert.equal(advanceScheduledCourts(s,e,cut-30*minute),true);
 const active=s.matches.filter(m=>m.status==='playing');assert.equal(active.length,2);assert.ok(active.flatMap(m=>[...m.a,...m.b]).every(id=>id!==ids[0]&&id!==ids[1]));
});
