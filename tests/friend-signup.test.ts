import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Account,type Event} from '../lib/domain/types';
import {bookingRows} from '../lib/domain/booking-signups';

const start=Date.parse('2026-11-01T15:00:00Z'),end=start+7200000,now=start-86400000;
function fixture(){
 const s=emptyState(),member:Account={id:'member',playerId:'self',email:'',role:'member'};s.accounts.push(member,{...member,id:'other',playerId:'foreign'});
 for(const a of s.accounts)s.players.push({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 const e:Event={id:'event',creatorId:'organizer',title:'Fictional guest signup',venue:'Fictional',address:'',start,end,signupDeadline:end,cancelDeadline:start-86400000,capacity:1,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',note:''};s.events.push(e);s.bookings.push({id:'court',eventId:e.id,name:'Court',start,end,pricing:'total',cents:1200,signupCapacity:1});
 const register=(playerId:string)=>apply(s,member,'courtRegister',{bookingId:'court',playerId,arrival:start,departure:end,note:''},now);return {s,e,member,register};
}
test('ordinary members can create a proxy friend and register them in an open court',async()=>{
 const {s,member,register}=fixture();await apply(s,member,'friend',{name:'Fictional friend',ownerId:'forged-owner'},now);const friend=s.players.at(-1)!;assert.equal(friend.ownerId,member.id);await register(friend.id);assert.equal(bookingRows(s,'court')[0].playerId,friend.id);assert.equal(bookingRows(s,'court')[0].status,'confirmed');
});
test('a full court queues a friend rather than disabling proxy registration',async()=>{
 const {s,member,register}=fixture();await register('self');await apply(s,member,'friend',{name:'Fictional waiting friend'},now);const friend=s.players.at(-1)!;await register(friend.id);assert.equal(bookingRows(s,'court').find(r=>r.playerId===friend.id)!.status,'waitlist');assert.equal(bookingRows(s,'court').filter(r=>r.status==='confirmed').length,1);
});
test('proxy signup retains ownership, disabled-player, time-window and ended-activity checks',async()=>{
 const {s,e,member,register}=fixture();const before=structuredClone(s);await assert.rejects(()=>register('foreign'),/403/);assert.deepEqual(s,before);await apply(s,member,'friend',{name:'Fictional inactive'},now);const friend=s.players.at(-1)!;friend.enabled=false;await assert.rejects(()=>register(friend.id),/停用/);friend.enabled=true;await assert.rejects(()=>apply(s,member,'courtRegister',{bookingId:'court',playerId:friend.id,arrival:start-1,departure:end,note:''},now),/参加时间/);e.status='ended';await assert.rejects(()=>register(friend.id),/结束/);
});
