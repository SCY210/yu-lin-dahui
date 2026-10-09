import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {billPaid,feeContact,unpaidBills} from '../lib/domain/fee-payments';
import {feeReminders,unpaidFeeReminders} from '../lib/reminder-contract';
import {projectClubState} from '../lib/club-view';
import {emptyState,type Account,type State} from '../lib/domain/types';

const now=Date.parse('2026-10-10T20:00:00Z'),hour=3600000;
const owner:Account={id:'owner',email:'',role:'admin',playerId:'p0'};
const alice:Account={id:'alice',email:'',role:'member',playerId:'p1'};
const bob:Account={id:'bob',email:'',role:'member',playerId:'p2'};
function fixture():State{
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=owner.id;s.accounts=[owner,alice,bob].map(a=>({...a}));
 s.players=[...s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})),
  {id:'friend',name:'小明',ownerId:'alice',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}];
 s.events.push({id:'e',creatorId:owner.id,title:'周四双打',start:now-4*hour,end:now-2*hour,venue:'球馆',address:'',capacity:8,signupDeadline:now-5*hour,cancelDeadline:now-5*hour,note:'',status:'ended',courtMode:'equal',ballMode:'equal'});
 const bills=['p0','p1','p2','friend'].map(playerId=>({playerId,court:600,ball:0,other:0,total:600,minutes:120}));
 s.settlements.push({id:'v1',eventId:'e',version:1,created:now-hour,reason:'确认',confirmed:true,total:2400,subsidy:0,unallocated:0,bills,detail:[]});
 return s;
}
const bill=(s:State,id:string)=>s.settlements[0].bills.find(b=>b.playerId===id)!;

test('代报名朋友的费用联系人是代报名的人；有自己账号或已停用时不转交',()=>{
 const s=fixture();
 assert.deepEqual(feeContact(s,'p1'),{accountId:'alice',proxy:false});
 assert.deepEqual(feeContact(s,'friend'),{accountId:'alice',proxy:true});
 s.players.find(p=>p.id==='p1')!.enabled=false;assert.equal(feeContact(s,'friend'),null,'a disabled proxy receives nothing');
 const t=fixture();t.accounts.push({id:'friend-login',email:'',role:'member',playerId:'friend'});assert.deepEqual(feeContact(t,'friend'),{accountId:'friend-login',proxy:false});
});

test('确认通知：代报名的人收到单独一条，写明朋友的金额；其他人收到普通通知',()=>{
 const notices=feeReminders(fixture(),fixture().settlements[0],now);
 const general=notices.find(n=>n.id==='fees:e:v1')!,personal=notices.find(n=>n.accountIds.includes('alice'))!;
 assert.deepEqual(general.accountIds.sort(),['bob','owner']);assert.ok(!general.accountIds.includes('alice'));
 assert.equal(personal.id,'fees:e:v1:alice');assert.deepEqual(personal.proxyPlayerIds,['friend']);
 assert.match(personal.body,/除了你自己的费用/);assert.match(personal.body,/你代报名的 小明 的费用/);assert.match(personal.body,/代为转交或代付/);assert.doesNotMatch(personal.body,/€|600|6\.00/,'notices never show amounts');
});

test('球友自报已付款：本人和代报名的人可以标记和撤销，其他成员不能；创建者可以代为修正',async()=>{
 const s=fixture();
 await apply(s,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p1',paid:true},now);assert.ok(billPaid(s,'e',bill(s,'p1')));
 await apply(s,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'friend',paid:true},now);assert.ok(billPaid(s,'e',bill(s,'friend')));
 await assert.rejects(()=>apply(s,bob,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p1',paid:false},now),/403/);
 await apply(s,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'friend',paid:false},now);assert.ok(!billPaid(s,'e',bill(s,'friend')));
 await apply(s,owner,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p2',paid:true},now);assert.ok(billPaid(s,'e',bill(s,'p2')));
 await apply(s,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p1',paid:true},now);assert.equal(s.payments.filter(p=>p.playerId==='p1').length,1,'marking twice keeps one record');
 assert.deepEqual(unpaidBills(s,s.settlements[0]).map(b=>b.playerId).sort(),['friend','p0']);
 const unconfirmed=fixture();unconfirmed.settlements[0].confirmed=false;await assert.rejects(()=>apply(unconfirmed,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p1',paid:true},now),/尚未确认/);
 await assert.rejects(()=>apply(fixture(),alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'nobody',paid:true},now),/不在已确认的分摊中/);
});

test('分摊金额变高后之前的已付款不再算付清',async()=>{
 const s=fixture();await apply(s,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p1',paid:true},now);
 s.settlements.push({...structuredClone(s.settlements[0]),id:'v2',version:2,bills:s.settlements[0].bills.map(b=>({...b,total:800}))});
 assert.ok(!billPaid(s,'e',s.settlements[1].bills.find(b=>b.playerId==='p1')!));
});

test('提醒未付款：只提醒还没标记的人，代报名朋友的提醒发给代报名的人；每次请求单独发出',async()=>{
 const s=fixture();await apply(s,bob,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p2',paid:true},now);await apply(s,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p1',paid:true},now);
 const notices=unpaidFeeReminders(s,s.settlements[0],'request-1',now);
 assert.deepEqual(notices.map(n=>n.accountIds[0]).sort(),['alice','owner']);
 const forAlice=notices.find(n=>n.accountIds[0]==='alice')!;assert.equal(forAlice.title,'费用提醒：还未付款');assert.match(forAlice.body,/你代报名的 小明/);assert.doesNotMatch(forAlice.body,/你自己|€/);
 assert.ok(forAlice.due);assert.equal(forAlice.settlementId,'v1');assert.ok(notices.every(n=>n.id.includes('request-1')));
 assert.notDeepEqual(unpaidFeeReminders(s,s.settlements[0],'request-2',now).map(n=>n.id),notices.map(n=>n.id));
});

test('提醒未付款的命令：都付清时拒绝，同一版本 6 小时内只能提醒一次',async()=>{
 const s=fixture(),remind=(at:number)=>apply(s,owner,'notifyFees',{eventId:'e',settlementId:'v1'},at);
 await remind(now);await assert.rejects(()=>remind(now+hour),/6 小时内已提醒过/);await remind(now+6*hour);
 for(const id of ['p0','p1','p2'])await apply(s,owner,'feePaid',{eventId:'e',settlementId:'v1',playerId:id,paid:true},now);await apply(s,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'friend',paid:true},now);
 await assert.rejects(()=>remind(now+13*hour),/都已标记付款/);
 await assert.rejects(()=>apply(s,bob,'notifyFees',{eventId:'e',settlementId:'v1'},now+13*hour),/403/);
});

test('页面数据只给出付款状态需要的字段',async()=>{
 const s=fixture();await apply(s,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p1',paid:true},now);
 const view=projectClubState(s,bob,'2026-10',2026,now);
 assert.deepEqual(view.payments,[{eventId:'e',playerId:'p1',cents:600}]);
});

test('旧页面不能将更新后的账单标记付清，必须确认最新分摊版本',async()=>{
 const s=fixture();await apply(s,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p1',paid:true},now);
 s.settlements.push({...structuredClone(s.settlements[0]),id:'v2',version:2,bills:s.settlements[0].bills.map(b=>({...b,total:800}))});
 const before=structuredClone(s);
 await assert.rejects(()=>apply(s,alice,'feePaid',{eventId:'e',settlementId:'v1',playerId:'p1',paid:true},now),/409/);
 assert.deepEqual(s,before,'a stale request cannot change payments or audits');
 await apply(s,alice,'feePaid',{eventId:'e',settlementId:'v2',playerId:'p1',paid:true},now);
 assert.ok(billPaid(s,'e',s.settlements[1].bills.find(b=>b.playerId==='p1')!));
});
