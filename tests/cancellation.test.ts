import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {cancellationDeadline,cancellationNeedsApproval,CANCELLATION_NOTICE} from '../lib/domain/cancellation';
import {emptyState,type Account,type Event} from '../lib/domain/types';

const start=Date.parse('2026-10-07T16:00:00Z'),cutoff=start-CANCELLATION_NOTICE;
function fixture(){
 const s=emptyState(),member:Account={id:'member',playerId:'self',email:'',role:'member'},creator:Account={id:'creator',playerId:'creator-player',email:'',role:'member'},admin:Account={id:'admin',playerId:'admin-player',email:'',role:'admin'};
 s.accounts.push(member,creator,admin);const e:Event={id:'event',creatorId:creator.id,title:'取消验收',start,end:start+7200000,venue:'测试',address:'',capacity:1,signupDeadline:start,cancelDeadline:start,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};s.events.push(e);
 for(const [id,ownerId,status] of [['self','member','confirmed'],['waiting','admin','waitlist'],['friend','member','waitlist']] as const){s.players.push({id,ownerId,name:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});s.registrations.push({id:'reg-'+id,eventId:e.id,playerId:id,sequence:s.registrations.length+1,status,arrival:start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}})}
 const cancel=(actor=member,playerId='self',now=cutoff)=>apply(s,actor,'cancel',{eventId:e.id,playerId,reason:'取消报名'},now);
 return {s,e,member,creator,admin,cancel};
}

test('取消截止始终等于开始前24小时，包括夏令时日期，不依赖自定义截止',()=>{
 assert.equal(cancellationDeadline({start}),cutoff);const dstStart=Date.parse('2026-03-29T16:00:00Z');assert.equal(dstStart-cancellationDeadline({start:dstStart}),86400000);
 assert.equal(cancellationNeedsApproval({start},cutoff-1),false);assert.equal(cancellationNeedsApproval({start},cutoff),false);assert.equal(cancellationNeedsApproval({start},cutoff+1),true);
});
test('至少提前24小时直接取消，释放正式名额并递补候补，重复取消保持幂等',async()=>{
 const {s,cancel}=fixture();await cancel();assert.equal(s.registrations[0].status,'cancelled');assert.equal(s.registrations[0].cancelRequested,false);assert.equal(s.registrations[1].status,'confirmed');assert.equal(s.attendance.length,0);
 const before=structuredClone(s);await cancel();assert.deepEqual(s,before);
});
test('距离开始不足24小时只能申请：不释放名额、不递补、不改出勤',async()=>{
 const {s,cancel}=fixture();await cancel(undefined,undefined,cutoff+1);assert.equal(s.registrations[0].status,'confirmed');assert.equal(s.registrations[0].cancelRequested,true);assert.equal(s.registrations[1].status,'waitlist');assert.equal(s.attendance.length,0);
});
test('旧活动自定义截止不能放宽或提前改变固定24小时规则',async()=>{
 for(const old of [start,start+3600000]){const {s,e,cancel}=fixture();e.cancelDeadline=old;await cancel(undefined,undefined,cutoff+1);assert.equal(s.registrations[0].status,'confirmed');assert.equal(s.registrations[0].cancelRequested,true)}
 const {s,e,cancel}=fixture();e.cancelDeadline=cutoff-3600000;await cancel();assert.equal(s.registrations[0].status,'cancelled');
});
test('代报朋友同样受截止限制；不能取消别人的报名',async()=>{
 const {s,cancel}=fixture();await cancel(undefined,'friend',cutoff+1);assert.equal(s.registrations[2].status,'waitlist');assert.equal(s.registrations[2].cancelRequested,true);
 const before=structuredClone(s);await assert.rejects(()=>cancel(undefined,'waiting',cutoff-1),/403/);assert.deepEqual(s,before);
});
test('创建者和管理员可处理超过截止的取消申请，释放名额并递补',async()=>{
 for(const role of ['creator','admin'] as const){const f=fixture();await f.cancel(undefined,undefined,cutoff+1);await f.cancel(f[role],'self',cutoff+2);assert.equal(f.s.registrations[0].status,'cancelled');assert.equal(f.s.registrations[0].cancelRequested,false);assert.equal(f.s.registrations[1].status,'confirmed')}
});
test('创建和编辑时服务器强制固定取消截止，客户端不能伪造',async()=>{
 const {s,e,member,creator}=fixture();await apply(s,member,'event',{title:'新活动',start,end:e.end,venue:'测试',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'open',bookings:[{name:'1号场',start,end:e.end,pricing:'hourly',cents:690}]},cutoff-1);assert.equal(s.events.at(-1)!.cancelDeadline,cutoff);
 await apply(s,creator,'eventEdit',{eventId:e.id,title:e.title,venue:e.venue,address:'',capacity:1,signupDeadline:start,cancelDeadline:start+60000,note:'',reason:'编辑活动'},cutoff-1);assert.equal(e.cancelDeadline,cutoff);
});
