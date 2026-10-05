import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Event} from '../lib/domain/types';
import {apply} from '../lib/domain/commands';
import {attendanceForEvent} from '../lib/domain/attendance';
import {calculateSettlement} from '../lib/domain/money';
import {bookingRows} from '../lib/domain/booking-signups';
import {propose,validateRound,readyIds} from '../lib/domain/grouping';
import {fixedPartnerTeams,proposeFixed} from '../lib/domain/fixed-partners';
import {projectClubState} from '../lib/club-view';
const hour=3600000,start=Date.parse('2027-04-10T12:00:00Z'),end=start+4*hour,early=start-48*hour;
function fixture(cap=4){
 const s=emptyState();s.settings.initialized=true;
 const e:Event={id:'event',creatorId:'host',title:'虚构场地接龙',start,end,venue:'模拟球馆',address:'',capacity:4,signupDeadline:end,cancelDeadline:start-24*hour,status:'open',attendanceMode:'automatic',note:'',courtMode:'interval',ballMode:'interval'};s.events.push(e);
 for(let i=0;i<10;i++){const id=String(i);s.accounts.push({id:i===0?'host':'user'+id,playerId:id,role:'member',email:''});s.players.push({id,name:'虚构球友'+id,ownerId:s.accounts[i].id,enabled:true,initialRating:1000+i*10,rating:1000+i*10,ratedGames:0,ratingReason:''})}
 s.bookings.push({id:'A',eventId:e.id,name:'一号场',start,end:start+hour,signupCapacity:cap,pricing:'total',cents:1200},{id:'B',eventId:e.id,name:'二号场',start,end:start+hour,signupCapacity:cap,pricing:'total',cents:2400},{id:'C',eventId:e.id,name:'一号场',start:start+2*hour,end:start+3*hour,signupCapacity:cap,pricing:'total',cents:1200});return {s,e};
}
async function join(s:ReturnType<typeof emptyState>,id:string,court='A',now=early,overrides={}){const b=s.bookings.find(b=>b.id===court)!;return apply(s,s.accounts.find(a=>a.playerId===id)!,'courtRegister',{bookingId:court,playerId:id,arrival:b.start,departure:b.end,note:'',...overrides},now)}

test('旧报名截止已过仍可加入场地和旧活动接龙，时段结束后拒绝',async()=>{
 const {s,e}=fixture();e.signupDeadline=early-1;
 await join(s,'1');assert.equal(bookingRows(s,'A')[0].status,'confirmed');
 await apply(s,s.accounts[2],'register',{eventId:e.id,playerId:'2',arrival:start,departure:end,note:''},early);
 assert.equal(s.registrations.find(r=>r.playerId==='2')!.status,'confirmed');
 const before=structuredClone(s);
 await assert.rejects(()=>join(s,'3','A',start+hour),/时段已结束/);
 await assert.rejects(()=>apply(s,s.accounts[3],'register',{eventId:e.id,playerId:'3',arrival:start,departure:end,note:''},end),/时段已结束/);
 assert.deepEqual(s,before);
});

test('取消截止后仍可报名，未开放或已结束的活动继续阻止报名',async()=>{
 const {s,e}=fixture();e.signupDeadline=early-1;
 await join(s,'1','A',start-hour);assert.equal(bookingRows(s,'A')[0].status,'confirmed');
 for(const status of ['draft','locked','ended','cancelled'] as const){
  e.status=status;const before=structuredClone(s);
  await assert.rejects(()=>join(s,'2'),/未开放报名|活动已结束/);assert.deepEqual(s,before);
 }
});

test('创建及编辑活动不再需要填写报名截止时间',async()=>{
 const {s,e}=fixture();
 await apply(s,s.accounts[0],'event',{title:'无报名截止活动',start,end,venue:'模拟球馆',address:'',capacity:4,cancelDeadline:start-24*hour,note:'',status:'open',bookings:[{name:'测试场地',start,end,pricing:'total',cents:0}]},early);
 const created=s.events.at(-1)!;assert.equal(created.title,'无报名截止活动');
 await apply(s,s.accounts[0],'eventEdit',{eventId:created.id,title:'编辑无截止活动',venue:e.venue,address:'',capacity:4,cancelDeadline:start-24*hour,note:'',reason:'修改标题'},early);
 assert.equal(created.title,'编辑无截止活动');assert.equal(created.cancelDeadline,start-24*hour);
});
test('每场独立上限、候补；同一人多时段总名单只计一次',async()=>{const {s}=fixture(1);await join(s,'1');await join(s,'2');await join(s,'1','C');assert.equal(bookingRows(s,'A').find(r=>r.playerId==='2')!.status,'waitlist');assert.equal(bookingRows(s,'C')[0].status,'confirmed');assert.equal(s.registrations.filter(r=>r.playerId==='1').length,1);assert.equal(s.registrations[0].status,'confirmed');await join(s,'2','C');assert.equal(s.registrations.find(r=>r.playerId==='2')!.status,'waitlist')});
test('重复保存保留名额和接龙顺序，不新增参加记录',async()=>{const {s}=fixture();await join(s,'1');const original=structuredClone(s.registrations[0]);await join(s,'1','A',early+1000);assert.deepEqual(s.registrations[0],original);assert.equal(s.attendance.length,0)});
test('重叠场地拒绝、相接时段允许；非法参加范围不留数据',async()=>{const {s}=fixture();await join(s,'1');const prior=structuredClone(s.registrations);await assert.rejects(()=>join(s,'1','B'),/重叠/);assert.deepEqual(s.registrations,prior);await assert.rejects(()=>join(s,'2','A',early,{arrival:start-hour}),/所选场地/);assert.deepEqual(s.registrations,prior);s.bookings[2].start=start+hour;s.bookings[2].end=start+2*hour;await join(s,'1','C');assert.equal(s.registrations[0].bookingSignups!.length,2)});
test('取消仅释放本场名额并递补，其他时段和候补顺序保持',async()=>{const {s}=fixture(1);await join(s,'1');await join(s,'2');await join(s,'1','C');await join(s,'3','C');await apply(s,s.accounts[1],'courtCancel',{bookingId:'A',playerId:'1',reason:'虚构取消'},early);assert.equal(bookingRows(s,'A')[0].playerId,'2');assert.equal(bookingRows(s,'A')[0].status,'confirmed');assert.equal(bookingRows(s,'C').find(r=>r.playerId==='1')!.status,'confirmed');assert.equal(bookingRows(s,'C').find(r=>r.playerId==='3')!.status,'waitlist')});
test('取消已参加时段归档本场费用，递补不会追溯参加',async()=>{const {s,e}=fixture(1);await join(s,'1');await join(s,'2');await join(s,'1','C');await apply(s,s.accounts[0],'courtCancel',{bookingId:'A',playerId:'1',reason:'提前离开'},start+hour/2);const result=calculateSettlement(s,e,end);assert.equal(result.bills.find(b=>b.playerId==='1')!.court,1800);assert.equal(result.bills.find(b=>b.playerId==='2')!.court,600);assert.equal(s.attendance[0].bookingId,'A');assert.equal(bookingRows(s,'A')[0].promotedAt,start+hour/2)});
test('晚取消只申请不释放名额，管理员批准后本场递补',async()=>{const {s}=fixture(1);await join(s,'1');await join(s,'2');await apply(s,s.accounts[1],'courtCancel',{bookingId:'A',playerId:'1',reason:'无法来'},start-hour);assert.equal(bookingRows(s,'A')[0].cancelRequested,true);assert.equal(bookingRows(s,'A')[1].status,'waitlist');await apply(s,s.accounts[0],'courtCancel',{bookingId:'A',playerId:'1',reason:'批准'},start-hour);assert.equal(bookingRows(s,'A')[0].playerId,'2')});
test('非连续时段空档不进入出勤、分组或费用；不同场费各自分摊',async()=>{const {s,e}=fixture();await join(s,'1');await join(s,'1','C');await join(s,'2','B');const spans=attendanceForEvent(s,e).filter(a=>a.playerId==='1');assert.equal(spans.length,2);assert.ok(!readyIds(s,e.id,start+1.5*hour).includes('1'));const result=calculateSettlement(s,e,end);assert.equal(result.bills.find(b=>b.playerId==='1')!.minutes,120);assert.equal(result.bills.find(b=>b.playerId==='1')!.court,2400);assert.equal(result.bills.find(b=>b.playerId==='2')!.court,2400);assert.equal(result.unallocated,0);assert.equal(result.bills.reduce((n,b)=>n+b.total,0),result.total)});
test('场费所有模式只由本场人承担，球费使用活动时段',async()=>{for(const mode of ['equal','duration','interval'] as const){const {s,e}=fixture();e.courtMode=mode;await join(s,'1');await join(s,'2','B');await join(s,'1','C');s.costs.push({id:'balls',eventId:e.id,type:'ball',name:'测试用球',pricing:'total',cents:600,tubeCount:12,used:0,start,end:start+hour,bearer:'members'});const bills=calculateSettlement(s,e,end).bills;assert.equal(bills.find(b=>b.playerId==='1')!.court,2400);assert.equal(bills.find(b=>b.playerId==='2')!.court,2400);assert.equal(bills.find(b=>b.playerId==='1')!.ball,300);assert.equal(bills.find(b=>b.playerId==='2')!.ball,300)}});
test('分组、固定搭档、发布验证不能跨到未报名场地',async()=>{const {s,e}=fixture();for(let i=0;i<8;i++)await join(s,String(i),i<4?'A':'B');const proposal=propose(s,e,start,20,7);assert.equal(proposal.courts.length,2);for(const m of proposal.courts)assert.ok([...m.a,...m.b].every(id=>Number(id)<4?m.courtId==='A':m.courtId==='B'));const fixed=proposeFixed(s,e,start,20,7,fixedPartnerTeams(s,e));for(const m of fixed.courts)assert.ok([...m.a,...m.b].every(id=>Number(id)<4?m.courtId==='A':m.courtId==='B'));const invalid=structuredClone(proposal.courts);[invalid[0].a[0],invalid[1].a[0]]=[invalid[1].a[0],invalid[0].a[0]];assert.throws(()=>validateRound(s,e.id,start,20,invalid as any),/未报名本场地/)});
test('每场不足四人不会凑跨场双打',async()=>{const {s,e}=fixture();for(let i=0;i<6;i++)await join(s,String(i),i<3?'A':'B');assert.throws(()=>propose(s,e,start,20,3),/每个场地需至少4位/)});
test('本人、代报、活动创建者权限；其他人不能修改他人或场地',async()=>{const {s,e}=fixture();await join(s,'1');const before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[2],'courtCancel',{bookingId:'A',playerId:'1',reason:'伪造'},early),/403/);await assert.rejects(()=>apply(s,s.accounts[2],'bookingEdit',{bookingId:'A',name:'一号场',start,end:start+hour,pricing:'total',cents:1,reason:'伪造'},early),/403/);assert.deepEqual(s,before);await apply(s,s.accounts[0],'courtRegister',{bookingId:'A',playerId:'2',arrival:start,departure:start+hour,note:''},early);assert.equal(bookingRows(s,'A').length,2);e.deletedAt=early;await assert.rejects(()=>join(s,'3'),/已删除/)});
test('场地上限不得压过正式人数；扩大名额自动递补；缩短已有报名时段拒绝',async()=>{const {s}=fixture(1);await join(s,'1');await join(s,'2');const input={bookingId:'A',name:'一号场',start,end:start+hour,pricing:'total',cents:1200,reason:'改上限',signupCapacity:2};await apply(s,s.accounts[0],'bookingEdit',input,early);assert.equal(bookingRows(s,'A').filter(r=>r.status==='confirmed').length,2);await assert.rejects(()=>apply(s,s.accounts[0],'bookingEdit',{...input,signupCapacity:1},early),/上限/);await assert.rejects(()=>apply(s,s.accounts[0],'bookingEdit',{...input,end:start+hour/2},early),/已有报名/)});
test('同活动可添加新时段并扩展起止；不同球馆同名场地不冲突',async()=>{const {s,e}=fixture();await apply(s,s.accounts[0],'booking',{eventId:e.id,name:'一号场',venue:'其他测试球馆',address:'测试地址',start,end:start+hour,pricing:'total',cents:0,signupCapacity:8,reason:'另一个球馆'},early);await apply(s,s.accounts[0],'booking',{eventId:e.id,name:'三号场',start:end,end:end+hour,pricing:'hourly',cents:500,signupCapacity:8,reason:'追加时段'},early);assert.equal(e.end,end+hour);assert.equal(s.bookings.at(-2)!.venue,'其他测试球馆')});
test('旧接龙保留原名单与费用规则；选场转换不丢失已发生费用',async()=>{const {s,e}=fixture();await apply(s,s.accounts[1],'register',{eventId:e.id,playerId:'1',arrival:start,departure:end,note:''},early);assert.equal(calculateSettlement(s,e,end).bills[0].court,4800);await apply(s,s.accounts[0],'courtRegister',{bookingId:'C',playerId:'1',arrival:start+2*hour,departure:start+3*hour,note:''},start+hour);assert.equal(s.registrations.length,1);assert.ok(s.registrations[0].bookingSignups);const bills=calculateSettlement(s,e,end).bills;assert.equal(bills[0].court,4800);assert.equal(bills[0].minutes,120)});
test('持久化 JSON 重读和成员视图保留独立场地状态，不泄漏账号权限',async()=>{const {s}=fixture(1);await join(s,'1');await join(s,'2');await join(s,'1','C');const saved=JSON.parse(JSON.stringify(s));const view=projectClubState(saved,s.accounts[1],'2027-04',2027,early);assert.equal(view.registrations.find(r=>r.playerId==='1')!.bookingSignups!.length,2);assert.equal(view.bookings[0].signupCapacity,1);assert.deepEqual(view.accounts,[])});
test('一场候补、另一场正式的混合状态分别显示，空档不会当作已正式参加',async()=>{const {s,e}=fixture(1);await join(s,'1');await join(s,'2');await join(s,'2','C');const r=s.registrations.find(r=>r.playerId==='2')!;assert.equal(r.status,'confirmed');assert.equal(r.bookingSignups!.find(x=>x.bookingId==='A')!.status,'waitlist');assert.equal(r.bookingSignups!.find(x=>x.bookingId==='C')!.status,'confirmed');assert.ok(!readyIds(s,e.id,start).includes('2'));assert.ok(readyIds(s,e.id,start+2*hour).includes('2'))});
test('原接龙转入场地释放旧名额、递补旧候补；逾期成员不能绕过取消规则',async()=>{const {s,e}=fixture(1);e.capacity=1;for(const id of ['1','2'])await apply(s,s.accounts.find(a=>a.playerId===id)!,'register',{eventId:e.id,playerId:id,arrival:start,departure:end,note:''},early);await join(s,'1','A');assert.equal(s.registrations.find(r=>r.playerId==='2')!.status,'confirmed');const before=structuredClone(s);await assert.rejects(()=>join(s,'2','C',start-hour),/自由取消/);assert.deepEqual(s,before)});
test('新接龙拒绝无效时间和无效场地；不接受伪造的正式状态',async()=>{const {s,e}=fixture(1);await join(s,'1');await join(s,'2','A',early,{status:'confirmed',sequence:0,promotedAt:0});assert.equal(bookingRows(s,'A').find(x=>x.playerId==='2')!.status,'waitlist');const before=structuredClone(s);await assert.rejects(()=>join(s,'3','A',early,{arrival:Number.MAX_SAFE_INTEGER}));await assert.rejects(()=>apply(s,s.accounts[3],'courtRegister',{bookingId:'outside',playerId:'3',arrival:start,departure:end,note:''},early),/不存在/);assert.deepEqual(s,before)});
test('界面费用预览与持久化结算逐人逐分一致，包括取消归档和相接换场',async()=>{for(const cancel of [false,true]){const {s,e}=fixture(2);await join(s,'1');await join(s,'2','B');s.bookings[2].start=start+hour;s.bookings[2].end=start+2*hour;await join(s,'1','C');if(cancel)await apply(s,s.accounts[0],'courtCancel',{bookingId:'A',playerId:'1',reason:'离开一号场'},start+hour/2);const raw=calculateSettlement(s,e,end),view=projectClubState(s,s.accounts[0],'2027-04',2027,end);assert.deepEqual(view.drafts.find(d=>d.eventId===e.id),raw)}});
