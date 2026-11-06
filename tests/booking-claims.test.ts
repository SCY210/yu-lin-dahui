import test from 'node:test';import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {bookingClaimVersion} from '../lib/domain/booking-claims';
import {bookingParts,retimeBooking} from '../lib/domain/booking-advancers';
import {calculateSettlement} from '../lib/domain/money';
import {repairEventDate} from '../lib/domain/event-date-repair';
import {coinFixture,coinEvent,coinSignup,coinEpoch} from './helpers/automatic-coins-fixture';
import type {Account} from '../lib/domain/types';
const hour=3600000;
function fixture(){const s=coinFixture(),e=coinEvent(s,'claims',coinEpoch+6*hour,{start:coinEpoch,feeAdvances:true}),b=s.bookings[0];Object.assign(b,{start:e.start,end:e.end,pricing:'hourly',cents:1200,advancedBy:'p0'});for(const p of s.players)coinSignup(s,e,p.id);return {s,e,b,now:e.start-hour}}
const payload=(b:ReturnType<typeof fixture>['b'],start=b.start+2*hour,end=b.start+4*hour)=>({bookingId:b.id,start,end,expected:bookingClaimVersion(b),reason:''});

test('a member claims a middle interval while signups, matches and total shares remain unchanged',async()=>{
 const {s,e,b,now}=fixture(),before=calculateSettlement(s,e,e.end),regs=structuredClone(s.registrations),matches=structuredClone(s.matches);
 await apply(s,s.accounts[1],'bookingClaim',payload(b),now);
 assert.deepEqual(bookingParts(b).map(p=>[(p.start-b.start)/hour,(p.end-b.start)/hour,p.advancedBy]),[[0,2,'p0'],[2,4,'p1'],[4,6,'p0']]);
 assert.deepEqual(s.registrations,regs);assert.deepEqual(s.matches,matches);assert.equal(s.bookings.length,1);
 const after=calculateSettlement(s,e,e.end);assert.deepEqual(after.bills,before.bills);assert.equal(after.expenseTotal,before.expenseTotal);assert.deepEqual(after.advances?.map(a=>[a.playerId,a.paid??a.cents]),[['p0',4800],['p1',2400]]);
 const audit=s.audits.at(-1)!;assert.equal(audit.actor,s.accounts[1].id);assert.equal(audit.action,'bookingClaim');
 const count=s.audits.length;await apply(s,s.accounts[1],'bookingClaim',payload(b),now+1);assert.equal(s.audits.length,count);
 await apply(s,s.accounts[2],'bookingClaim',payload(b,b.start+4*hour,b.end),now);assert.equal(bookingParts(b).at(-1)?.advancedBy,'p2','adjacent [start,end) claims do not overlap');
});

test('stale snapshots and another member claiming an occupied interval fail without mutation',async()=>{
 const {s,b,now}=fixture(),old=payload(b);await apply(s,s.accounts[1],'bookingClaim',old,now);const unchanged=structuredClone(s);
 await assert.rejects(()=>apply(s,s.accounts[2],'bookingClaim',old,now),/409/);assert.deepEqual(s,unchanged);
 await assert.rejects(()=>apply(s,s.accounts[2],'bookingClaim',payload(b,b.start+hour,b.start+3*hour),now),/已被其他/);assert.deepEqual(s,unchanged);
 await assert.rejects(()=>apply(s,s.accounts[2],'bookingClaim',{...payload(b),playerId:'p1'},now),/403/);
 await assert.rejects(()=>apply(s,{...s.accounts[2],role:'admin',isOwner:true} as Account,'bookingClaim',{...payload(b),correct:true,playerId:'p2'},now),/403/);
 await assert.rejects(()=>apply(s,s.accounts[2],'bookingClaim',{...payload(b),correct:true,playerId:'p2',eventId:'owned-other'},now));assert.deepEqual(s,unchanged);
});

test('stored event creator can correct a claimed range; existing organiser edits keep claimed ownership in sync',async()=>{
 const {s,e,b,now}=fixture();e.creatorId=s.accounts[3].id;await apply(s,s.accounts[1],'bookingClaim',payload(b),now);
 await apply(s,s.accounts[3],'bookingClaim',{...payload(b),correct:true,playerId:'p2'},now);assert.equal(b.claims?.[0].playerId,'p2');assert.equal(bookingParts(b)[1].advancedBy,'p2');
 await apply(s,s.accounts[3],'feeAdvance',{eventId:e.id,itemId:b.id,at:b.start+2*hour,advancedBy:'p4',reason:''},now);assert.equal(b.claims?.[0].playerId,'p4');
 const start=b.start;retimeBooking(b,start+3*hour,b.end);assert.deepEqual(b.claims?.map(c=>[c.start,c.end,c.playerId]),[[start+3*hour,start+4*hour,'p4']]);
 retimeBooking(b,start+4*hour,b.end);assert.equal(b.claims,undefined);
});

test('invalid ranges, inactive accounts, guests and locked financial records reject atomically',async()=>{
 for(const range of [[-1,2],[1,7],[2,2],[2,2.5],[.5,2],[1.1,3]]){const {s,b,now}=fixture(),before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[1],'bookingClaim',payload(b,b.start+range[0]*hour,b.start+range[1]*hour),now));assert.deepEqual(s,before)}
 const x=fixture();x.s.players[1].enabled=false;await assert.rejects(()=>apply(x.s,x.s.accounts[1],'bookingClaim',payload(x.b),x.now),/停用/);
 x.s.players[1].enabled=true;x.s.accounts=x.s.accounts.filter(a=>a.playerId!=='p2');await assert.rejects(()=>apply(x.s,x.s.accounts[0],'bookingClaim',{...payload(x.b),correct:true,playerId:'p2'},x.now),/账号/);
 for(const state of ['draft','cancelled','deleted','settled']){const {s,e,b,now}=fixture();if(state==='deleted')e.deletedAt=now;else if(state==='settled')s.settlements.push({...calculateSettlement(s,e,e.end),id:'confirmed',created:e.end,version:1,confirmed:true,reason:''});else e.status=state as 'draft'|'cancelled';const before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[1],'bookingClaim',payload(b),now));assert.deepEqual(s,before)}
});

test('a court left 待认领 is claimed piece by piece; the rest stays unclaimed and blocks confirming the split',async()=>{
 const {s,e,b,now}=fixture();delete b.advancedBy;
 await apply(s,s.accounts[1],'bookingClaim',payload(b),now);
 assert.deepEqual(bookingParts(b).map(p=>[(p.start-b.start)/hour,(p.end-b.start)/hour,p.advancedBy]),[[0,2,undefined],[2,4,'p1'],[4,6,undefined]],'the time around a claim is never given to anyone');
 assert.equal('advancedBy' in b,false);assert.deepEqual(b.handovers,[{at:b.start+2*hour,advancedBy:'p1'},{at:b.start+4*hour}]);
 assert.equal(calculateSettlement(s,e,e.end).advances,undefined,'no repayment while time is unclaimed');
 await assert.rejects(()=>apply(s,s.accounts[0],'settle',{eventId:e.id,confirmed:true,reason:''},e.end+hour),/待认领/);
 await apply(s,s.accounts[2],'bookingClaim',payload(b,b.start,b.start+2*hour),now);await apply(s,s.accounts[3],'bookingClaim',payload(b,b.start+4*hour,b.end),now);
 assert.deepEqual(bookingParts(b).map(p=>p.advancedBy),['p2','p1','p3']);assert.deepEqual(calculateSettlement(s,e,e.end).advances?.map(a=>[a.playerId,a.paid??a.cents]),[['p1',2400],['p2',2400],['p3',2400]]);
 await apply(s,s.accounts[0],'settle',{eventId:e.id,confirmed:true,reason:''},e.end+hour);assert.ok(s.settlements.some(x=>x.eventId===e.id&&x.confirmed));
});

test('the organiser can set a part back to 待认领 in the court settings; its claim goes with it',async()=>{
 const {s,b,now}=fixture();await apply(s,s.accounts[1],'bookingClaim',payload(b),now);
 await apply(s,s.accounts[0],'bookingEdit',{bookingId:b.id,name:b.name,start:b.start,end:b.end,pricing:'hourly',cents:1200,advancedBy:'p0',handovers:[{at:b.start+2*hour},{at:b.start+4*hour,advancedBy:'p0'}],reason:''},now);
 assert.deepEqual(bookingParts(b).map(p=>p.advancedBy),['p0',undefined,'p0']);assert.equal(b.claims,undefined);
 await apply(s,s.accounts[0],'bookingEdit',{bookingId:b.id,name:b.name,start:b.start,end:b.end,pricing:'hourly',cents:1200,handovers:[{at:b.start+3*hour}],reason:''},now);
 assert.deepEqual(bookingParts(b),[{start:b.start,end:b.end,advancedBy:undefined}],'neighbouring 待认领 parts become one');assert.equal(b.handovers,undefined);
});

test('an authorised date repair moves claim coverage with the court but retains the actual claim time',async()=>{
 const {s,e,b,now}=fixture();await apply(s,s.accounts[1],'bookingClaim',payload(b),now);const claim=structuredClone(b.claims![0]),day=86400000;
 assert.equal(repairEventDate(s,{eventId:e.id,fromStart:e.start,fromEnd:e.end,toStart:e.start+day,toEnd:e.end+day},e.end+2*day),true);
 assert.deepEqual(s.bookings[0].claims,[{...claim,start:claim.start+day,end:claim.end+day}]);
});

test('a claimed segment can be set back to 待认领 by its booker or the organiser, never by another member',async()=>{
 const {s,e,b,now}=fixture();e.creatorId=s.accounts[3].id;await apply(s,s.accounts[1],'bookingClaim',payload(b),now);
 const release=(start:number,end:number)=>({...payload(b,start,end),release:true});
 const before=structuredClone(s);
 await assert.rejects(()=>apply(s,s.accounts[2],'bookingClaim',release(b.start+2*hour,b.start+4*hour),now),/403/);assert.deepEqual(s,before,'another member cannot release it');
 await assert.rejects(()=>apply(s,s.accounts[1],'bookingClaim',release(b.start,b.start+4*hour),now),/403/,'a member cannot release time someone else booked');
 await apply(s,s.accounts[1],'bookingClaim',release(b.start+2*hour,b.start+4*hour),now);
 assert.deepEqual(bookingParts(b).map(p=>[(p.start-b.start)/hour,(p.end-b.start)/hour,p.advancedBy]),[[0,2,'p0'],[2,4,undefined],[4,6,'p0']]);assert.equal(b.claims,undefined);
 assert.equal(s.audits.at(-1)!.actor,s.accounts[1].id);assert.equal((s.audits.at(-1)!.changes as {release:boolean}).release,true);
 const count=s.audits.length;await apply(s,s.accounts[1],'bookingClaim',release(b.start+2*hour,b.start+4*hour),now);assert.equal(s.audits.length,count,'releasing 待认领 time again changes nothing');
 // The stored event creator (an organiser) releases any time; claims around it are trimmed, not lost.
 await apply(s,s.accounts[2],'bookingClaim',payload(b,b.start+4*hour,b.end),now);
 await apply(s,s.accounts[3],'bookingClaim',release(b.start,b.start+2*hour),now);
 assert.deepEqual(bookingParts(b).map(p=>p.advancedBy),[undefined,'p2']);assert.deepEqual(s.bookings.find(x=>x.id===b.id)!.claims?.map(c=>[(c.start-b.start)/hour,(c.end-b.start)/hour,c.playerId]),[[4,6,'p2']]);
 assert.equal('advancedBy' in b,false);
 await assert.rejects(()=>apply(s,s.accounts[0],'settle',{eventId:e.id,confirmed:true,reason:''},e.end+hour),/待认领/,'released time blocks confirming the split again');
});

test('releasing checks the snapshot, range and confirmed fees without mutation',async()=>{
 for(const kind of ['stale','outside','half','settled']){
  const {s,e,b,now}=fixture();let input:Record<string,unknown>={...payload(b),release:true};
  if(kind==='stale')input={...input,expected:'old'};else if(kind==='outside')input={...input,end:b.end+hour};else if(kind==='half')input={...input,start:b.start+hour/4};else s.settlements.push({...calculateSettlement(s,e,e.end),id:'confirmed',created:e.end,version:1,confirmed:true,reason:''});
  const before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[0],'bookingClaim',input,now));assert.deepEqual(s,before,kind);
 }
});
