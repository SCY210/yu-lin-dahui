import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSessionSync,type SessionChannel} from '../lib/client/session-sync';

const ownId='00000000-0000-4000-8000-000000000001';
const incomingId='00000000-0000-4000-8000-000000000002';
function channel(){
 const listeners=new Set<(event:{data:unknown})=>void>(),sent:unknown[]=[];
 let closes=0;
 const fake:SessionChannel={postMessage:message=>{sent.push(message)},addEventListener:(_type,listener)=>{listeners.add(listener)},removeEventListener:(_type,listener)=>{listeners.delete(listener)},close:()=>{closes++}};
 return {fake,sent,listeners,get closes(){return closes},receive(data:unknown){for(const listener of listeners)listener({data})}};
}
test('广播仅发送session-change和随机事件标识，不包含身份或凭据',()=>{
 const c=channel();let calls=0;
 const sync=createSessionSync({channel:c.fake,onChange:()=>{calls++},createId:()=>ownId});
 sync.notify();assert.deepEqual(c.sent,[{type:'session-change',id:ownId}]);
 assert.equal(/token|username|password|accountId|playerId/.test(JSON.stringify(c.sent)),false);
 c.receive(c.sent[0]);assert.equal(calls,0);sync.stop();
});
test('收到有效消息只触发失效回调，同一消息不重复处理',()=>{
 const c=channel();let calls=0;
 const sync=createSessionSync({channel:c.fake,onChange:()=>{calls++}});
 const message={type:'session-change',id:incomingId};c.receive(message);c.receive(message);
 assert.equal(calls,1);assert.deepEqual(c.sent,[]);sync.stop();
});
test('同一标签页的其他channel对象忽略本人广播，避免绑定成功后误退出',()=>{
 const sender=channel(),listener=channel();let calls=0;
 const senderSync=createSessionSync({channel:sender.fake,onChange:()=>{},createId:()=>ownId});
 const listenerSync=createSessionSync({channel:listener.fake,onChange:()=>{calls++}});
 senderSync.notify();senderSync.stop();listener.receive(sender.sent[0]);
 assert.equal(calls,0);listener.receive({type:'session-change',id:incomingId});assert.equal(calls,1);listenerSync.stop();
});
test('未知、伪造或携带敏感字段的消息不能被当成身份资料接收',()=>{
 const c=channel();let calls=0;
 const sync=createSessionSync({channel:c.fake,onChange:()=>{calls++}});
 for(const message of [null,'session-change',[],{type:'login',id:incomingId},{type:'session-change'},{type:'session-change',id:'not-a-uuid'},{type:'session-change',id:incomingId,username:'someone'},{type:'session-change',id:incomingId,token:'secret'}])c.receive(message);
 assert.equal(calls,0);assert.deepEqual(c.sent,[]);sync.stop();
});
test('stop移除监听并关闭channel，迟到事件和重复stop安全',()=>{
 const c=channel();let calls=0;
 const sync=createSessionSync({channel:c.fake,onChange:()=>{calls++},createId:()=>ownId});
 const queuedListener=[...c.listeners][0];sync.stop();sync.stop();sync.notify();
 c.receive({type:'session-change',id:incomingId});queuedListener({data:{type:'session-change',id:incomingId}});
 assert.equal(calls,0);assert.equal(c.listeners.size,0);assert.equal(c.closes,1);assert.deepEqual(c.sent,[]);
});
test('没有BroadcastChannel或发送失败时认证流程可继续',()=>{
 const absent=createSessionSync({channel:null,onChange:()=>{throw new Error('unexpected')}});
 assert.doesNotThrow(()=>{absent.notify();absent.stop();absent.stop()});
 const c=channel();c.fake.postMessage=()=>{throw new Error('channel unavailable')};
 const sync=createSessionSync({channel:c.fake,onChange:()=>{},createId:()=>ownId});
 assert.doesNotThrow(()=>{sync.notify();sync.stop()});assert.equal(c.closes,1);
});
