import {activityNoticeVersion} from '../lib/activity-notice';
const acceptedActivityNotice={noticeAccepted:true,noticeVersion:activityNoticeVersion};
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Account,type Event} from '../lib/domain/types';
import {bookingRows} from '../lib/domain/booking-signups';
import {friendSignupForm} from '../app/friend-signup-form';
import type {ClubData} from '../lib/contracts/club';
import {projectClubState} from '../lib/club-view';
import {calculateSettlementPreview} from '../lib/domain/money';
import {feeContact} from '../lib/domain/fee-payments';

const start=Date.parse('2026-11-01T15:00:00Z'),end=start+7200000,now=start-86400000;
function fixture(){
 const s=emptyState(),member:Account={id:'member',playerId:'self',email:'',role:'member'};s.accounts.push(member,{...member,id:'other',playerId:'foreign'});
 for(const a of s.accounts)s.players.push({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 const e:Event={id:'event',creatorId:'organizer',title:'Fictional guest signup',venue:'Fictional',address:'',start,end,signupDeadline:end,cancelDeadline:start-86400000,capacity:1,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',note:''};s.events.push(e);s.bookings.push({id:'court',eventId:e.id,name:'Court',start,end,pricing:'total',cents:1200,signupCapacity:1});
 const register=(playerId:string)=>apply(s,member,'courtRegister',{...acceptedActivityNotice,bookingId:'court',playerId,arrival:start,departure:end,note:''},now);return {s,e,member,register};
}
test('ordinary members can create a proxy friend and register them in an open court',async()=>{
 const {s,member,register}=fixture();await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',name:'Fictional friend',ownerId:'forged-owner',bookingId:'court',arrival:start,departure:end,note:''},now);const friend=s.players.at(-1)!;assert.equal(friend.ownerId,member.id);await register(friend.id);assert.equal(bookingRows(s,'court')[0].playerId,friend.id);assert.equal(bookingRows(s,'court')[0].status,'confirmed');
});
test('a full court queues a friend rather than disabling proxy registration',async()=>{
 const {s,member,register}=fixture();await register('self');await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',name:'Fictional waiting friend',bookingId:'court',arrival:start,departure:end,note:''},now);const friend=s.players.at(-1)!;await register(friend.id);assert.equal(bookingRows(s,'court').find(r=>r.playerId===friend.id)!.status,'waitlist');assert.equal(bookingRows(s,'court').filter(r=>r.status==='confirmed').length,1);
});
test('proxy signup retains ownership, disabled-player, time-window and ended-activity checks',async()=>{
 const {s,member,register}=fixture();const before=structuredClone(s);await assert.rejects(()=>register('foreign'),/403/);assert.deepEqual(s,before);await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',name:'Fictional inactive',bookingId:'court',arrival:start,departure:end,note:''},now);const friend=s.players.at(-1)!;friend.enabled=false;await assert.rejects(()=>register(friend.id),/停用/);friend.enabled=true;await assert.rejects(()=>apply(s,member,'courtRegister',{...acceptedActivityNotice,bookingId:'court',playerId:friend.id,arrival:start-1,departure:end,note:''},now),/参加时间/);s.events[0].status='ended';await assert.rejects(()=>register(friend.id),/结束/);
});

test('combined add-and-signup creates a member-owned friend on the court immediately',async()=>{
 const {s,member}=fixture();await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',name:'Fictional one-step',ownerId:'forged',bookingId:'court',arrival:start,departure:end,note:''},now);const friend=s.players.at(-1)!;assert.equal(friend.ownerId,member.id);assert.equal(bookingRows(s,'court')[0].playerId,friend.id);assert.equal(bookingRows(s,'court')[0].status,'confirmed');
});
test('failed combined signup preserves every domain collection, including no orphan friend',async()=>{
 for(const scenario of ['invalid-time','closed','missing','draft'] as const){const {s,member}=fixture();if(scenario==='closed')s.events[0].status='ended';if(scenario==='draft')s.events[0].status='draft';const before=structuredClone(s);await assert.rejects(()=>apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',name:'Not persisted',bookingId:scenario==='missing'?'missing':'court',arrival:scenario==='invalid-time'?start-1:start,departure:end,note:''},now));assert.deepEqual(s,before)}
});
test('existing mode reuses the friend; full capacity queues new friends and rejects foreign ownership',async()=>{
 const {s,member,register}=fixture();await register('self');await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',name:'Fictional queued',bookingId:'court',arrival:start,departure:end,note:''},now);const friend=s.players.at(-1)!;assert.equal(bookingRows(s,'court').find(r=>r.playerId===friend.id)!.status,'waitlist');const count=s.players.length;await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'existing',playerId:friend.id,bookingId:'court',arrival:start,departure:end,note:'updated'},now);assert.equal(s.players.length,count);const before=structuredClone(s);await assert.rejects(()=>apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'existing',playerId:'foreign',bookingId:'court',arrival:start,departure:end,note:''},now),/403/);assert.deepEqual(s,before);
});
test('header court selection uses that court default interval, not another court times',()=>{
 const {s,e,member}=fixture();s.bookings.push({...s.bookings[0],id:'later',name:'Later court',start:start+3600000,end:end+3600000});s.events[0].end=end+3600000;
 const data={me:member,players:s.players,bookings:s.bookings} as Pick<ClubData,'me'|'players'|'bookings'>;
 const form=friendSignupForm(e,data,now)!;assert.ok(form.fields.some(f=>f.key==='bookingId'));const payload=form.convert({...form.values,name:'Fictional later guest',bookingId:'later'});assert.equal(payload.arrival,start+3600000);assert.equal(payload.departure,end+3600000);
});

test('all combined friend form entries close at the member signup deadline while managers retain access',()=>{
 const {s,e,member}=fixture();e.signupDeadline=e.start-7200000;
 const data={me:member,players:s.players,bookings:s.bookings} as Pick<ClubData,'me'|'players'|'bookings'>;
 assert.ok(friendSignupForm(e,data,e.signupDeadline-1));
 assert.equal(friendSignupForm(e,data,e.signupDeadline),null);
 assert.equal(friendSignupForm(e,data,e.signupDeadline,data.bookings[0],true),null);
 assert.ok(friendSignupForm(e,{...data,me:{...data.me,role:'admin'}},e.signupDeadline));
});

test('new visitors are activity-scoped participants with no club profile, but retain fees and the proxy contact',async()=>{
 const {s,member}=fixture();await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',name:'Fictional visitor',bookingId:'court',arrival:start,departure:end,note:''},now);
 const guest=s.players.at(-1)!;assert.equal(guest.guestEventId,'event');assert.equal(guest.profile,undefined);assert.equal(guest.avatarId,undefined);
 assert.deepEqual(feeContact(s,guest.id),{accountId:member.id,proxy:true});
 assert.equal(calculateSettlementPreview(s,s.events[0],now).bills.find(b=>b.playerId===guest.id)!.total,1200);
 const view=projectClubState(s,member,'2026-11',2026,now);
 for(const rows of [view.social.stats,view.social.funny,view.social.personality,view.social.annual,view.leaderboard,view.quarterlyLeaderboard])assert.ok(!rows.some(r=>r.playerId===guest.id));
 const admin={...member,role:'admin' as const},before=structuredClone(s);
 await assert.rejects(()=>apply(s,admin,'profile',{playerId:guest.id,name:'No profile'},now),/临时来宾没有球员档案/);
 await assert.rejects(()=>apply(s,admin,'profileGender',{playerId:guest.id,gender:'female'},now),/临时来宾没有球员档案/);
 assert.deepEqual(s,before);
});

test('guests cannot be reused in another activity; ordinary system profiles remain selectable',async()=>{
 const {s,e,member}=fixture();await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',name:'Fictional scoped visitor',bookingId:'court',arrival:start,departure:end,note:''},now);const guest=s.players.at(-1)!;
 const next={...e,id:'next'};s.events.push(next);s.bookings.push({...s.bookings[0],id:'next-court',eventId:next.id});
 const before=structuredClone(s);
 await assert.rejects(()=>apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'existing',playerId:guest.id,bookingId:'next-court',arrival:start,departure:end,note:''},now),/原活动/);
 await assert.rejects(()=>apply(s,member,'register',{...acceptedActivityNotice,eventId:next.id,playerId:guest.id,arrival:start,departure:end,note:''},now),/原活动/);assert.deepEqual(s,before);
 s.players.push({...s.players[0],id:'existing-system-friend',name:'Fictional existing system friend'});
 const data={me:member,players:s.players,bookings:s.bookings} as Pick<ClubData,'me'|'players'|'bookings'>;
 const fields=friendSignupForm(next,data,now)!.fields,options=fields.find(f=>f.key==='playerId')!.options!;
 assert.ok(!options.some(([id])=>id===guest.id));assert.ok(options.some(([id])=>id==='existing-system-friend'));
});

test('retired standalone friend creation cannot create an unscoped permanent profile',async()=>{
 const {s,member}=fixture(),before=structuredClone(s);
 await assert.rejects(()=>apply(s,member,'friend',{name:'Not a stored profile'},now),/不再创建朋友档案/);assert.deepEqual(s,before);
});
