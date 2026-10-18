import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {calculateSettlement} from '../lib/domain/money';
import {bookingParts,mergeCourtSlots} from '../lib/domain/booking-advancers';
import {newEventForm} from '../app/event-create-form';
import {emptyState,type Account} from '../lib/domain/types';

const hour=3600000,start=Date.parse('2026-11-05T18:00:00Z'),end=start+3*hour,after=end+hour;
const owner:Account={id:'owner',email:'',role:'admin',playerId:'p0'};
const members:Account[]=[owner,...['alice','bob','carol'].map((id,i)=>({id,email:'',role:'member' as const,playerId:'p'+(i+1)}))];
/** Owner, Alice, Bob and Carol play three hours on one court, 12 €/hour: Alice booked 18–20 and Bob 20–21. */
async function fixture(bookings:object[]=[{name:'1号场',start,end,pricing:'hourly',cents:1200,advancedBy:'p1',handovers:[{at:start+2*hour,advancedBy:'p2'}]}]){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=owner.id;s.accounts=members.map(a=>({...a}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 await apply(s,owner,'event',{title:'虚构接力约场',matchFormat:'doubles',start,end,venue:'虚构球馆',address:'',capacity:8,cancelDeadline:start-86400000,note:'',status:'open',bookings},start-2*86400000);
 const e=s.events[0];
 for(const [i,id] of ['p0','p1','p2','p3'].entries())s.registrations.push({id:'r'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:start,departure:end,registeredAt:start-86400000,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 return {s,e};
}

test('the creation form joins slots of one court that follow each other, and keeps other courts and gaps apart',()=>{
 const form=newEventForm(start-86400000,false,false,[['p1','alice'],['p2','bob']]);
 const local=(h:number)=>new Date(start+h*hour).toLocaleString('sv-SE',{timeZone:'Europe/Madrid'}).slice(0,16).replace(' ','T');
 const body=form.convert!({...form.values,venue:'虚构球馆',start:local(0),end:local(5),courts:[
  {name:'1号场',start:local(0),end:local(2),advancedBy:'p1'},{name:'1号场',start:local(2),end:local(3),advancedBy:'p2'},
  {name:'2号场',start:local(0),end:local(2),advancedBy:'p1'},{name:'1号场',start:local(4),end:local(5),advancedBy:'p1'}]}) as {bookings:{name:string;start:number;end:number;advancedBy:string;handovers?:object[]}[]};
 assert.deepEqual(body.bookings.map(b=>[b.name,(b.start-start)/hour,(b.end-start)/hour,b.advancedBy,b.handovers]),[
  ['1号场',0,3,'p1',[{at:start+2*hour,advancedBy:'p2'}]],['2号场',0,2,'p1',undefined],['1号场',4,5,'p1',undefined]]);
 // The same member booking both halves is simply one booker.
 assert.equal(mergeCourtSlots([{name:'1号场',start,end:start+hour,pricing:'hourly',cents:1,advancedBy:'p1'},{name:'1号场',start:start+hour,end,pricing:'hourly',cents:1,advancedBy:'p1'}],'馆')[0].handovers,undefined);
});

test('each booker of one court is repaid the fee of their own time, whatever the split mode',async()=>{
 for(const mode of ['interval','equal','duration'] as const){
  const {s,e}=await fixture();e.courtMode=mode;
  assert.equal(s.bookings.length,1,'one court slot, one sign-up list');
  const v=calculateSettlement(s,e,after);
  assert.deepEqual(v.advances,[{playerId:'p1',cents:2400},{playerId:'p2',cents:1200}],mode);
  assert.equal(v.bills.reduce((n,b)=>n+b.total,0),3600);
 }
 // Two separate slots give the same result as one slot with a handover.
 const split=await fixture([{name:'1号场',start,end:start+2*hour,pricing:'hourly',cents:1200,advancedBy:'p1'},{name:'2号场',start:start+2*hour,end,pricing:'hourly',cents:1200,advancedBy:'p2'}]);
 const joined=await fixture();
 assert.deepEqual(calculateSettlement(joined.s,joined.e,after).transfers,calculateSettlement(split.s,split.e,after).transfers);
});

test('handovers must fall inside the slot, in order, to a member',async()=>{
 const bad=(handovers:object[])=>fixture([{name:'1号场',start,end,pricing:'hourly',cents:1200,advancedBy:'p1',handovers}]);
 await assert.rejects(()=>bad([{at:end,advancedBy:'p2'}]),/交接时间/);
 await assert.rejects(()=>bad([{at:start+2*hour,advancedBy:'p2'},{at:start+hour,advancedBy:'p3'}]),/交接时间/);
 await assert.rejects(()=>bad([{at:start+hour,advancedBy:'nobody'}]));
});

test('a slot added later right after the same court extends it; a gap or another court stays separate',async()=>{
 const {s,e}=await fixture([{name:'1号场',start,end:start+2*hour,pricing:'hourly',cents:1200,advancedBy:'p1'}]);
 const add=(name:string,from:number,to:number,by='p2')=>apply(s,owner,'booking',{eventId:e.id,name,start:from,end:to,pricing:'hourly',cents:1200,advancedBy:by,reason:''},start-86400000);
 await add('1号场',start+2*hour,end);
 assert.equal(s.bookings.length,1);assert.deepEqual(bookingParts(s.bookings[0]).map(p=>[(p.start-start)/hour,(p.end-start)/hour,p.advancedBy]),[[0,2,'p1'],[2,3,'p2']]);
 await add('1号场',end+hour,end+2*hour);await add('2号场',end,end+hour);
 assert.equal(s.bookings.length,3);assert.equal(e.end,end+2*hour);
 // Booked earlier the same day by Carol: the slot now starts with her.
 await add('1号场',start-hour,start,'p3');
 assert.deepEqual(bookingParts(s.bookings[0]).map(p=>p.advancedBy),['p3','p1','p2']);assert.equal(s.bookings[0].start,start-hour);
});

test('moving a slot keeps the booker of each remaining part, and each part can be corrected',async()=>{
 const {s,e}=await fixture(),b=s.bookings[0];
 await apply(s,owner,'feeAdvance',{eventId:e.id,itemId:b.id,advancedBy:'p3',at:start+2*hour,reason:''},after);
 assert.deepEqual(bookingParts(b).map(p=>p.advancedBy),['p1','p3']);
 await assert.rejects(()=>apply(s,owner,'feeAdvance',{eventId:e.id,itemId:b.id,advancedBy:'p3',at:start+hour,reason:''},after),/不存在/);
 await apply(s,owner,'bookingEdit',{bookingId:b.id,name:b.name,start:start+2*hour,end,pricing:'hourly',cents:1200,reason:''},start-86400000);
 assert.equal(b.advancedBy,'p3');assert.equal(b.handovers,undefined,'the part before the new start is gone');
});

test('court settings and the creation form save each part with its own time and booker',async()=>{
 const {s}=await fixture(),b=s.bookings[0];
 // Settings: move the handover to 19:30 and add a third part from 20:30.
 await apply(s,owner,'bookingEdit',{bookingId:b.id,name:b.name,start,end,pricing:'hourly',cents:1200,advancedBy:'p1',handovers:[{at:start+1.5*hour,advancedBy:'p2'},{at:start+2.5*hour,advancedBy:'p3'}],reason:''},start-86400000);
 assert.deepEqual(bookingParts(b).map(p=>[(p.start-start)/hour,p.advancedBy]),[[0,'p1'],[1.5,'p2'],[2.5,'p3']]);
 await assert.rejects(()=>apply(s,owner,'bookingEdit',{bookingId:b.id,name:b.name,start,end,pricing:'hourly',cents:1200,handovers:[{at:end,advancedBy:'p2'}],reason:''},start-86400000),/交接时间/);
 await apply(s,owner,'bookingEdit',{bookingId:b.id,name:b.name,start,end,pricing:'hourly',cents:1200,advancedBy:'p2',handovers:[],reason:''},start-86400000);
 assert.equal(b.advancedBy,'p2');assert.equal(b.handovers,undefined,'an empty list leaves one booker');
 // Creation: a row with parts becomes one court with handovers.
 const form=newEventForm(start-86400000,false,false,[['p1','alice'],['p2','bob']]);
 const local=(h:number)=>new Date(start+h*hour).toLocaleString('sv-SE',{timeZone:'Europe/Madrid'}).slice(0,16).replace(' ','T');
 const body=form.convert!({...form.values,venue:'虚构球馆',start:local(0),end:local(6),courts:[{name:'1号场',start:local(0),end:local(6),advancedBy:'p1',handovers:[{at:local(2),advancedBy:'p2'},{at:local(4),advancedBy:'p1'}]}]}) as {bookings:{advancedBy:string;handovers?:{at:number;advancedBy:string}[]}[]};
 assert.deepEqual(body.bookings.map(x=>[x.advancedBy,x.handovers]),[['p1',[{at:start+2*hour,advancedBy:'p2'},{at:start+4*hour,advancedBy:'p1'}]]]);
 assert.throws(()=>form.convert!({...form.values,venue:'虚构球馆',start:local(0),end:local(6),courts:[{name:'1号场',start:local(0),end:local(6),advancedBy:'p1',handovers:[{at:local(2),advancedBy:''},{at:local(4),advancedBy:'p1'}]}]}),/每一段/);
 assert.throws(()=>form.convert!({...form.values,venue:'虚构球馆',start:local(0),end:local(6),courts:[{name:'1号场',start:local(0),end:local(6),advancedBy:'p1',handovers:[{at:local(3),advancedBy:'p2'}]}]}),/1–2 小时/,'three-hour parts are refused');
});
