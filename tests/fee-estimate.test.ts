import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Event} from '../lib/domain/types';
import {apply} from '../lib/domain/commands';
import {calculateSettlement,calculateSettlementPreview} from '../lib/domain/money';
import {projectClubState} from '../lib/club-view';
const start=Date.parse('2030-10-10T13:00:00Z'),hour=3600000;
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='host';const host={id:'host',playerId:'p0',role:'admin' as const,email:''};s.accounts=[host];
 const e:Event={id:'e',creatorId:host.id,title:'Fictional mixed duration',start,end:start+4*hour,venue:'Fixture Venue',address:'',capacity:12,signupDeadline:start+4*hour,cancelDeadline:start-hour,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};s.events=[e];
 s.bookings=[{id:'short',eventId:e.id,name:'Short court',start,end:start+2*hour,pricing:'hourly',cents:690},{id:'long',eventId:e.id,name:'Long court',start,end:e.end,pricing:'hourly',cents:690}];
 for(let i=0;i<12;i++){const id='p'+i,b=s.bookings[i<6?0:1];s.players.push({id,name:id,ownerId:host.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});s.registrations.push({id:'r'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:start,departure:b.end,registeredAt:start-hour,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''},bookingSignups:[{bookingId:b.id,status:'confirmed',joinedAsWaitlist:false,sequence:i,arrival:start,departure:b.end,registeredAt:start-hour,note:'',cancelRequested:false}]})}
 return {s,e,host};
}
test('ongoing estimate keeps two-hour and four-hour signup durations and their distinct court amounts',()=>{
 const {s,e}=fixture(),now=start+hour,actual=calculateSettlement(s,e,now),estimated=calculateSettlementPreview(s,e,now);
 assert.ok(actual.bills.every(b=>b.minutes===60));assert.ok(actual.bills.every(b=>b.court===115),'elapsed costs are still equal at this point');
 for(const b of estimated.bills){const short=Number(b.playerId.slice(1))<6;assert.equal(b.minutes,short?120:240);assert.equal(b.court,short?230:460)}
 assert.equal(estimated.total,4140);assert.equal(estimated.expenseTotal,4140);assert.equal(estimated.unallocated,0);
 assert.deepEqual(calculateSettlementPreview(s,e,e.end),calculateSettlement(s,e,e.end));
});
test('known shuttle expense is estimated by the full time intervals without charging the short group for later play',()=>{
 const {s,e}=fixture();s.costs.push({id:'balls',eventId:e.id,type:'ball',name:'Fixture balls',pricing:'unit',cents:200,tubeCount:1,used:9,start:null,end:null,bearer:'members'});
 const result=calculateSettlementPreview(s,e,start+hour);assert.equal(result.expenseTotal,5940);assert.equal(result.unallocated,0);
 for(const b of result.bills){const short=Number(b.playerId.slice(1))<6;assert.equal(b.ball,short?100:200);assert.equal(b.total,short?330:660)}
});
test('cancelled participation remains archived, while manual attendance keeps actual-time accounting',async()=>{
 const {s,e,host}=fixture();await apply(s,host,'courtCancel',{bookingId:'short',playerId:'p0'},start+hour/2);const result=calculateSettlementPreview(s,e,start+hour);
 assert.equal(result.bills.find(b=>b.playerId==='p0')!.minutes,30);assert.ok(result.bills.find(b=>b.playerId==='p0')!.total<result.bills.find(b=>b.playerId==='p1')!.total);
 const manual=fixture();delete manual.e.attendanceMode;manual.s.attendance=[{id:'a',eventId:'e',playerId:'p0',start,end:null,state:'ready'}];assert.deepEqual(calculateSettlementPreview(manual.s,manual.e,start+hour),calculateSettlement(manual.s,manual.e,start+hour));
});
test('projected estimate and saved draft agree; early confirmation stays blocked and historical confirmations are preserved',async()=>{
 const {s,e,host}=fixture(),now=start+hour,expected=calculateSettlementPreview(s,e,now);
 const view=projectClubState(s,host,'2030-10',2030,now);assert.deepEqual(view.drafts[0],expected);
 await apply(s,host,'settle',{eventId:e.id,confirmed:false},now);assert.equal(s.settlements[0].bills.find(b=>b.playerId==='p6')!.court,460);assert.equal(s.settlements[0].confirmed,false);
 const before=structuredClone(s);await assert.rejects(()=>apply(s,host,'settle',{eventId:e.id,confirmed:true},now),/活动结束/);assert.deepEqual(s,before);
 await apply(s,host,'settle',{eventId:e.id,confirmed:true},e.end);assert.deepEqual(s.settlements[1].bills,expected.bills);assert.equal(s.settlements[1].confirmed,true);
});
