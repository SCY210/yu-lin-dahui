import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {bookingOccupancy,bookingRows} from '../lib/domain/booking-signups';
import {emptyState,type Event} from '../lib/domain/types';
import {upgradeActivitySignups} from '../lib/domain/event-merge';

const hour=3600000,start=Date.parse('2030-11-01T17:00:00Z'),middle=start+2*hour,end=start+4*hour,early=start-3*86400000;
function fixture(capacity=1){
 const s=emptyState(),owner={id:'owner',playerId:'p0',role:'admin' as const,email:''};s.accounts.push(owner);
 for(let i=0;i<15;i++)s.players.push({id:'p'+i,ownerId:owner.id,name:'虚构球友'+i,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
 const e:Event={id:'event',creatorId:owner.id,title:'分时段名额',start,end,venue:'虚构球馆',address:'',status:'open',capacity,signupDeadline:start-2*hour,cancelDeadline:start-24*hour,note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};s.events.push(e);
 s.bookings.push({id:'court',eventId:e.id,name:'一号场',start,end,signupCapacity:capacity,pricing:'hourly',cents:690});
 const join=(i:number,arrival=start,departure=end,now=early)=>apply(s,owner,'courtRegister',{bookingId:'court',playerId:'p'+i,arrival,departure,note:''},now);
 const cancel=(i:number)=>apply(s,owner,'courtCancel',{bookingId:'court',playerId:'p'+i,reason:'虚构取消'},early);
 const row=(i:number)=>s.registrations.find(r=>r.playerId==='p'+i)!.bookingSignups![0];
 return {s,e,owner,join,cancel,row};
}

test('17到21点预约：17到19与19到21各自正式接龙，边界不重叠',async()=>{
 const {s,join,row}=fixture();await join(1,start,middle);await join(2,middle,end);await join(3,start,end);
 assert.equal(row(1).status,'confirmed');assert.equal(row(2).status,'confirmed');assert.equal(row(3).status,'waitlist');
 assert.equal(row(2).joinedAsWaitlist,false);assert.equal(row(2).promotedAt,undefined);
 assert.deepEqual(bookingOccupancy(bookingRows(s,'court'),start,end),{peak:1,minimum:1});
});

test('每段上限6人可接两批共12人，编辑场地按同时人数检查上限',async()=>{
 const {s,e,owner,join}=fixture(6);for(let i=1;i<=6;i++)await join(i,start,middle);for(let i=7;i<=12;i++)await join(i,middle,end);
 assert.equal(bookingRows(s,'court').filter(r=>r.status==='confirmed').length,12);
 upgradeActivitySignups(s,e);assert.equal(s.bookings[0].signupCapacity,6,'转换名单不能把累计12人误当作同时人数并扩大上限');
 const input={bookingId:'court',name:'一号场',start,end,pricing:'hourly',cents:690,signupCapacity:6,reason:'保持分时段人数上限'};
 await apply(s,owner,'bookingEdit',input,early);assert.equal(s.bookings[0].signupCapacity,6);
 const before=structuredClone(s);await assert.rejects(()=>apply(s,owner,'bookingEdit',{...input,signupCapacity:5},early),/上限/);assert.deepEqual(s,before);
});

test('重叠区间满员才候补，前面的长时段候补不会堵住后面空闲时段',async()=>{
 const {join,row,cancel}=fixture();await join(1,start,middle);await join(2,start,end);await join(3,middle,end);
 assert.equal(row(2).status,'waitlist');assert.equal(row(3).status,'confirmed');
 await cancel(1);assert.equal(row(2).status,'waitlist','后半段仍有人，整段候补不能超额');
 await cancel(3);assert.equal(row(2).status,'confirmed');
});

test('按最大同时人数计算，两个相接的短时段不会把跨段名额算满',async()=>{
 const {s,join,row}=fixture(2);await join(1,start,start+hour);await join(2,start+hour,middle);await join(3,start,middle);
 assert.equal(row(3).status,'confirmed');assert.equal(bookingOccupancy(bookingRows(s,'court'),start,middle).peak,2);
});

test('正式接龙不能扩大到已满的重叠时段，缩短后候补按实际空位递补',async()=>{
 const {s,join,row}=fixture();await join(1,start,middle);await join(2,middle,end);await join(3,start,middle);
 const before=structuredClone(s);await assert.rejects(()=>join(1,start,end),/参加时段已满/);assert.deepEqual(s,before);
 await join(1,start,start+hour);assert.equal(row(3).status,'waitlist');
 await join(3,start+hour,middle);assert.equal(row(3).status,'confirmed');
 assert.equal(bookingOccupancy(bookingRows(s,'court'),start,end).peak,1);
});

test('取消申请仍占该时间名额，批准后仅递补能完整容纳的参加区间',async()=>{
 const {s,owner,join,row}=fixture();s.accounts.push({id:'member',playerId:'p1',role:'member',email:''});s.players[1].ownerId='member';
 await join(1,start,middle);await join(2,start,middle);await join(3,middle,end);
 await apply(s,s.accounts[1],'courtCancel',{bookingId:'court',playerId:'p1',reason:'虚构申请'},start-3*hour);
 assert.equal(row(1).cancelRequested,true);assert.equal(row(2).status,'waitlist');assert.equal(row(3).status,'confirmed');
 await apply(s,owner,'courtCancel',{bookingId:'court',playerId:'p1',reason:'批准'},start-3*hour);
 assert.equal(row(2).status,'confirmed');assert.equal(row(3).status,'confirmed');
});
