import {activityNoticeVersion} from '../lib/activity-notice';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Account,type Event} from '../lib/domain/types';
import {friendSignupForm} from '../app/friend-signup-form';
import {projectClubState} from '../lib/club-view';
import {guestLevels} from '../lib/domain/guests';
import type {ClubData} from '../lib/contracts/club';

const notice={noticeAccepted:true,noticeVersion:activityNoticeVersion},week=7*86400000,start=Date.parse('2026-11-01T15:00:00Z'),end=start+7200000,now=start-86400000;
/** Two members each brought a friend they call "aq" / "AQ 2" to one of two past-and-future activities. */
async function fixture(){
 const s=emptyState(),admin:Account={id:'admin',playerId:'pa',email:'',role:'admin'},alice:Account={id:'alice',playerId:'p1',email:'',role:'member'},bob:Account={id:'bob',playerId:'p2',email:'',role:'member'};
 s.settings.initialized=true;s.settings.ownerAccountId='admin';s.accounts.push(admin,alice,bob);
 for(const a of s.accounts)s.players.push({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 const event=(id:string,at:number):Event=>({id,creatorId:'admin',title:'Fictional '+id,venue:'Fictional',address:'',start:at,end:at+7200000,signupDeadline:at+7200000,cancelDeadline:at-86400000,capacity:8,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',note:''});
 for(const [i,e] of [event('one',start),event('two',start+week)].entries()){s.events.push(e);s.bookings.push({id:'court-'+i,eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:1200})}
 const add=(a:Account,name:string,court:string)=>{const b=s.bookings.find(x=>x.id===court)!;return apply(s,a,'friendSignup',{...notice,mode:'new',gender:'female',guestLevel:guestLevels[1][0],name,bookingId:court,arrival:b.start,departure:b.end,note:''},now)};
 await add(alice,'aq','court-0');await add(bob,'AQ 2','court-1');
 const guest=(name:string)=>s.players.find(p=>p.name===name)!;
 return {s,admin,alice,bob,add,guest};
}
const view=(s:ReturnType<typeof emptyState>,a:Account)=>projectClubState(s,a,'2026-11',2026,now) as unknown as ClubData;

test('only the owner and admins manage recorded friends',async()=>{
 const {s,alice,guest}=await fixture(),before=structuredClone(s);
 for(const [action,payload] of [['guestFriendMerge',{playerIds:[guest('aq').id,guest('AQ 2').id],name:'aq',hostPlayerId:'p1'}],['guestFriendEdit',{playerId:guest('aq').id,name:'x',gender:'male',level:guestLevels[0][0]}],['guestFriendHide',{playerId:guest('aq').id,hidden:true}]] as const)
  await assert.rejects(()=>apply(s,alice,action,payload,now),/403/);
 assert.deepEqual(s,before);
});

test('merging duplicates gives one friend, one nickname and the chosen host; history stays',async()=>{
 const {s,admin,alice,guest}=await fixture(),regs=structuredClone(s.registrations),a=guest('aq').id,b=guest('AQ 2').id;
 await assert.rejects(()=>apply(s,admin,'guestFriendMerge',{playerIds:[a,b],name:'aq',hostPlayerId:'pa'},now),/带来人之一/);
 await apply(s,admin,'guestFriendMerge',{playerIds:[a,b],name:'aq',hostPlayerId:'p1'},now);
 const records=s.players.filter(p=>p.guestEventId);
 assert.equal(new Set(records.map(p=>p.guestFriendId)).size,1);assert.ok(records[0].guestFriendId);
 assert.deepEqual(records.map(p=>[p.name,p.ownerId]),[['aq','alice'],['aq','alice']]);
 assert.deepEqual(s.registrations,regs,'signups are untouched');
 // The admin's friend list now shows one friend, already signed up for the second activity.
 const v=view(s,admin),e=v.events.find(x=>x.id==='two')! as unknown as Event;
 const form=friendSignupForm(e,{me:v.me,players:v.players,bookings:v.bookings,registrations:v.registrations},now,undefined,true)!;
 assert.deepEqual(form.fields.find(f=>f.key==='saved')!.options!.map(o=>o[1]),['aq · 已在本场，可报其他场地 · alice带来']);
 // A later activity copies the merged friend and keeps them in the same group.
 s.events.push({...s.events[1],id:'three',start:start+2*week,end:end+2*week,signupDeadline:end+2*week});s.bookings.push({...s.bookings[1],id:'court-2',eventId:'three',start:start+2*week,end:end+2*week});
 await apply(s,alice,'friendSignup',{...notice,mode:'saved',sourcePlayerId:a,bookingId:'court-2',arrival:start+2*week,departure:end+2*week,note:''},now);
 assert.equal(s.players.at(-1)!.guestFriendId,records[0].guestFriendId);
});

test('editing updates every record and sets the level from now on; removing hides the friend from the lists',async()=>{
 const {s,admin,alice,add,guest}=await fixture();await add(alice,'aq','court-1');
 const [first,second]=s.players.filter(p=>p.name==='aq');
 await apply(s,admin,'guestFriendEdit',{playerId:first.id,name:'阿Q',gender:'male',level:guestLevels[3][0]},now+1000);
 assert.deepEqual([first.name,second.name,first.guestGender,second.guestGender],['阿Q','阿Q','male','male']);
 assert.equal(second.guestLevels!.at(-1)!.level,guestLevels[3][0]);assert.equal(first.guestLevels!.at(-1)!.level,guestLevels[1][0],'earlier records keep their level');
 await apply(s,admin,'guestFriendHide',{playerId:first.id,hidden:true},now);assert.ok(first.guestHidden&&second.guestHidden);
 const v=view(s,alice),e=v.events.find(x=>x.id==='two')! as unknown as Event;
 const options=friendSignupForm(e,{me:v.me,players:v.players,bookings:v.bookings,registrations:v.registrations},now,undefined,true)!.fields.find(f=>f.key==='saved')?.options??[];
 assert.ok(!options.some(o=>o[1].startsWith('阿Q')),'a removed friend is not offered');assert.ok(guest('AQ 2'));
 await apply(s,admin,'guestFriendHide',{playerId:first.id,hidden:false},now);assert.equal(first.guestHidden,undefined);
});
