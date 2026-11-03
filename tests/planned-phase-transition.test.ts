import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from './helpers/scheduling-fixture';
import {apply} from '../lib/domain/commands';
import {advanceScheduledCourts,scheduledCourtProgress} from '../lib/domain/scheduled-courts';
import {startDuePointsSessions} from '../lib/domain/points-auto-start';
import {clubViewValidUntil} from '../lib/club-read-cache';
import {calculateSettlement} from '../lib/domain/money';
import type {Round} from '../lib/domain/types';

const start=Date.parse('2030-10-10T09:00:00Z'),minute=60000,boundary=start+120*minute+1234;
function fixture(){
 const s=createSimulation(start).state,e=s.events[0];e.schedulingMode='planned';e.end=start+240*minute;
 e.pointsSession={startedAt:start,attendance:[],waiting:[]};e.pointsPlan={start,end:e.end,roundMinutes:15};
 s.bookings.forEach(b=>b.end=e.end);s.registrations.forEach((r,i)=>{r.departure=i===8||i===9?boundary:e.end;if(i>=10)r.arrival=boundary});
 const ids=s.players.map(p=>p.id);
 for(let n=0;n<4;n++){
  const r:Round={id:'r'+n,eventId:e.id,start:n===0?start:n===1?start+60*minute:boundary+(n-2)*30*minute,duration:15,status:'published',eligible:ids,rest:[],seed:n+1,pointsSlot:n+1};s.rounds.push(r);
  for(let c=0;c<2;c++){
   const selected=c===0?[ids[0],ids[6],ids[n<2?8:10],ids[n<2?9:11]]:[ids[2],ids[3],ids[4],ids[5]];
   s.matches.push({id:'m'+n+c,eventId:e.id,roundId:r.id,courtId:s.bookings[c].id,a:selected.slice(0,2),b:selected.slice(2),status:'published',start:null,end:null,scoreA:null,scoreB:null,games:[],monthly:true,elo:true,locked:false,enteredBy:null});
  }
 }
 return {s,e,ids,m:(id:string)=>s.matches.find(m=>m.id===id)!};
}

test('at the attendance boundary stale unstarted courts expire and the afternoon schedule starts',async()=>{
 const {s,e,m}=fixture(),beforeRegistrations=structuredClone(s.registrations),beforePlayers=structuredClone(s.players),fees=calculateSettlement(s,e,boundary);
 const snapshot=structuredClone(s);assert.equal(scheduledCourtProgress(s,e,boundary-1).expired.length,0);assert.deepEqual(s,snapshot,'eligibility is read-only');
 assert.equal(await startDuePointsSessions(s,boundary,apply),true);
 assert.ok(s.matches.filter(m=>['r0','r1'].includes(m.roundId)).every(m=>m.status==='cancelled'&&m.start===null&&m.end===null&&m.scoreA===null&&m.scoreB===null));
 assert.deepEqual(s.rounds.slice(0,2).map(r=>r.status),['cancelled','cancelled']);
 assert.equal(m('m20').status,'playing');assert.equal(m('m21').status,'playing');assert.equal(m('m20').start,boundary);
 assert.equal(s.matches.filter(m=>m.status==='playing').length,2);assert.equal(new Set(s.matches.filter(m=>m.status==='playing').flatMap(m=>[...m.a,...m.b])).size,8);
 assert.deepEqual(s.registrations,beforeRegistrations);assert.deepEqual(s.players,beforePlayers);assert.deepEqual(calculateSettlement(s,e,boundary),fees);
 assert.equal(s.audits.filter(a=>a.action==='pointsPhaseAdvance').length,1);
 const saved=structuredClone(s);assert.equal(await startDuePointsSessions(s,boundary+1,apply),false);assert.deepEqual(s,saved,'repeated polls never expire or start twice');
});

test('a still-playing morning court continues while the free court switches, then scoring releases its afternoon match',async()=>{
 const {s,m}=fixture();s.rounds[0].status='playing';Object.assign(m('m00'),{status:'playing',start});
 Object.assign(m('m01'),{status:'complete',start,end:start+minute,scoreA:21,scoreB:19,games:[{a:21,b:19}]});
 const ongoing=structuredClone(m('m00')),recorded=structuredClone(m('m01'));
 assert.equal(await startDuePointsSessions(s,boundary,apply),true);
 assert.deepEqual(m('m00'),ongoing);assert.deepEqual(m('m01'),recorded);assert.equal(s.rounds[0].status,'playing');
 assert.equal(m('m20').status,'published','players on the ongoing court remain busy');assert.equal(m('m21').status,'playing');
 await apply(s,s.accounts[0],'score',{matchId:'m00',a:21,b:17},boundary+minute);
 assert.equal(m('m00').status,'complete');assert.equal(m('m20').status,'playing');assert.equal(m('m20').start,boundary+minute);
});

test('fast morning scores cannot start the next attendance phase early',()=>{
 const {s,e,m}=fixture();for(const old of s.matches.filter(m=>['r0','r1'].includes(m.roundId)))Object.assign(old,{status:'complete',start,end:boundary-2,scoreA:21,scoreB:19});s.rounds.slice(0,2).forEach(r=>r.status='complete');
 // This next-phase court contains only full-time players, so attendance alone
 // would allow it early. The phase boundary still applies to the whole lineup.
 assert.equal(scheduledCourtProgress(s,e,boundary-1).ready.length,0);
 assert.equal(advanceScheduledCourts(s,e,boundary),true);assert.equal(m('m21').start,boundary);
});

test('expiration is persisted even when a hand-edited next phase cannot start yet',async()=>{
 const {s,e,m,ids}=fixture();s.matches.filter(m=>['r2','r3'].includes(m.roundId)).forEach(m=>m.a[0]=ids[10]);e.noShowHold=[ids[10]];
 // An organiser's swap keeps its lineup: the rounds are not planned again around the held player.
 for(const roundId of ['r2','r3'])s.audits.push({id:'swap-'+roundId,at:start,actor:s.accounts[0].id,action:'swap',reason:'swap 操作',changes:{roundId,p1:ids[1],p2:ids[10]}});
 const lineups=structuredClone(s.matches.filter(m=>['r2','r3'].includes(m.roundId)));
 assert.equal(await startDuePointsSessions(s,boundary,apply),true);
 assert.ok(s.matches.filter(m=>['r0','r1'].includes(m.roundId)).every(m=>m.status==='cancelled'));assert.equal(m('m20').status,'published');assert.equal(s.matches.some(m=>m.status==='playing'),false);
 assert.deepEqual(s.matches.filter(m=>['r2','r3'].includes(m.roundId)),lineups);assert.equal(s.audits.some(a=>a.action==='pointsReplan'),false);
 assert.equal(await startDuePointsSessions(s,boundary+1,apply),false);
});

test('without a hand edit the next phase is planned again around a held player and starts',async()=>{
 const {s,e,m,ids}=fixture();s.matches.filter(m=>['r2','r3'].includes(m.roundId)).forEach(m=>m.a[0]=ids[10]);e.noShowHold=[ids[10]];
 assert.equal(await startDuePointsSessions(s,boundary,apply),true);
 assert.equal(s.audits.filter(a=>a.action==='pointsReplan').length,1);
 const playing=s.matches.filter(m=>m.status==='playing');
 assert.deepEqual(playing.map(m=>m.id).sort(),['m20','m21'],'each court keeps its game ID');
 assert.ok(playing.every(x=>![...x.a,...x.b].includes(ids[10])&&![...x.a,...x.b].some(id=>id===ids[8]||id===ids[9])),'the held player and those who left are not planned');
 assert.equal(new Set(playing.flatMap(x=>[...x.a,...x.b])).size,8);assert.equal(m('m20').start,boundary);
 const saved=structuredClone(s);assert.equal(await startDuePointsSessions(s,boundary+1,apply),false);assert.deepEqual(s,saved,'planned again only once');
});

test('players whose game was skipped at a phase change get it back in the next phase',async()=>{
 const s=createSimulation(start).state,e=s.events[0],ids=s.players.map(p=>p.id),cut=start+60*minute;
 e.schedulingMode='planned';e.end=start+240*minute;e.pointsSession={startedAt:start,attendance:[],waiting:[]};e.pointsPlan={start,end:e.end,roundMinutes:15};
 s.bookings.forEach(b=>b.end=e.end);s.registrations[11].arrival=cut;
 const game=(id:string,roundId:string,court:number,players:string[],done=false)=>s.matches.push({id,eventId:e.id,roundId,courtId:s.bookings[court].id,a:players.slice(0,2),b:players.slice(2),status:done?'complete':'published',start:done?start:null,end:done?start+15*minute:null,scoreA:done?21:null,scoreB:done?15:null,games:done?[{a:21,b:15}]:[],monthly:true,elo:true,locked:false,enteredBy:null});
 // The first round: court 1 was played, court 2 never started before the twelfth player arrived.
 s.rounds.push({id:'a0',eventId:e.id,start,duration:15,status:'playing',eligible:ids.slice(0,11),rest:ids.slice(8,11),seed:1,pointsSlot:1});
 game('g01','a0',0,ids.slice(0,4),true);game('g02','a0',1,ids.slice(4,8));
 // The next round was planned as if both games had been played: 4 to 7 would rest again.
 s.rounds.push({id:'a1',eventId:e.id,start:cut,duration:15,status:'published',eligible:ids,rest:ids.slice(4,8),seed:2,pointsSlot:2});
 game('g11','a1',0,[ids[0],ids[1],ids[8],ids[9]]);game('g12','a1',1,[ids[2],ids[3],ids[10],ids[11]]);
 assert.equal(await startDuePointsSessions(s,cut,apply),true);
 assert.equal(s.matches.find(x=>x.id==='g02')!.status,'cancelled');
 const next=s.matches.filter(x=>x.roundId==='a1'&&x.status==='playing').flatMap(x=>[...x.a,...x.b]);
 assert.equal(next.length,8);
 for(const id of ids.slice(4,8))assert.ok(next.includes(id),'a player whose game was skipped plays next');
 for(const id of ids.slice(0,4))assert.ok(!next.includes(id),'those who played rest');
 assert.deepEqual(s.rounds.find(r=>r.id==='a1')!.rest.sort(),[...ids.slice(0,4)].sort());
});

test('unconfirmed drafts, ordinary one-round scheduling and future activities are not expired',()=>{
 for(const kind of ['draft','round','future','live'] as const){
  const {s,e}=fixture();if(kind==='draft'){s.rounds.slice(0,2).forEach(r=>r.status='draft');s.matches.filter(m=>['r0','r1'].includes(m.roundId)).forEach(m=>m.status='draft')}
  if(kind==='round'){e.schedulingMode='round';s.rounds.forEach(r=>delete r.pointsSlot)}
  if(kind==='future')e.start=boundary+minute;
  if(kind==='live')e.livePlay={enabled:true,paused:false,preferences:[],completions:[],rest:[]};
  const before=structuredClone(s);assert.equal(scheduledCourtProgress(s,e,boundary).expired.length,0,kind);assert.deepEqual(s,before);
 }
});

test('per-court booking signup windows switch the planned pool at the exact same boundary',()=>{
 const {s,e}=fixture();s.registrations.forEach(r=>r.bookingSignups=[{bookingId:s.bookings[0].id,status:'confirmed',sequence:r.sequence,arrival:r.arrival,departure:r.departure,note:'',registeredAt:start,joinedAsWaitlist:false,cancelRequested:false}]);
 assert.equal(clubViewValidUntil(s,s.accounts[0],boundary-1),boundary);
 assert.equal(advanceScheduledCourts(s,e,boundary),true);
 assert.ok(s.matches.filter(m=>m.status==='playing').every(m=>[...m.a,...m.b].every(id=>!s.players.slice(8,10).some(p=>p.id===id))));
});
