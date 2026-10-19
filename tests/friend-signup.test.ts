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
import {guestLevels} from '../lib/domain/guests';

const start=Date.parse('2026-11-01T15:00:00Z'),end=start+7200000,now=start-86400000;
function fixture(){
 const s=emptyState(),member:Account={id:'member',playerId:'self',email:'',role:'member'};s.accounts.push(member,{...member,id:'other',playerId:'foreign'});
 for(const a of s.accounts)s.players.push({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 const e:Event={id:'event',creatorId:'organizer',title:'Fictional guest signup',venue:'Fictional',address:'',start,end,signupDeadline:end,cancelDeadline:start-86400000,capacity:1,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',note:''};s.events.push(e);s.bookings.push({id:'court',eventId:e.id,name:'Court',start,end,pricing:'total',cents:1200,signupCapacity:1});
 const register=(playerId:string)=>apply(s,member,'courtRegister',{...acceptedActivityNotice,bookingId:'court',playerId,arrival:start,departure:end,note:''},now);return {s,e,member,register};
}
test('ordinary members can create a proxy friend and register them in an open court',async()=>{
 const {s,member,register}=fixture();await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:'Fictional friend',ownerId:'forged-owner',bookingId:'court',arrival:start,departure:end,note:''},now);const friend=s.players.at(-1)!;assert.equal(friend.ownerId,member.id);await register(friend.id);assert.equal(bookingRows(s,'court')[0].playerId,friend.id);assert.equal(bookingRows(s,'court')[0].status,'confirmed');
});
test('a full court queues a friend rather than disabling proxy registration',async()=>{
 const {s,member,register}=fixture();await register('self');await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:'Fictional waiting friend',bookingId:'court',arrival:start,departure:end,note:''},now);const friend=s.players.at(-1)!;await register(friend.id);assert.equal(bookingRows(s,'court').find(r=>r.playerId===friend.id)!.status,'waitlist');assert.equal(bookingRows(s,'court').filter(r=>r.status==='confirmed').length,1);
});
test('proxy signup retains ownership, disabled-player, time-window and ended-activity checks',async()=>{
 const {s,member,register}=fixture();const before=structuredClone(s);await assert.rejects(()=>register('foreign'),/403/);assert.deepEqual(s,before);await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:'Fictional inactive',bookingId:'court',arrival:start,departure:end,note:''},now);const friend=s.players.at(-1)!;friend.enabled=false;await assert.rejects(()=>register(friend.id),/停用/);friend.enabled=true;await assert.rejects(()=>apply(s,member,'courtRegister',{...acceptedActivityNotice,bookingId:'court',playerId:friend.id,arrival:start-1,departure:end,note:''},now),/参加时间/);s.events[0].status='ended';await assert.rejects(()=>register(friend.id),/结束/);
});

test('combined add-and-signup creates a member-owned friend on the court immediately',async()=>{
 const {s,member}=fixture();await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:'Fictional one-step',ownerId:'forged',bookingId:'court',arrival:start,departure:end,note:''},now);const friend=s.players.at(-1)!;assert.equal(friend.ownerId,member.id);assert.equal(bookingRows(s,'court')[0].playerId,friend.id);assert.equal(bookingRows(s,'court')[0].status,'confirmed');
});
test('failed combined signup preserves every domain collection, including no orphan friend',async()=>{
 for(const scenario of ['invalid-time','closed','missing','draft'] as const){const {s,member}=fixture();if(scenario==='closed')s.events[0].status='ended';if(scenario==='draft')s.events[0].status='draft';const before=structuredClone(s);await assert.rejects(()=>apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:'Not persisted',bookingId:scenario==='missing'?'missing':'court',arrival:scenario==='invalid-time'?start-1:start,departure:end,note:''},now));assert.deepEqual(s,before)}
});
test('existing mode reuses the friend; full capacity queues new friends and rejects foreign ownership',async()=>{
 const {s,member,register}=fixture();await register('self');await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:'Fictional queued',bookingId:'court',arrival:start,departure:end,note:''},now);const friend=s.players.at(-1)!;assert.equal(bookingRows(s,'court').find(r=>r.playerId===friend.id)!.status,'waitlist');const count=s.players.length;await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'existing',playerId:friend.id,bookingId:'court',arrival:start,departure:end,note:'updated'},now);assert.equal(s.players.length,count);const before=structuredClone(s);await assert.rejects(()=>apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'existing',playerId:'foreign',bookingId:'court',arrival:start,departure:end,note:''},now),/403/);assert.deepEqual(s,before);
});
test('header court selection uses that court default interval, not another court times',()=>{
 const {s,e,member}=fixture();s.bookings.push({...s.bookings[0],id:'later',name:'Later court',start:start+3600000,end:end+3600000});s.events[0].end=end+3600000;
 const data={me:member,players:s.players,bookings:s.bookings,registrations:s.registrations} as Pick<ClubData,'me'|'players'|'bookings'|'registrations'>;
 const form=friendSignupForm(e,data,now)!;assert.ok(form.fields.some(f=>f.key==='bookingId'));const payload=form.convert({...form.values,name:'Fictional later guest',gender:'female',bookingId:'later'});assert.equal(payload.arrival,start+3600000);assert.equal(payload.departure,end+3600000);
});

test('friend signup forms omit repeated notice consent for both new and existing participants',()=>{
 const {s,e,member}=fixture();s.players.push({...s.players[0],id:'owned-friend',name:'Fictional existing friend'});
 const data={me:member,players:s.players,bookings:s.bookings,registrations:s.registrations} as Pick<ClubData,'me'|'players'|'bookings'|'registrations'>;
 for(const existing of [false,true]){
  const form=friendSignupForm(e,data,now,data.bookings[0],existing)!;
  assert.ok(form.fields.every(f=>f.type!=='activity-notice'&&f.key!=='noticeAccepted'));
  assert.ok(!('noticeAccepted' in form.values));assert.ok(!('noticeVersion' in form.values));
  const stale={...form.values,name:'Fictional new friend',gender:'female' as const,noticeAccepted:true,noticeVersion:'old-signup-receipt'};
  const payload=form.convert(stale);assert.ok(!('noticeAccepted' in payload));assert.ok(!('noticeVersion' in payload));
  assert.equal(payload.mode,existing?'existing':'new');
 }
});

test('all combined friend form entries close at the member signup deadline while managers retain access',()=>{
 const {s,e,member}=fixture();e.signupDeadline=e.start-7200000;
 const data={me:member,players:s.players,bookings:s.bookings,registrations:s.registrations} as Pick<ClubData,'me'|'players'|'bookings'|'registrations'>;
 assert.ok(friendSignupForm(e,data,e.signupDeadline-1));
 assert.equal(friendSignupForm(e,data,e.signupDeadline),null);
 assert.equal(friendSignupForm(e,data,e.signupDeadline,data.bookings[0],true),null);
 assert.ok(friendSignupForm(e,{...data,me:{...data.me,role:'admin'}},e.signupDeadline));
});

test('new visitors are activity-scoped participants with no club profile, but retain fees and the proxy contact',async()=>{
 const {s,member}=fixture();await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:'Fictional visitor',bookingId:'court',arrival:start,departure:end,note:''},now);
 const guest=s.players.at(-1)!;assert.equal(guest.guestEventId,'event');assert.equal(guest.profile,undefined);assert.equal(guest.guestGender,'male');assert.equal(guest.avatarId,undefined);
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
 const {s,e,member}=fixture();await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:'Fictional scoped visitor',bookingId:'court',arrival:start,departure:end,note:''},now);const guest=s.players.at(-1)!;
 const next={...e,id:'next'};s.events.push(next);s.bookings.push({...s.bookings[0],id:'next-court',eventId:next.id});
 const before=structuredClone(s);
 await assert.rejects(()=>apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'existing',playerId:guest.id,bookingId:'next-court',arrival:start,departure:end,note:''},now),/原活动/);
 await assert.rejects(()=>apply(s,member,'register',{...acceptedActivityNotice,eventId:next.id,playerId:guest.id,arrival:start,departure:end,note:''},now),/原活动/);assert.deepEqual(s,before);
 s.players.push({...s.players[0],id:'existing-system-friend',name:'Fictional existing system friend'});
 const data={me:member,players:s.players,bookings:s.bookings,registrations:s.registrations} as Pick<ClubData,'me'|'players'|'bookings'|'registrations'>;
 const fields=friendSignupForm(next,data,now)!.fields,options=fields.find(f=>f.key==='playerId')!.options!;
 assert.ok(!options.some(([id])=>id===guest.id));assert.ok(options.some(([id])=>id==='existing-system-friend'));
});

test('retired standalone friend creation cannot create an unscoped permanent profile',async()=>{
 const {s,member}=fixture(),before=structuredClone(s);
 await assert.rejects(()=>apply(s,member,'friend',{name:'Not a stored profile'},now),/不再创建朋友档案/);assert.deepEqual(s,before);
});

test('a new friend must give a gender, and the registrant or an organiser can correct it later',async()=>{
 const {s,member}=fixture(),before=structuredClone(s);
 const signup={...acceptedActivityNotice,mode:'new',name:'Fictional friend without gender',bookingId:'court',arrival:start,departure:end,note:''};
 await assert.rejects(()=>apply(s,member,'friendSignup',signup,now),/请选择朋友性别/);
 await assert.rejects(()=>apply(s,member,'friendSignup',{...signup,gender:'undisclosed'},now),/请选择朋友性别/);
 assert.deepEqual(s,before,'a rejected signup leaves no friend behind');
 await apply(s,member,'friendSignup',{...signup,gender:'female'},now);
 const friend=s.players.at(-1)!;assert.equal(friend.guestGender,'female');assert.equal(friend.profile,undefined);
 await apply(s,member,'guestGender',{playerId:friend.id,gender:'male'},now);assert.equal(friend.guestGender,'male');
 assert.equal(s.audits.at(-1)!.action,'guestGender');
 const other=s.accounts.find(a=>a.id==='other')!,unchanged=structuredClone(s);
 await assert.rejects(()=>apply(s,other,'guestGender',{playerId:friend.id,gender:'female'},now),/403/);
 await assert.rejects(()=>apply(s,{...member,role:'admin'},'guestGender',{playerId:'self',gender:'female'},now),/只有代报名的朋友/);
 assert.deepEqual(s,unchanged);
 await apply(s,{...other,role:'admin'},'guestGender',{playerId:friend.id,gender:'female'},now);assert.equal(friend.guestGender,'female');
});

test('the friend form asks for the gender of a new friend only',()=>{
 const {s,e,member}=fixture();s.players.push({...s.players[0],id:'owned-friend',name:'Fictional existing friend'});
 const data={me:member,players:s.players,bookings:s.bookings,registrations:s.registrations} as Pick<ClubData,'me'|'players'|'bookings'|'registrations'>;
 const form=friendSignupForm(e,data,now)!,gender=form.fields.find(f=>f.key==='gender')!;
 assert.deepEqual(gender.options,[['male','男'],['female','女']]);assert.deepEqual(gender.when,{key:'mode',value:'new'});assert.equal(form.values.gender,'');
 assert.throws(()=>form.convert({...form.values,name:'Fictional friend'}),/请选择朋友性别/);
 const created=form.convert({...form.values,name:'Fictional friend',gender:'male'});assert.ok(created.mode==='new'&&created.gender==='male');
 assert.ok(!('gender' in form.convert({...form.values,mode:'existing',playerId:'owned-friend'})));
});

/** A second activity a week later, with its own court, and a friend "aq" the member brought to the first one. */
async function twoActivities(){
 const f=fixture(),{s,member}=f,admin:Account={id:'admin',playerId:'admin-p',email:'',role:'admin'};s.accounts.push(admin);s.players.push({...s.players[0],id:'admin-p',name:'admin',ownerId:'admin'});
 const level=guestLevels[2][0];
 await apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'female',guestLevel:level,name:'aq',bookingId:'court',arrival:start,departure:end,note:''},now);
 const week=7*86400000,e2:Event={...f.e,id:'event2',start:start+week,end:end+week,signupDeadline:end+week,capacity:8};s.events.push(e2);s.bookings.push({...s.bookings[0],id:'court2',eventId:'event2',start:start+week,end:end+week});
 const data=(me:Account)=>({me,players:s.players,bookings:s.bookings,registrations:s.registrations}) as Pick<ClubData,'me'|'players'|'bookings'|'registrations'>;
 return {...f,admin,e2,level,data,first:s.players.find(p=>p.name==='aq')!};
}
test('the same nickname cannot be added twice to one activity',async()=>{
 const {s,e,member,data}=await twoActivities(),before=structuredClone(s);
 await assert.rejects(()=>apply(s,member,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:' AQ ',bookingId:'court',arrival:start,departure:end,note:''},now),/已经在本场接龙了.*代朋友接龙/);
 assert.deepEqual(s,before);
 const form=friendSignupForm(e,data(member),now)!;assert.throws(()=>form.convert({...form.values,mode:'new',name:'aq',gender:'female'}),/已经在本场接龙了/);
});
test('my friends: a friend brought before is chosen again with their nickname, gender and level, still owed by the first host',async()=>{
 const {s,e2,member,admin,data,level,first}=await twoActivities();
 const mine=friendSignupForm(e2,data(member),now,undefined,true)!;
 assert.deepEqual(mine.fields.find(f=>f.key==='mode')!.options!.map(o=>o[1]).slice(0,2),['新建临时来宾','我的朋友']);
 assert.equal(mine.values.mode,'saved');const payload=mine.convert(mine.values);assert.deepEqual([payload.mode,'sourcePlayerId' in payload&&payload.sourcePlayerId],['saved',first.id]);
 await apply(s,member,'friendSignup',{...acceptedActivityNotice,...payload},now);
 const copy=s.players.at(-1)!;assert.deepEqual([copy.name,copy.guestGender,copy.rating,copy.ownerId,copy.guestEventId],['aq','female',level,member.id,'event2']);assert.notEqual(copy.id,first.id);
 // Already here: the friend is offered for another court instead of a second copy.
 const again=friendSignupForm(e2,data(member),now,undefined,true)!;assert.match(again.fields.find(f=>f.key==='saved')!.options![0][1],/已在本场/);assert.equal(again.convert(again.values).mode,'existing');
 // Admins see every guest (their labels come from the projected view, tested below).
 const adminForm=friendSignupForm(e2,data(admin),now,undefined,true)!;assert.equal(adminForm.fields.find(f=>f.key==='mode')!.options!.find(o=>o[0]==='saved')![1],'全部临时来宾');
});
test('members cannot reuse a friend someone else brought; 羽林同门 lists members only',async()=>{
 const {s,e2,admin,first,data}=await twoActivities(),other=s.accounts.find(a=>a.id==='other')!;
 await assert.rejects(()=>apply(s,other,'friendSignup',{...acceptedActivityNotice,mode:'saved',sourcePlayerId:first.id,bookingId:'court2',arrival:start+7*86400000,departure:end+7*86400000,note:''},now),/403/);
 await apply(s,admin,'friendSignup',{...acceptedActivityNotice,mode:'saved',sourcePlayerId:first.id,bookingId:'court2',arrival:start+7*86400000,departure:end+7*86400000,note:''},now);assert.equal(s.players.at(-1)!.ownerId,'member','an admin adding a friend keeps the first host');
 const form=friendSignupForm(e2,data(admin),now)!,members=form.fields.find(f=>f.key==='playerId')!.options!.map(o=>o[1]);
 assert.ok(members.length&&members.every(n=>n!=='aq'),'no guests among 羽林同门');
});
test('in the real view admins see each host\'s friends separately, labelled with who brought them',async()=>{
 const {s,e2,admin}=await twoActivities(),other=s.accounts.find(a=>a.id==='other')!;
 // Another member brings their own "aq" to the second activity; the views hide other members' owners.
 await apply(s,other,'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:'aq',bookingId:'court2',arrival:start+7*86400000,departure:end+7*86400000,note:''},now);
 const view=projectClubState(s,admin,'2026-11',2026,now) as unknown as ClubData,event=view.events.find(x=>x.id===e2.id)! as unknown as Event;
 assert.ok(view.players.filter(p=>p.guest).every(p=>p.ownerId===''),'owners stay hidden');
 const form=friendSignupForm(event,{me:view.me,players:view.players,bookings:view.bookings,registrations:view.registrations},now,undefined,true)!;
 const labels=form.fields.find(f=>f.key==='saved')!.options!.map(o=>o[1]).sort();
 assert.deepEqual(labels,['aq · member带来','aq · 已在本场，可报其他场地 · other带来']);
});
