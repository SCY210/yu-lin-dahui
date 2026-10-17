import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../lib/admin-simulation';
import {apply} from '../lib/domain/commands';
import {startDuePointsSessions} from '../lib/domain/points-auto-start';
import {maxConsecutiveRounds} from '../lib/domain/grouping';
import {liveStreaks} from '../lib/domain/live-play';
import type {Match} from '../lib/domain/types';

const minute=60000,base=Date.parse('2026-10-14T16:00:00Z'),ids=(m:Match)=>[...m.a,...m.b];
/** A two-hour planned schedule of 15-minute rounds on the given courts, every game scored after 12 minutes. */
async function plannedRun(count:number,courts:number,format:'doubles'|'singles'='doubles'){
 const s=createSimulation(base).state,e=s.events[0];e.schedulingMode='planned';delete e.livePlay;e.matchFormat=format;
 s.registrations=s.registrations.slice(0,count);s.bookings=s.bookings.slice(0,courts);
 await apply(s,s.accounts[0],'planPoints',{eventId:e.id,at:e.start,pointsMinutes:120,roundMinutes:15,seed:5,pairing:'rotate'},e.start-minute);
 await apply(s,s.accounts[0],'publishPoints',{eventId:e.id},e.start-minute);
 for(let t=e.start;t<e.start+120*minute;t+=minute){
  await startDuePointsSessions(s,t,apply);
  for(const m of s.matches.filter(m=>m.status==='playing'&&t-(m.start??t)>=12*minute))await apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:17},t);
 }
 return {s,games:s.matches.filter(m=>m.status==='complete'),players:s.registrations.map(r=>r.playerId)};
}

test('one court: the planned schedule mixes everyone instead of repeating fixed groups of four',async()=>{
 for(const count of [8,12]){
  const {games,players}=await plannedRun(count,1);
  const groups=new Set(games.map(m=>ids(m).sort().join()));
  assert.equal(groups.size,games.length,count+' players: no group of four plays together twice');
  const played=players.map(p=>games.filter(m=>ids(m).includes(p)).length);
  assert.ok(Math.max(...played)-Math.min(...played)<=1,'turns stay fair');
  const met=players.map(p=>new Set(games.filter(m=>ids(m).includes(p)).flatMap(ids)).size-1);
  assert.ok(Math.min(...met)>=Math.min(count-1,5),count+' players: everyone meets several others, not only a fixed three');
 }
});

test('one court of singles rotates opponents',async()=>{
 const {games,players}=await plannedRun(4,1,'singles');
 const pairs=new Map<string,number>();for(const m of games){const k=ids(m).sort().join();pairs.set(k,(pairs.get(k)??0)+1)}
 assert.equal(pairs.size,6,'all six pairings of four players appear');
 const played=players.map(p=>games.filter(m=>ids(m).includes(p)).length);
 assert.ok(Math.max(...played)-Math.min(...played)<=1);
});

test('live play: after three games in a row a player rests whenever somebody else can play',async()=>{
 for(const count of [11,12]){
  const s=createSimulation(base).state,e=s.events[0];s.registrations=s.registrations.slice(0,count);
  await apply(s,s.accounts[0],'liveStart',{eventId:e.id},e.start+minute);
  let longest=0;
  for(let t=e.start+2*minute;t<e.start+150*minute;t+=minute){
   // Courts finish at different times, and every waiting court is started at once.
   for(const m of s.matches.filter(m=>m.status==='playing'&&t-(m.start??t)>=(m.courtId===s.bookings[0].id?11:14)*minute))await apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:17},t);
   for(const c of s.bookings)if(!s.matches.some(m=>m.status==='playing'&&m.courtId===c.id))try{await apply(s,s.accounts[0],'liveNext',{eventId:e.id,courtId:c.id},t)}catch{/* waiting for another court */}
   longest=Math.max(longest,...liveStreaks(s,e.id).values());
  }
  assert.ok(longest<=maxConsecutiveRounds,count+' players: longest run '+longest);
 }
});
