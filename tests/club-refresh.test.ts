import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClubRefresh} from '../lib/client/club-refresh';

const tick=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()};
function fixture(available=true){
 let calls=0;const state={available};const waits:{resolve:()=>void;reject:()=>void}[]=[],timers=new Map<number,()=>void>();let sequence=0;
 const poll=createClubRefresh({refresh:()=>{calls++;return new Promise<void>((resolve,reject)=>waits.push({resolve,reject:()=>reject(new Error('offline'))}))},available:()=>state.available,schedule:callback=>{const id=++sequence;timers.set(id,callback);return id},cancel:id=>timers.delete(id as number)});
 return {poll,state,timers,resolve:()=>waits.shift()!.resolve(),reject:()=>waits.shift()!.reject(),fire(){const [id,fn]=timers.entries().next().value!;timers.delete(id);fn()},get calls(){return calls}};
}
test('慢请求期间不重叠轮询，完成后才安排下一次刷新',async()=>{
 const e=fixture();assert.equal(e.calls,1);assert.equal(e.timers.size,0);await tick();assert.equal(e.calls,1);e.resolve();await tick();assert.equal(e.timers.size,1);e.fire();assert.equal(e.calls,2);assert.equal(e.timers.size,0);e.poll.stop();e.resolve();await tick();assert.equal(e.timers.size,0);
});
test('切到后台或断网后暂停轮询，重新回到前台只刷新一次',async()=>{
 const e=fixture();e.resolve();await tick();e.state.available=false;e.poll.wake();assert.equal(e.timers.size,0);assert.equal(e.calls,1);e.poll.wake();assert.equal(e.calls,1);e.state.available=true;e.poll.wake();assert.equal(e.calls,2);e.resolve();await tick();assert.equal(e.timers.size,1);e.poll.stop();
});
test('多个回前台事件合并为一次补充刷新，不堆积并发请求',async()=>{
 const e=fixture();for(let i=0;i<10;i++)e.poll.wake();assert.equal(e.calls,1);e.resolve();await tick();assert.equal(e.calls,2);e.resolve();await tick();assert.equal(e.timers.size,1);e.poll.stop();
});
test('网络失败仍能自动重试，停止后未完成请求不能恢复轮询',async()=>{
 const e=fixture();e.reject();await tick();assert.equal(e.timers.size,1);e.fire();assert.equal(e.calls,2);e.poll.stop();e.resolve();await tick();assert.equal(e.timers.size,0);e.poll.wake();assert.equal(e.calls,2);
});
test('后台首次打开仍加载一次，保持后台时不继续刷新',async()=>{
 const e=fixture(false);assert.equal(e.calls,1);e.resolve();await tick();assert.equal(e.timers.size,0);e.state.available=true;e.poll.wake();assert.equal(e.calls,2);e.poll.stop();e.resolve();await tick();
});
