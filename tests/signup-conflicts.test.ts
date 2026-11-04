import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Account,type Event} from '../lib/domain/types';
import {friendSignupForm} from '../app/friend-signup-form';
import type {ClubData} from '../lib/contracts/club';

const hour=3600000,start=Date.parse('2030-11-01T12:00:00Z'),end=start+2*hour,now=start-3*86400000;
function fixture(){
 const s=emptyState(),owner:Account={id:'owner',playerId:'host',role:'admin',email:''};
 const member:Account={id:'member',playerId:'member-player',role:'member',email:''};
 s.accounts.push(owner,member);
 s.players=s.accounts.map(a=>({id:a.playerId,ownerId:a.id,name:a.id==='member'?'羽林球友':'虚构群主',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 const e:Event={id:'event',creatorId:owner.id,title:'虚构接龙',start,end:end+2*hour,venue:'虚构球馆',address:'',status:'open',capacity:8,signupDeadline:start-2*hour,cancelDeadline:start-86400000,note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events.push(e);
 s.bookings.push({id:'A',eventId:e.id,name:'一号场',start,end,pricing:'total',cents:1200},
  {id:'B',eventId:e.id,name:'二号场',start,end,pricing:'total',cents:1200},
  {id:'C',eventId:e.id,name:'后半场',start:end,end:end+2*hour,pricing:'total',cents:1200});
 const court=(playerId:string,bookingId='A',extra={})=>apply(s,owner,'courtRegister',{playerId,bookingId,arrival:s.bookings.find(b=>b.id===bookingId)!.start,departure:s.bookings.find(b=>b.id===bookingId)!.end,note:'原备注',...extra},now);
 const friend=(playerId=member.playerId,bookingId='A',extra={})=>apply(s,owner,'friendSignup',{mode:'existing',playerId,bookingId,arrival:s.bookings.find(b=>b.id===bookingId)!.start,departure:s.bookings.find(b=>b.id===bookingId)!.end,note:'重复提交',...extra},now);
 return {s,e,owner,member,court,friend};
}

test('本人接龙后代报名不能覆盖原记录，正式及候补均受保护，原接龙仍可修改',async()=>{
 for(const waiting of [false,true]){
  const {s,member,court,friend}=fixture();
  if(waiting){s.bookings[0].signupCapacity=1;await court('host')}
  await court(member.playerId);const before=structuredClone(s);
  await assert.rejects(()=>friend(),/已接龙该时段/);assert.deepEqual(s,before);
  await court(member.playerId,'A',{note:'从原接龙修改'});
  const reg=s.registrations.find(r=>r.playerId===member.playerId)!;
  assert.equal(reg.bookingSignups![0].note,'从原接龙修改');
  assert.equal(reg.bookingSignups![0].status,waiting?'waitlist':'confirmed');
 }
});

test('重叠场地重复接龙拒绝，首尾相接和不同时间仍可分别报名',async()=>{
 const {s,member,court,friend}=fixture();await court(member.playerId);
 await assert.rejects(()=>friend(member.playerId,'B'),/已接龙该时段/);
 await friend(member.playerId,'C');
 assert.equal(s.registrations.length,1);assert.equal(s.registrations[0].bookingSignups!.length,2);
});

test('申请取消不释放接龙，取消生效后可重新接龙',async()=>{
 const {s,owner,member,court,friend}=fixture();await court(member.playerId);
 await apply(s,member,'courtCancel',{bookingId:'A',playerId:member.playerId,reason:'虚构取消申请'},start-3*hour);
 assert.equal(s.registrations[0].cancelRequested,true);
 const before=structuredClone(s);await assert.rejects(()=>friend(),/已接龙该时段/);assert.deepEqual(s,before);
 await apply(s,owner,'courtCancel',{bookingId:'A',playerId:member.playerId,reason:'批准取消'},start-3*hour);
 await friend();assert.equal(s.registrations[0].status,'confirmed');assert.equal(s.registrations[0].bookingSignups!.length,1);
});

test('同名临时来宾不能绕过正式成员的接龙，也不会留下孤立档案',async()=>{
 const {s,owner,member,court}=fixture();await court(member.playerId);
 const before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'friendSignup',{mode:'new',name:' 羽 林 球友 ',gender:'male',bookingId:'B',arrival:start,departure:end,note:''},now),/已接龙该时段/);
 assert.deepEqual(s,before);
 // A different time remains available even when their name matches an earlier participant.
 await apply(s,owner,'friendSignup',{mode:'new',name:'羽林球友',gender:'male',bookingId:'C',arrival:end,departure:end+hour,note:''},now);
 assert.equal(s.registrations.length,2);
});

test('已合并的来宾改名后，直接场地及旧活动报名也不能绕过重叠校验',async()=>{
 const {s,owner,court}=fixture();
 for(const [id,name] of [['guest-a','朋友甲'],['guest-b','朋友新昵称']])s.players.push({...s.players[0],id,name,guestEventId:'event',guestFriendId:'same-friend'});
 await court('guest-a');const before=structuredClone(s);
 await assert.rejects(()=>court('guest-b','B'),/已接龙该时段/);
 await assert.rejects(()=>apply(s,owner,'register',{eventId:'event',playerId:'guest-b',arrival:start,departure:end,note:''},now),/已接龙该时段/);
 assert.deepEqual(s,before);
});

test('正式球友反向报名也会检查同名临时来宾，两个同名正式账号不按昵称合并',async()=>{
 const {s,member,court}=fixture();s.players.push({...s.players[0],id:'guest',name:'羽林球友',guestEventId:'event'});
 await court('guest');await assert.rejects(()=>court(member.playerId,'B'),/已接龙该时段/);
 const other=fixture();other.s.players[0].name=other.s.players[1].name;
 await other.court('host');await other.court(other.member.playerId);assert.equal(other.s.registrations.length,2);
});

test('代接龙表单按填写的参加时间拦截重复，刷新前的表单由后端再次校验',async()=>{
 const {s,e,owner,member,court,friend}=fixture();
 const data=()=>({me:owner,players:s.players,bookings:s.bookings,registrations:s.registrations}) as Pick<ClubData,'me'|'players'|'bookings'|'registrations'>;
 const stale=friendSignupForm(e,structuredClone(data()),now,data().bookings[0],true)!;
 const payload=stale.convert({...stale.values,mode:'existing',playerId:member.playerId});
 await court(member.playerId);
 const current=friendSignupForm(e,data(),now,data().bookings[0],true)!;
 assert.throws(()=>current.convert({...current.values,mode:'existing',playerId:member.playerId}),/已接龙该时段/);
 assert.throws(()=>current.convert({...current.values,mode:'new',name:'羽林球友',gender:'male'}),/已接龙该时段/);
 assert.equal(friendSignupForm(e,data(),now,data().bookings[2],true)!.convert({...current.values,bookingId:'C',mode:'existing',playerId:member.playerId}).arrival,end);
 await assert.rejects(()=>apply(s,owner,'friendSignup',payload,now),/已接龙该时段/);
 await friend(member.playerId,'C');
});
