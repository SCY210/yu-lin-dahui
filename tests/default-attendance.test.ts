import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Event} from '../lib/domain/types';
import {attendanceForEvent,enableDefaultAttendance,applyDefaultAttendance} from '../lib/domain/attendance';
import {propose,readyIds} from '../lib/domain/grouping';
import {calculateSettlement} from '../lib/domain/money';
import {rotationPlan} from '../lib/domain/play';
import {apply} from '../lib/domain/commands';

const start=Date.parse('2027-01-10T14:00:00Z'),hour=3600000,end=start+2*hour;
function fixture(){
 const s=emptyState();s.settings.initialized=true;
 const e:Event={id:'event',title:'默认参加测试',start,end,venue:'测试球馆',address:'',capacity:4,signupDeadline:end,cancelDeadline:end,note:'',status:'live',courtMode:'interval',ballMode:'interval',attendanceMode:'automatic'};
 s.events.push(e);s.accounts.push({id:'admin',playerId:'A',role:'admin',email:''});
 for(const [i,id]of ['A','B','C','D','E'].entries()){
  s.players.push({id,ownerId:'admin',name:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'测试'});
  s.registrations.push({id:'reg'+id,eventId:e.id,playerId:id,sequence:i+1,status:i<4?'confirmed':'waitlist',arrival:start,departure:end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''},registeredAt:start-hour,joinedAsWaitlist:i===4});
 }
 s.bookings.push({id:'court',eventId:e.id,name:'一号场',start,end,pricing:'hourly',cents:1200});return {s,e};
}

test('四名正式球友无需签到即可排双打；候补不进入分组或费用',()=>{
 const {s,e}=fixture();assert.equal(s.attendance.length,0);
 assert.deepEqual(readyIds(s,e.id,start),['A','B','C','D']);assert.equal(propose(s,e,start,20,1).courts.length,1);
 assert.equal(rotationPlan(s,e,start).players,4);const result=calculateSettlement(s,e,end);
 assert.deepEqual(result.bills.map(b=>b.total),[600,600,600,600]);assert.equal(result.unallocated,0);assert.equal(s.attendance.length,0);
});

test('计划参加时间限定排场；尚未发生的时长不会提前计入费用',()=>{
 const {s,e}=fixture();s.registrations[0].arrival=start+hour;s.registrations[0].departure=end-15*60000;
 assert.ok(!readyIds(s,e.id,start).includes('A'));assert.ok(readyIds(s,e.id,start+hour).includes('A'));assert.ok(!readyIds(s,e.id,end-15*60000).includes('A'));
 assert.equal(calculateSettlement(s,e,start-hour).bills.length,0);
 const midway=calculateSettlement(s,e,start+hour);assert.ok(!midway.bills.some(b=>b.playerId==='A'));assert.ok(midway.bills.every(b=>b.minutes===60));
 const a=attendanceForEvent(s,e).find(a=>a.playerId==='A')!;assert.equal(a.start,start+hour);assert.equal(a.end,end-15*60000);
});

test('活动中取消保留已参加费用，候补只从递补时刻起参加',async()=>{
 const {s,e}=fixture();await apply(s,s.accounts[0],'cancel',{eventId:e.id,playerId:'A',reason:'临时离开'},start+hour);
 assert.equal(s.registrations[4].status,'confirmed');assert.equal(s.registrations[4].promotedAt,start+hour);
 assert.ok(!readyIds(s,e.id,start+hour).includes('A'));assert.ok(readyIds(s,e.id,start+hour).includes('E'));
 const bills=calculateSettlement(s,e,end).bills;assert.equal(bills.find(b=>b.playerId==='A')!.total,300);assert.equal(bills.find(b=>b.playerId==='E')!.total,300);
 assert.equal(bills.reduce((n,b)=>n+b.total,0),2400);assert.equal(s.attendance.filter(a=>a.playerId==='A'&&a.source==='automatic').length,1);
});

test('活动开始前取消不会产生虚构参加记录或费用',async()=>{
 const {s,e}=fixture();await apply(s,s.accounts[0],'cancel',{eventId:e.id,playerId:'A',reason:'无法参加'},start-hour/2);
 assert.ok(!attendanceForEvent(s,e).some(a=>a.playerId==='A'));assert.ok(!calculateSettlement(s,e,end).bills.some(b=>b.playerId==='A'));
 assert.equal(s.attendance.length,0);
});

test('取消后重新加入保留过去参加时段，未参加的空档不计费',async()=>{
 const {s,e}=fixture();e.capacity=5;s.registrations[4].status='confirmed';
 await apply(s,s.accounts[0],'cancel',{eventId:e.id,playerId:'A',reason:'离场'},start+hour);
 await apply(s,s.accounts[0],'register',{eventId:e.id,playerId:'A',arrival:start,departure:end,note:'回来'},start+1.5*hour);
 const rows=attendanceForEvent(s,e).filter(a=>a.playerId==='A');assert.equal(rows.length,2);
 assert.equal(calculateSettlement(s,e,end).bills.find(b=>b.playerId==='A')!.minutes,90);
});

test('晚报名不追溯计费；历史记录与默认参加重叠不会双算',()=>{
 const {s,e}=fixture();s.registrations[0].registeredAt=start+hour;
 s.attendance.push({id:'archived',eventId:e.id,playerId:'B',start,end:start+hour,state:'left',source:'automatic'});
 assert.equal(calculateSettlement(s,e,end).bills.find(b=>b.playerId==='A')!.minutes,60);
 assert.equal(calculateSettlement(s,e,end).bills.find(b=>b.playerId==='B')!.minutes,120);
 const clone=structuredClone(s);applyDefaultAttendance(clone);assert.equal(clone.attendance.filter(a=>a.playerId==='B').length,1);assert.equal(s.attendance.length,1);
});

test('默认参加迁移只标记当前未来活动，旧结束活动和实际出勤保持原样',()=>{
 const {s,e}=fixture();delete e.attendanceMode;
 const old={...e,id:'old',start:start-3*hour,end:start-hour,status:'ended' as const};s.events.push(old);
 s.attendance.push({id:'old-attendance',eventId:old.id,playerId:'A',start:old.start,end:old.end,state:'left'});
 const records=structuredClone(s.attendance);assert.equal(enableDefaultAttendance(s,start),true);assert.equal(e.attendanceMode,'automatic');assert.equal(old.attendanceMode,undefined);
 assert.equal(enableDefaultAttendance(s,start),false);assert.deepEqual(s.attendance,records);assert.deepEqual(attendanceForEvent(s,old),records);
});

test('默认参加活动无需签退；活动结束后可以确认分摊，结束前不能提前确认',async()=>{
 const {s,e}=fixture();await assert.rejects(()=>apply(s,s.accounts[0],'settle',{eventId:e.id,confirmed:true,reason:'过早结算'},start+hour),/活动结束/);
 await assert.rejects(()=>apply(s,s.accounts[0],'attendance',{eventId:e.id,playerId:'A',at:start,state:'paused'},start),/默认参加/);
 await apply(s,s.accounts[0],'settle',{eventId:e.id,confirmed:true,reason:'结束分摊'},end);assert.equal(s.settlements.at(-1)!.confirmed,true);assert.equal(s.settlements.at(-1)!.bills.length,4);
});

test('新创建活动自动启用正式报名默认参加',async()=>{
 const {s}=fixture();await apply(s,s.accounts[0],'event',{title:'新活动',start,end,venue:'测试球馆',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'open',bookings:[{name:'一号场',start,end,pricing:'hourly',cents:1200}]},start-hour);
 assert.equal(s.events.at(-1)!.attendanceMode,'automatic');
});

test('取消整个活动保留取消前发生的时长，停止未来参加区间',async()=>{
 const {s,e}=fixture();await apply(s,s.accounts[0],'eventStatus',{eventId:e.id,status:'cancelled'},start+hour);
 assert.deepEqual(readyIds(s,e.id,start+hour),[]);assert.ok(attendanceForEvent(s,e).every(a=>a.end===start+hour));
 assert.ok(calculateSettlement(s,e,end).bills.every(b=>b.minutes===60));
});

test('自动分组必须完整落在报名时段内，避免选入中途离开的球友',()=>{
 const {s,e}=fixture();s.registrations[0].departure=start+10*60000;
 assert.ok(readyIds(s,e.id,start).includes('A'));assert.ok(!readyIds(s,e.id,start,20).includes('A'));
 assert.equal(rotationPlan(s,e,start,20).players,3);
 assert.throws(()=>propose(s,e,start,20,1),/不足4/);
 s.registrations[0].departure=start+20*60000;assert.equal(propose(s,e,start,20,1).courts.length,1);
});
