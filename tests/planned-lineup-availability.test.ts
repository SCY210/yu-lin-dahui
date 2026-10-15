import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from './helpers/scheduling-fixture';
import {roundBenchIds,swapRoundPlayers} from '../lib/domain/round-lineup';
import {validateRound} from '../lib/domain/grouping';
import type {Match,Round} from '../lib/domain/types';

const now=Date.parse('2026-10-15T18:00:00Z');
function fixture(){
 const s=createSimulation(now).state,e=s.events[0],ids=s.players.map(p=>p.id);e.schedulingMode='planned';
 const round:Round={id:'future',eventId:e.id,start:now+3600000,duration:15,status:'published',eligible:ids,rest:ids.slice(4),seed:1};
 const match:Match={id:'planned',eventId:e.id,roundId:round.id,courtId:s.bookings[0].id,a:ids.slice(0,2),b:ids.slice(2,4),status:'published',start:null,end:null,scoreA:null,scoreB:null,games:[],locked:false,enteredBy:null,monthly:false,elo:false};
 s.rounds=[round];s.matches=[match];
 const current:Match={...structuredClone(match),id:'current',roundId:'current-round',status:'playing',start:now,a:[ids[0],ids[4]],b:[ids[5],ids[6]]};s.matches.push(current);
 return {s,e,ids,round,match,current};
}

test('planned swaps and bench choices ignore current occupancy while real starts still reject busy players',()=>{
 for(const status of ['draft','published'] as const){
  const {s,e,ids,round,match,current}=fixture();round.status=status;match.status=status;
  const original=structuredClone(current);assert.ok(roundBenchIds(s,e,round).includes(ids[4]));
  swapRoundPlayers(s,round,ids[0],ids[4],now);
  assert.equal(match.a[0],ids[4]);assert.equal(round.status,status);assert.equal(match.status,status);assert.deepEqual(current,original);
  assert.throws(()=>validateRound(s,e.id,round.start,round.duration,[match]),/正在比赛/,'starting uses the original live-occupancy check');
  current.status='complete';assert.doesNotThrow(()=>validateRound(s,e.id,round.start,round.duration,[match]));
 }
});

test('pre-activity edits work and actual signup-window violations remain atomic',()=>{
 const {s,e,ids,round,match}=fixture();
 assert.doesNotThrow(()=>swapRoundPlayers(s,round,ids[0],ids[1],e.start-60000));
 s.registrations.find(r=>r.playerId===ids[1])!.departure=round.start+60000;
 const before=structuredClone(s);assert.throws(()=>swapRoundPlayers(s,round,ids[1],ids[2],now),/参加时段/);assert.deepEqual(s,before);
 match.status='playing';match.start=now;assert.throws(()=>swapRoundPlayers(s,round,ids[1],ids[2],now),/已开始或已录分/);
});
