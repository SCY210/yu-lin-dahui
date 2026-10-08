import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchWithWakeRetry,isChunkLoadError,reloadOnceForNewVersion} from '../lib/client/wake-recovery';

const ok=new Response('{}',{status:200});
function memory(){const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)}}}

test('唤醒后首个请求网络失败时重试一次，同一请求体保持同一 requestId',async()=>{
 const bodies:unknown[]=[];let calls=0;
 const fetcher=async(_url:string,init?:RequestInit)=>{calls++;bodies.push(init?.body);if(calls===1)throw new TypeError('Load failed');return ok};
 const init={method:'POST',body:JSON.stringify({requestId:'r-1'})};
 assert.equal(await fetchWithWakeRetry('/api/club',init,{fetcher,wait:async()=>{}}),ok);
 assert.equal(calls,2);assert.deepEqual(bodies,[init.body,init.body]);
});
test('HTTP 错误响应原样返回、不重试；持续断网时最多两次后抛出',async()=>{
 let calls=0;const conflict=new Response('{}',{status:409});
 assert.equal(await fetchWithWakeRetry('/api/club',undefined,{fetcher:async()=>{calls++;return conflict},wait:async()=>{}}),conflict);assert.equal(calls,1);
 calls=0;
 await assert.rejects(fetchWithWakeRetry('/api/club',undefined,{fetcher:async()=>{calls++;throw new TypeError('Load failed')},wait:async()=>{}}),/Load failed/);
 assert.equal(calls,2);
});
test('写入重试绑定发起账号：等待前或等待期间换号、退出或离开页面都不再重发',async()=>{
 const failing=()=>{let calls=0;return {fetcher:async()=>{calls++;throw new TypeError('Load failed')},get calls(){return calls}}};
 const before=failing();
 await assert.rejects(fetchWithWakeRetry('/api/club',{method:'POST'},{fetcher:before.fetcher,wait:async()=>{},canRetry:()=>false}),/Load failed/);
 assert.equal(before.calls,1);
 let sameAccount=true;const during=failing();
 await assert.rejects(fetchWithWakeRetry('/api/club',{method:'POST'},{fetcher:during.fetcher,wait:async()=>{sameAccount=false},canRetry:()=>sameAccount}),/Load failed/);
 assert.equal(during.calls,1);
 const controller=new AbortController(),aborted=failing();
 await assert.rejects(fetchWithWakeRetry('/api/club',{method:'POST',signal:controller.signal},{fetcher:aborted.fetcher,wait:async()=>{controller.abort()}}),/Load failed/);
 assert.equal(aborted.calls,1);
});
test('已取消的请求不再重试',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(fetchWithWakeRetry('/api/club',{signal:controller.signal},{fetcher:async()=>{calls++;throw new DOMException('aborted','AbortError')},wait:async()=>{}}));
 assert.equal(calls,1);
});
test('识别各浏览器的新版本代码加载失败，其他错误不误判',()=>{
 for(const message of ['Failed to fetch dynamically imported module: https://x/assets/a.js','Importing a module script failed.','error loading dynamically imported module','Unable to preload CSS for /assets/a.css'])assert.ok(isChunkLoadError(new Error(message)));
 assert.equal(isChunkLoadError(new Error('数据已更新，请刷新后重试')),false);
 assert.equal(isChunkLoadError(null),false);
});
test('新版本自动刷新一分钟内最多一次，存储不可用时交给手动刷新',()=>{
 const storage=memory();let reloads=0;const reload=()=>{reloads++};
 assert.equal(reloadOnceForNewVersion(storage,reload,1_000_000),true);
 assert.equal(reloadOnceForNewVersion(storage,reload,1_030_000),false);
 assert.equal(reloadOnceForNewVersion(storage,reload,1_061_000),true);
 assert.equal(reloads,2);
 assert.equal(reloadOnceForNewVersion(null,reload),false);
 assert.equal(reloadOnceForNewVersion({getItem:()=>{throw new Error('blocked')},setItem:()=>{}},reload),false);
 assert.equal(reloads,2);
});
