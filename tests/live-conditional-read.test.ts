import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../lib/admin-simulation';
import {apply} from '../lib/domain/commands';
import {projectClubState} from '../lib/club-view';
import {clubViewValidUntil,liveMaxAge} from '../lib/club-read-cache';
import {startDuePointsSessions} from '../lib/domain/points-auto-start';
import {activateAutomaticCoins,reconcileAutomaticCoins} from '../lib/domain/automatic-coins';
import {mergeStrengthRating} from '../lib/domain/ranking';
import {enableDefaultAttendance} from '../lib/domain/attendance';
import {month,type State} from '../lib/domain/types';

// During a running activity, phones poll every 3 seconds. An unchanged poll is answered with 304 without loading or
// projecting the club, so until clubViewValidUntil nothing a viewer sees may change on the clock, and none of the
// clock-driven maintenance that only runs on a full read (auto-started rounds, refilled live courts, coin
// settlement) may become due. These scenarios walk whole fictional activities and check every window.
const minute=60000,base=Date.parse('2026-10-14T16:00:00Z');

/** The clock-driven part of loadClubState. Returns whether anything changed. */
async function maintain(s:State,now:number){
 let changed=enableDefaultAttendance(s,now);mergeStrengthRating(s,now);
 changed=(await startDuePointsSessions(s,now,apply))||changed;
 changed=activateAutomaticCoins(s,s.events[0].start-86400000)||changed;
 return reconcileAutomaticCoins(s,now)||changed;
}

const scenarios:{name:string;setup:(s:State,start:number)=>Promise<void>}[]=[
 {name:'live rotation with a late arrival, an early departure and a court added later',setup:async(s,start)=>{
  const r=s.registrations;r[3].arrival=start+40*minute+12345;r[5].departure=start+4*60*minute-777;r[7].arrival=start+95*minute;r[7].registeredAt=start+20*minute+999;
  s.bookings.push({id:'sim-court-3',eventId:'sim-event',name:'模拟 3 号场',start:start+60*minute,end:start+3*60*minute,pricing:'hourly',cents:690,signupCapacity:12});
 }},
 {name:'published planned rounds that start on the clock',setup:async(s,start)=>{
  const e=s.events[0],a=s.accounts[0],at=start-30*minute;e.schedulingMode='round';s.registrations[2].arrival=start+50*minute+4321;
  await apply(s,a,'planPoints',{eventId:e.id,at:start,pointsMinutes:180,roundMinutes:15,seed:1,pairing:'rotate'},at);await apply(s,a,'publishPoints',{eventId:e.id},at);
 }},
 {name:'per-court signups with staggered arrivals and a promoted waitlist',setup:async(s,start)=>{
  s.bookings[1].start=start+90*minute;
  s.registrations.forEach((r,i)=>{
   r.bookingSignups=[{bookingId:'sim-court-1',status:'confirmed',sequence:i+1,arrival:start+(i%3)*17*minute+i*1111,departure:start+6*60*minute-(i%4)*23*minute,note:'',cancelRequested:false,registeredAt:start-86400000,joinedAsWaitlist:false}];
   if(i%2)r.bookingSignups.push({bookingId:'sim-court-2',status:i===11?'waitlist':'confirmed',sequence:i,arrival:start+90*minute,departure:start+6*60*minute,note:'',cancelRequested:false,registeredAt:start-86400000,joinedAsWaitlist:i===9,...(i===9?{promotedAt:start+130*minute+4567}:{})});
  });
 }},
];

for(const scenario of scenarios)test('a reused live view never hides a clock change: '+scenario.name,async()=>{
 const s=createSimulation(base).state,e=s.events[0],admin=s.accounts[0],member=s.accounts[1];
 await scenario.setup(s,e.start);
 let liveWindows=0,reused=0;
 for(let t0=e.start-5*minute,step=0;t0<e.end+5*minute;t0+=151000+(step++%7)*4321){
  // A full read runs the maintenance (and saves when it changed something).
  if(await maintain(s,t0))s.revision++;
  // Members score games after about 11 minutes; a write changes the revision, so the next read is a full one.
  let wrote=false;
  for(const m of s.matches)if(m.status==='playing'&&m.start!==null&&t0-m.start>11*minute){await apply(s,admin,'score',{matchId:m.id,a:21,b:17},t0);wrote=true}
  if(wrote&&(s.revision++,await maintain(s,t0)))s.revision++;
  const viewer=step%2?admin:member,until=clubViewValidUntil(s,viewer,t0),live=e.start<=t0&&t0<e.end;
  if(live){liveWindows++;assert.ok(until-t0<=liveMaxAge,'a live view is reused for '+liveMaxAge+'ms at most')}
  if(until<=t0)continue;
  if(live)reused++;
  const period=month(t0),view=JSON.stringify(projectClubState(s,viewer,period,Number(period.slice(0,4)),t0));
  for(const t of [Math.floor((t0+until)/2),until-1]){
   const at=new Date(t).toISOString(),window=new Date(t0).toISOString()+' until '+new Date(until).toISOString();
   assert.equal(await maintain(structuredClone(s),t),false,'clock-driven maintenance became due at '+at+' inside '+window);
   assert.equal(JSON.stringify(projectClubState(s,viewer,month(t),Number(month(t).slice(0,4)),t)),view,viewer.role+' view changed at '+at+' inside '+window);
  }
 }
 assert.ok(liveWindows>100&&reused>liveWindows*.9,`most live polls can be answered without a full read (${reused} of ${liveWindows})`);
});

test('legacy check-in attendance keeps a running activity on full refresh',()=>{
 const s=createSimulation(base).state,e=s.events[0];e.attendanceMode='manual';
 assert.equal(clubViewValidUntil(s,s.accounts[1],e.start+30*minute),e.start+30*minute);
});
