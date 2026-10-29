import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personality,socialSnapshot,finished,arenaStatus,courtLeaderboard} from '../lib/domain/social';
import {month,type State} from '../lib/domain/types';
import {realmLedger} from '../lib/domain/realm-rating';
import {club} from './helpers/performance-fixture';

// Deliberately retain a simple per-player reference for equivalence, independent of the indexed implementation.
function reference(s:State,year:number,now:number){
 const events=s.events.filter(e=>Number(month(e.start).slice(0,4))===year);
 return s.players.map(p=>{
  const arrivals=events.flatMap(e=>{
   const a=s.attendance.filter(a=>a.eventId===e.id&&a.playerId===p.id&&a.source!=='automatic'&&a.start<=now).sort((a,b)=>a.start-b.start)[0];
   return a?[{e,a}]:[];
  });
  const regs=s.registrations.filter(r=>r.playerId===p.id&&r.status!=='cancelled'&&events.some(e=>e.id===r.eventId));
  return {playerId:p.id,early:arrivals.filter(({e,a})=>a.start<e.start).length,
   onTime:arrivals.filter(({e,a})=>a.start>=e.start&&a.start<=e.start+5*60000).length,
   promoted:regs.filter(r=>r.bookingSignups?r.bookingSignups.some(x=>x.status!=='cancelled'&&x.joinedAsWaitlist&&x.promotedAt):r.joinedAsWaitlist&&r.promotedAt).length,
   fastSignup:regs.filter(r=>r.bookingSignups?r.bookingSignups.some(x=>x.status!=='cancelled'&&x.registeredAt&&x.sequence===1):r.registeredAt&&r.sequence===1).length,
   signupSamples:regs.filter(r=>r.registeredAt).length};
 });
}

test('indexed personality preserves attendance and per-court signup rules at clock and year boundaries',()=>{
 const {s,now}=club(5);
 for(const [i,e] of s.events.entries())for(const [j,p] of s.players.entries()){
  const at=e.start+((j%4)-1)*5*60000;
  // Unsorted multiple sessions: only the earliest manual arrival counts, even after departure.
  s.attendance.push({id:`late-${i}-${j}`,eventId:e.id,playerId:p.id,start:at+3600000,end:null,state:'ready'},
   {id:`first-${i}-${j}`,eventId:e.id,playerId:p.id,start:at,end:at+1000,state:'left'},
   {id:`auto-${i}-${j}`,eventId:e.id,playerId:p.id,start:e.start-3600000,end:null,state:'ready',source:'automatic'});
 }
 for(const [i,r] of s.registrations.entries()){
  r.registeredAt=i%2?0:s.events[0].start-3600000;r.sequence=i%3+1;r.joinedAsWaitlist=i%2===0;r.promotedAt=i%4?now-1000:undefined;
  if(i%5===0)r.status='cancelled';
  if(i%3===0)r.bookingSignups=[];
  if(i%3===1)r.bookingSignups=[{bookingId:'court',status:i%2?'confirmed':'cancelled',sequence:1,arrival:r.arrival,departure:r.departure,note:'',cancelRequested:false,registeredAt:now-10000,joinedAsWaitlist:true,promotedAt:now-9000}];
 }
 s.registrations.push({...s.registrations[1],id:'invisible',eventId:'not-visible'});
 s.events.push({...s.events[0],id:'previous-year',start:Date.parse('2025-12-31T22:59:59Z')});
 s.attendance.push({id:'previous',eventId:'previous-year',playerId:'p1',start:Date.parse('2025-12-31T22:59:59Z'),end:null,state:'ready'});
 const before=structuredClone(s);
 for(const at of [s.events[0].start-1,s.events[0].start,s.events[0].start+5*60000,now])for(const year of [2025,2026,2027])assert.deepEqual(personality(s,year,at),reference(s,year,at));
 assert.deepEqual(s,before,'projection never mutates attendance or registrations');
});

test('personality reads each registration once regardless of player or activity count',()=>{
 const {s,now}=club(20,66);let visits=0;
 for(const r of s.registrations){const id=r.eventId;Object.defineProperty(r,'eventId',{get(){visits++;return id}})}
 personality(s,2026,now);
 assert.equal(visits,s.registrations.length);
});

test('event match indexes preserve arena holders and king-of-court boards',()=>{
 const {s,now}=club(5);
 for(const e of s.events)e.arenaCourtId=s.bookings.find(b=>b.eventId===e.id)!.id;
 for(const [i,m] of s.matches.entries())m.playMode=i%3?'arena':'koc';
 s.matches.push({...s.matches[0],id:'unfinished',status:'playing'});
 const all=finished(s),realms=realmLedger(s,now).snapshot;
 const view=socialSnapshot(s,month(now),2026,now,s,realms,{stats:[],funny:[],annual:[]});
 assert.deepEqual(view.arenas,Object.fromEntries(s.events.map(e=>[e.id,arenaStatus(s,e.id,all)])));
 assert.deepEqual(view.courtBoards,Object.fromEntries(s.events.map(e=>[e.id,courtLeaderboard(s,e.id,all)])));
});
