import {test} from 'node:test';
import assert from 'node:assert/strict';
import {feePaid,latestConfirmedSplits,unpaidFeesFor,type FeeSplit} from '../lib/client/my-fees';

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
