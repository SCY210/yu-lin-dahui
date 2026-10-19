import {test} from 'node:test';
import assert from 'node:assert/strict';
import {courtOccupancy,occupancyDuration} from '../lib/client/court-occupancy';
import {createSimulation} from '../lib/admin-simulation';
import {calculateSettlementPreview} from '../lib/domain/money';

const hour=3600000,now=Date.parse('2030-10-10T10:00:00Z');
function fixture(){
 const s=createSimulation(now).state,e=s.events[0];e.start=now;e.end=now+4*hour;
 for(const b of s.bookings){b.start=e.start;b.end=e.end}
 s.registrations=s.registrations.slice(0,4).map(r=>({...r,registeredAt:now-hour,bookingSignups:[{bookingId:s.bookings[0].id,status:'confirmed' as const,sequence:r.sequence,arrival:now,departure:now+2*hour,registeredAt:now-hour,joinedAsWaitlist:false,note:'',cancelRequested:false}]}));
 return {s,e};
}
test('a two-hour empty tail is shown per court and agrees with interval fee preview coverage',()=>{
 const {s,e}=fixture(),before=structuredClone(s),[a,b]=courtOccupancy(e,s.bookings,s.registrations);
 assert.deepEqual(a.segments.map(x=>[x.start,x.end,x.playerIds.length,x.status]),[[now,now+2*hour,4,'ready'],[now+2*hour,e.end,0,'empty']]);
 assert.equal(a.emptyMs,2*hour);assert.equal(b.emptyMs,4*hour);assert.equal(b.segments.length,1);
 const fees=calculateSettlementPreview(s,e,now-hour);
 assert.deepEqual(fees.detail.filter(d=>d.item===a.booking.id&&d.unallocated>0).map(d=>[d.start,d.end]),[[now+2*hour,e.end]]);
 assert.deepEqual(s,before,'view calculation never changes registrations or financial state');
});
test('waiting and cancelled rows leave gaps; promotion and registration boundaries are respected',()=>{
 const {s,e}=fixture();s.registrations[0].bookingSignups![0].status='waitlist';s.registrations[1].bookingSignups![0].status='cancelled';
 s.registrations[2].bookingSignups![0].joinedAsWaitlist=true;s.registrations[2].bookingSignups![0].promotedAt=now+hour;
 s.registrations[3].bookingSignups![0].registeredAt=now+hour/2;
 const [a]=courtOccupancy(e,s.bookings,s.registrations);
 assert.deepEqual(a.segments.map(x=>[x.start,x.end,x.playerIds.length,x.status]),[[now,now+hour/2,0,'empty'],[now+hour/2,now+hour,1,'short'],[now+hour,now+2*hour,2,'short'],[now+2*hour,e.end,0,'empty']]);
 assert.equal(a.emptyMs,2.5*hour);
});
test('adjacent signup shifts have no false gap, duplicate player rows count once, other events stay out',()=>{
 const {s,e}=fixture(),first=s.registrations[0];s.registrations=s.registrations.slice(0,2);
 s.registrations[1].bookingSignups![0].arrival=now+2*hour;s.registrations[1].bookingSignups![0].departure=e.end;
 s.registrations.push({...structuredClone(first),id:'duplicate'}, {...structuredClone(first),id:'other-event',eventId:'other'});
 const [a]=courtOccupancy(e,s.bookings,s.registrations);
 assert.equal(a.emptyMs,0);assert.deepEqual(a.segments.map(x=>x.playerIds.length),[1,1]);assert.notDeepEqual(a.segments[0].playerIds,a.segments[1].playerIds);
 e.matchFormat='singles';s.registrations[1].bookingSignups![0].arrival=now;
 assert.equal(courtOccupancy(e,s.bookings,s.registrations)[0].segments[0].status,'ready');
 e.matchFormat='practice';assert.equal(courtOccupancy(e,s.bookings,s.registrations)[0].segments.at(-1)!.status,'ready');
});
test('legacy signups are clipped to each booking and every court remains independent',()=>{
 const {s,e}=fixture();s.registrations.forEach(r=>{delete r.bookingSignups;r.arrival=now-hour;r.departure=now+3*hour});
 s.bookings[1].start=now+2*hour;
 const [a,b]=courtOccupancy(e,s.bookings,s.registrations);assert.equal(a.emptyMs,hour);assert.equal(b.emptyMs,hour);assert.equal(b.segments[0].start,now+2*hour);
 e.status='cancelled';assert.ok(courtOccupancy(e,s.bookings,s.registrations).every(c=>c.emptyMs===c.booking.end-c.booking.start));
 assert.equal(occupancyDuration(2*hour),'2小时');assert.equal(occupancyDuration(1.5*hour),'1小时30分钟');assert.equal(occupancyDuration(15*60000),'15分钟');
});
