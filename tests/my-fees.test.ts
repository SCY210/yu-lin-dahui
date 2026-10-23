import {test} from 'node:test';
import assert from 'node:assert/strict';
import {feePaid,incomingTransfersFor,latestConfirmedSplits,overdueFees,unpaidFeesFor,type FeeSplit} from '../lib/client/my-fees';
import {feeOverdueAt} from '../lib/fee-reminder-schedule';

const split=(id:string,eventId:string,version:number,bills:[string,number][],confirmed=true,created=version):FeeSplit=>({id,eventId,version,created,confirmed,bills:bills.map(([playerId,total])=>({playerId,total}))});
const me={id:'alice',playerId:'p1'},players=[{id:'p1',ownerId:'alice'},{id:'friend',ownerId:'alice'},{id:'p2',ownerId:'bob'}];

test('只看每场活动最新的已确认版本；付款覆盖金额才算付清，0 元不需要付款',()=>{
 const latest=latestConfirmedSplits([split('a1','a',1,[['p1',500]]),split('a2','a',2,[['p1',700]]),split('a3','a',3,[['p1',900]],false)]);
 assert.equal(latest.get('a')!.id,'a2');
 assert.ok(feePaid([{eventId:'a',playerId:'p1',cents:700}],'a',{playerId:'p1',total:700}));
 assert.ok(!feePaid([{eventId:'a',playerId:'p1',cents:500}],'a',{playerId:'p1',total:700}),'a raised amount is unpaid again');
 assert.ok(feePaid([],'a',{playerId:'p1',total:0}));
});

test('首页未付款提示：包括自己和自己代报名的朋友，不含别人，已删除活动和已付清的不提示，最近的在前',()=>{
 const settlements=[split('a1','a',1,[['p1',500],['p2',500]],true,1),split('b1','b',1,[['friend',300],['p2',300]],true,2),split('c1','c',1,[['p1',400]],true,3),split('d1','d',1,[['p1',200]],true,4)];
 const rows=unpaidFeesFor(settlements,[{eventId:'c',playerId:'p1',cents:400}],players,me,new Set(['a','b','c']));
 assert.deepEqual(rows.map(r=>[r.eventId,r.playerId,r.total,r.friend]),[['b','friend',300,true],['a','p1',500,false]]);
});

// Confirmed at 10:00 in Madrid; the owner is told four days later at the same hour.
const confirmedAt=Date.parse('2026-10-20T08:00:00Z'),overdueAt=feeOverdueAt(confirmedAt);
const transferSplit=(id:string,eventId:string,version:number,transfers:[string,string,number][]):FeeSplit=>({...split(id,eventId,version,[],true,confirmedAt),transfers:transfers.map(([from,to,cents])=>({from,to,cents}))});

test('收款人首页：只列最新确认版本里还没转给自己的钱，自动提醒结束后标为逾期',()=>{
 const settlements=[transferSplit('a1','a',1,[['p2','p1',900]]),transferSplit('a2','a',2,[['p2','p1',500],['p3','p1',400],['p1','p4',300]]),
  transferSplit('b1','b',1,[['p3','p1',200]]),split('c1','c',1,[['p2',600]],true,confirmedAt)];
 const payments=[{eventId:'a',playerId:'p3',cents:400,to:'p1'},{eventId:'a',playerId:'p2',cents:500}];
 const before=incomingTransfersFor(settlements,payments,{playerId:'p1'},new Set(['a','c']),overdueAt-1);
 assert.deepEqual(before.map(t=>[t.eventId,t.settlementId,t.from,t.cents,t.overdue]),[['a','a2','p2',500,false]],
  'a bill payment does not cover a transfer; marked transfers, own outgoing transfers, old versions, hidden activities and old-way splits are left out');
 assert.equal(incomingTransfersFor(settlements,payments,{playerId:'p1'},new Set(['a']),overdueAt)[0].overdue,true);
});

test('群主和管理员首页：自动提醒结束后仍未付款的人，按欠款人合计，最早的活动在前',()=>{
 const settlements=[{...transferSplit('a1','a',1,[['p2','p1',500],['p2','p4',100],['p3','p1',400]]),created:confirmedAt+3600000},
  split('c1','c',1,[['p2',600],['p3',600],['p4',0]],true,confirmedAt),transferSplit('d1','d',1,[['p2','p1',100]])];
 const payments=[{eventId:'a',playerId:'p3',cents:400,to:'p1'},{eventId:'c',playerId:'p3',cents:600},{eventId:'d',playerId:'p2',cents:100,to:'p1'}];
 const visible=new Set(['a','c','d']);
 assert.deepEqual(overdueFees(settlements,payments,visible,overdueAt-1),[],'nothing before the owner is told');
 assert.deepEqual(overdueFees(settlements,payments,visible,overdueAt+3600000).map(x=>[x.eventId,x.owing]),[['c',[{playerId:'p2',cents:600}]],['a',[{playerId:'p2',cents:600}]]],
  'paid people, zero bills and fully paid splits drop out');
 assert.deepEqual(overdueFees(settlements,payments,new Set(['c']),overdueAt+3600000).map(x=>x.eventId),['c'],'hidden or cancelled activities are not listed');
});
