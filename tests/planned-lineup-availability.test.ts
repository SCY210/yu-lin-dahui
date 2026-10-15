import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from './helpers/scheduling-fixture';
import {roundBenchIds,swapRoundPlayers} from '../lib/domain/round-lineup';
import {validateRound} from '../lib/domain/grouping';
import {advanceScheduledCourts} from '../lib/domain/scheduled-courts';
import type {Match,Round} from '../lib/domain/types';
const now=Date.parse('2026-10-15T18:00:00Z');
function fixture(){
 const s=createSimulation(now).state,e=s.events[0],ids=s.players.map(p=>p.id);e.schedulingMode='planned';
 const round:Round={id:'future',eventId:e.id,start:now+3600000,duration:15,status:'published',eligible:ids,rest:ids.slice(4),seed:1,pointsSlot:1};
 const match:Match={id:'planned',eventId:e.id,roundId:round.id,courtId:s.bookings[0].id,a:ids.slice(0,2),b:ids.slice(2,4),status:'published',start:null,end:null,scoreA:null,scoreB:null,games:[],locked:false,enteredBy:null,monthly:false,elo:false};
 s.rounds=[round];s.matches=[match];
 const current:Match={...structuredClone(match),id:'current',roundId:'current-round',status:'playing',start:now,a:[ids[0],ids[4]],b:[ids[5],ids[6]]};s.matches.push(current);
 return {s,e,ids,round,match,current};
}
test('planned swaps ignore current occupancy while actual starts still reject busy players',()=>{
 for(const status of ['draft','published','playing'] as const){
  const {s,e,ids,round,match,current}=fixture();round.status=status;match.status=status==='playing'?'published':status;
  const original=structuredClone(current);assert.ok(roundBenchIds(s,e,round).includes(ids[4]));
  swapRoundPlayers(s,round,ids[0],ids[4],now);assert.equal(match.a[0],ids[4]);assert.equal(round.status,status);assert.deepEqual(current,original);
  assert.throws(()=>validateRound(s,e.id,round.start,round.duration,[match]),/正在比赛/);
  current.status='complete';assert.doesNotThrow(()=>validateRound(s,e.id,round.start,round.duration,[match]));
 }
});
test('there is no editing time window before, during or after activity and scheduled participation times',()=>{
 for(const phase of ['draft','future','late','ended'] as const){
  const {s,e,ids,round,match,current}=fixture();
  if(phase==='draft')e.status='draft';if(phase==='ended')e.status='ended';
  const reg=s.registrations.find(r=>r.playerId===ids[8])!;reg.arrival=now+2*3600000;reg.departure=now+3*3600000;
  const at=phase==='draft'?e.start-86400000:phase==='late'?round.start+2*3600000:phase==='ended'?e.end+3600000:now;
  const before=structuredClone(current);assert.ok(roundBenchIds(s,e,round,at).includes(ids[8]),phase);
  assert.doesNotThrow(()=>swapRoundPlayers(s,round,ids[1],ids[8],at),phase);assert.equal(match.a[1],ids[8]);assert.deepEqual(current,before);
  assert.equal(match.status,'published');assert.equal(match.start,null);
 }
});
test('accepting a planned future arrival never starts that player outside their actual participation window',()=>{
 const {s,e,ids,round,match,current}=fixture();current.status='complete';current.end=now;
 const reg=s.registrations.find(r=>r.playerId===ids[8])!;reg.arrival=round.start+60000;
 swapRoundPlayers(s,round,ids[1],ids[8],now);assert.equal(advanceScheduledCourts(s,e,round.start),false);
 assert.equal(match.status,'published');assert.equal(advanceScheduledCourts(s,e,reg.arrival),true);assert.equal(match.status,'playing');
});
test('waiting-list people are excluded; unscored legacy playing/locked plans can change and scored facts remain protected',()=>{
 const {s,e,ids,round,match}=fixture();s.registrations.find(r=>r.playerId===ids[8])!.status='waitlist';assert.ok(!roundBenchIds(s,e,round).includes(ids[8]));
 const before=structuredClone(s);assert.throws(()=>swapRoundPlayers(s,round,ids[1],ids[8],now));assert.deepEqual(s,before);
 match.status='playing';match.start=now;round.status='playing';match.locked=true;assert.doesNotThrow(()=>swapRoundPlayers(s,round,ids[1],ids[2],now));assert.equal(match.locked,false);assert.equal(match.status,'playing');assert.equal(match.start,now);
 match.status='complete';match.games=[{a:21,b:18}];match.scoreA=21;match.scoreB=18;
 assert.throws(()=>swapRoundPlayers(s,round,ids[1],ids[2],now),/已录分或已结束/);
});
