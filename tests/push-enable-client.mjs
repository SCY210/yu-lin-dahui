import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
await build({entryPoints:['lib/client/push-notifications.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/push-enable-client.mjs'});
const {enablePush,syncPushAccount,pushStateChanged}=await import(pathToFileURL(resolve('.test-output/push-enable-client.mjs')).href);
await build({entryPoints:['lib/client/push-errors.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/push-enable-errors.mjs'});
const {pushFailure}=await import(pathToFileURL(resolve('.test-output/push-enable-errors.mjs')).href);
const prior=Object.fromEntries(['Notification','navigator','window','fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
const calls=[];let permission='granted',failSubscribe=false,statusEnabled=true,current=null,failSync=false;
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/fictional',toJSON:()=>({endpoint:'fictional'}),unsubscribe:async()=>{calls.push('unsubscribe');current=null}};
const registration={installing:null,pushManager:{getSubscription:async()=>current,subscribe:async()=>{calls.push('browser-subscribe');if(failSubscribe)throw new DOMException('Registration failed - push service error','AbortError');return current=subscription}}};
Object.defineProperty(globalThis,'Notification',{configurable:true,value:{requestPermission:()=>{calls.push('permission');return Promise.resolve(permission)}}});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{register:async()=>{calls.push('worker');return registration},getRegistration:async()=>registration}}});
Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:event=>calls.push(event.type)}});
Object.defineProperty(globalThis,'fetch',{configurable:true,value:async(_,options)=>{const body=JSON.parse(options.body);calls.push(body.action);assert.equal(body.accountId,'fictional-account');if(failSync)throw new DOMException('API request aborted','AbortError');return {ok:true,json:async()=>({ok:true,enabled:statusEnabled})}}});
try{
 const task=enablePush('fictional-account','AQID');assert.deepEqual(calls,['permission'],'permission is requested synchronously within the click gesture');await task;
 assert.deepEqual(calls,['permission','worker','browser-subscribe','subscribe',pushStateChanged]);assert.equal(await syncPushAccount('fictional-account'),true);
 statusEnabled=false;assert.equal(await syncPushAccount('fictional-account'),false);
 current=null;calls.length=0;permission='denied';await assert.rejects(enablePush('fictional-account','AQID'),/尚未允许/);assert.deepEqual(calls,['permission'],'denial never registers or subscribes');
 calls.length=0;permission='granted';failSubscribe=true;await assert.rejects(enablePush('fictional-account','AQID'),error=>pushFailure(error).serviceUnavailable);assert.ok(!calls.includes('subscribe')&&!calls.includes(pushStateChanged),'provider failure never reports success or writes a server subscription');
 failSubscribe=false;failSync=true;calls.length=0;await assert.rejects(enablePush('fictional-account','AQID'),error=>!pushFailure(error).serviceUnavailable);assert.ok(!calls.includes(pushStateChanged),'an API abort never becomes a provider recovery exception or an enabled event');
 console.log('PASS shared push enable: synchronous user permission, registration and ownership checks, denial and provider failure.');
}finally{for(const [key,descriptor] of Object.entries(prior)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
