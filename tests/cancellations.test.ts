import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {cancellationView} from '../lib/domain/cancellations';
import {projectClubState} from '../lib/club-view';
import {emptyState,type Account,type State} from '../lib/domain/types';

const start=Date.parse('2027-03-10T18:00:00Z'),end=start+7200000,day=86400000;
function fixture(courts=false){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 const accounts:Account[]=[{id:'owner',email:'',role:'admin',playerId:'p0'},{id:'host',email:'',role:'member',playerId:'p1'},{id:'m2',email:'',role:'member',playerId:'p2'},{id:'m3',email:'',role:'member',playerId:'p3'}];
 s.accounts=accounts;s.players=accounts.map(a=>({id:a.playerId,name:'球友'+a.playerId,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 s.players.push({id:'friend',name:'朋友',ownerId:'m2',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 s.events.push({id:'e',creatorId:'host',title:'虚构活动',venue:'球馆',address:'',start,end,signupDeadline:start-2*3600000,cancelDeadline:start-day,capacity:8,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',note:''});
 if(courts)s.bookings.push({id:'c1',eventId:'e',name:'1 号场',start,end:start+3600000,pricing:'total',cents:1200,signupCapacity:4},{id:'c2',eventId:'e',name:'2 号场',start:start+3600000,end,pricing:'total',cents:1200,signupCapacity:4});
 return s;
}
const account=(s:State,id:string)=>s.accounts.find(a=>a.id===id)!;
const reg=(s:State,playerId:string)=>s.registrations.find(r=>r.playerId===playerId)!;
const join=(s:State,id:string,playerId:string,at=start-3*day)=>apply(s,account(s,id),'register',{eventId:'e',playerId,arrival:start,departure:end,note:''},at);

test('a member cancelling in time is recorded with the time and a typed reason; the automatic text is not a reason',async()=>{
 const s=fixture();await join(s,'m2','p2');await join(s,'m3','p3');
 await apply(s,account(s,'m2'),'cancel',{eventId:'e',playerId:'p2',reason:'临时加班'},start-2*day);
 await apply(s,account(s,'m3'),'cancel',{eventId:'e',playerId:'p3',reason:'取消报名'},start-2*day+1000);
 assert.deepEqual(cancellationView(s,reg(s,'p2')),{at:start-2*day,by:'self',byName:'球友p2',reason:'临时加班'});
 assert.deepEqual(cancellationView(s,reg(s,'p3')),{at:start-2*day+1000,by:'self',byName:'球友p3'});
});

test('after the free-cancellation time only the organiser can cancel; the registrant of a friend is shown as such',async()=>{
 const s=fixture();await join(s,'m2','p2');await join(s,'m2','friend');
 await apply(s,account(s,'m2'),'cancel',{eventId:'e',playerId:'p2',reason:'申请取消报名'},start-3600000);
 assert.equal(reg(s,'p2').status,'confirmed');assert.equal(cancellationView(s,reg(s,'p2')),undefined,'a request is not a cancellation');
 await apply(s,account(s,'host'),'cancel',{eventId:'e',playerId:'p2',reason:'同意取消'},start-1800000);
 assert.deepEqual(cancellationView(s,reg(s,'p2')),{at:start-1800000,by:'organizer',byName:'球友p1',reason:'同意取消'});
 await apply(s,account(s,'m2'),'cancel',{eventId:'e',playerId:'friend',reason:'取消报名'},start-2*day);
 assert.equal(cancellationView(s,reg(s,'friend'))?.by,'registrant');
});

test('signing up again removes the cancellation; court signups record it only once every court is cancelled',async()=>{
 const s=fixture();await join(s,'m2','p2');await apply(s,account(s,'m2'),'cancel',{eventId:'e',playerId:'p2',reason:'取消报名'},start-2*day);
 await join(s,'m2','p2',start-2*day+1);assert.notEqual(reg(s,'p2').status,'cancelled');assert.equal(reg(s,'p2').cancelledAt,undefined);
 const c=fixture(true),court=(bookingId:string)=>({bookingId,playerId:'p3',arrival:c.bookings.find(b=>b.id===bookingId)!.start,departure:c.bookings.find(b=>b.id===bookingId)!.end,note:''});
 await apply(c,account(c,'m3'),'courtRegister',court('c1'),start-3*day);await apply(c,account(c,'m3'),'courtRegister',court('c2'),start-3*day);
 await apply(c,account(c,'m3'),'courtCancel',{bookingId:'c1',playerId:'p3',reason:'只打后半场'},start-2*day);
 assert.equal(cancellationView(c,reg(c,'p3')),undefined,'still signed up for the second court');
 await apply(c,account(c,'m3'),'courtCancel',{bookingId:'c2',playerId:'p3',reason:'有事'},start-2*day+1);
 assert.deepEqual(cancellationView(c,reg(c,'p3')),{at:start-2*day+1,by:'self',byName:'球友p3',reason:'有事'});
 await apply(c,account(c,'m3'),'courtRegister',court('c2'),start-2*day+2);assert.equal(reg(c,'p3').cancelledAt,undefined);
});

test('older cancellations are recovered from the audit log, and everyone sees them without account ids',async()=>{
 const s=fixture();await join(s,'m2','p2');await apply(s,account(s,'m2'),'cancel',{eventId:'e',playerId:'p2',reason:'家里有事'},start-2*day);
 const r=reg(s,'p2');delete r.cancelledAt;delete r.cancelledBy;delete r.cancelReason;delete r.cancelledAs;
 assert.deepEqual(cancellationView(s,r),{at:start-2*day,by:'self',byName:'球友p2',reason:'家里有事'});
 const unknown=fixture();await join(unknown,'m3','p3');const u=reg(unknown,'p3');u.status='cancelled';
 assert.deepEqual(cancellationView(unknown,u),{by:'unknown'});
 await apply(s,account(s,'m3'),'register',{eventId:'e',playerId:'p3',arrival:start,departure:end,note:''},start-3*day);
 const view=projectClubState(s,account(s,'m3'),'2027-03',2027,start-day),row=view.registrations.find(r=>r.playerId==='p2')!;
 assert.ok('cancellation' in row&&row.cancellation?.reason==='家里有事');
 for(const field of ['cancelledAt','cancelledBy','cancelledAs','cancelReason'])assert.ok(!(field in row),'raw cancellation metadata is not sent to members');
});

test('the cancellation actor keeps their recorded role after a proxy friend gets their own account',async()=>{
 const s=fixture();await join(s,'m2','friend');
 await apply(s,account(s,'m2'),'cancel',{eventId:'e',playerId:'friend',reason:'临时有事'},start-2*day);
 s.accounts.push({id:'friend-login',email:'',role:'member',playerId:'friend'});
 s.players.find(p=>p.id==='friend')!.ownerId='friend-login';
 assert.deepEqual(cancellationView(s,reg(s,'friend')),{at:start-2*day,by:'registrant',byName:'球友p2',reason:'临时有事'});
});

test('legacy cancellation actor roles are not invented from a later account role',async()=>{
 const s=fixture();await join(s,'m2','friend');await apply(s,account(s,'m2'),'cancel',{eventId:'e',playerId:'friend',reason:'有事'},start-2*day);
 delete reg(s,'friend').cancelledAs;s.players.find(p=>p.id==='friend')!.ownerId='new-owner';account(s,'m2').role='admin';
 assert.deepEqual(cancellationView(s,reg(s,'friend')),{at:start-2*day,by:'unknown',byName:'球友p2',reason:'有事'});
});
