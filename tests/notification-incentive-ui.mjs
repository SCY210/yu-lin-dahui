import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['app/notification-settings.tsx'],outfile:'.test-output/notification-incentive-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'incentive-ui',setup(b){
 b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'fixture'}));
 b.onResolve({filter:/client\/push-notifications$/},()=>({path:'push',namespace:'fixture'}));
 b.onResolve({filter:/^sonner$/},()=>({path:'toast',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='dialog'?`import {createElement as h} from 'react';export const Dialog=({open,children})=>open?h('section',{role:'dialog'},children):null;export const DialogContent=({children})=>children;export const DialogHeader=({children})=>children;export const DialogTitle=({children})=>h('h2',null,children);export const DialogDescription=({children})=>h('p',null,children);`:a.path==='toast'?`export const toast={success:message=>window.fixture.toasts.push(message)};`:`export const pushStateChanged='fixture-change';export const pushSupport=()=> 'supported';export const notificationConfig=async()=>structuredClone(window.fixture.config);export const syncPushAccount=async()=>window.fixture.enabled;export const localPushSubscription=async()=>({endpoint:'https://fcm.googleapis.com/fcm/send/fictional-ui',unsubscribe:async()=>{window.fixture.enabled=false}});export const notificationRequest=async(id,action)=>{window.fixture.requests.push(action);if(action==='status')return {enabled:window.fixture.enabled};window.fixture.config.incentive.status='disabled';return {pointsDelta:-30}};export const enablePush=async(id,key,accept)=>{window.fixture.claims.push(accept);const status=window.fixture.config.incentive.status;window.fixture.config.incentive.status='earned';window.fixture.enabled=true;return {pointsDelta:status==='disabled'?30:status==='available'?10:0}};`}))
}}]});
const Settings=(await import(pathToFileURL(resolve('.test-output/notification-incentive-ui.mjs')).href)).default;
const originals=Object.fromEntries(['window','document','navigator','Notification','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
const fixture={enabled:true,requests:[],claims:[],toasts:[],config:{configured:true,publicKey:'synthetic-key',accountId:'synthetic-account',items:[],unread:0,preferences:{},incentive:{policy:'2026-10-13-v1',enablePoints:10,disablePoints:30,status:'available'}}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'Synthetic'}});
globalThis.window={fixture,addEventListener(){},removeEventListener(){},dispatchEvent(){}};globalThis.document={visibilityState:'visible'};globalThis.Notification={permission:'granted'};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let ui;const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.children?text(n.children):'';
const click=async label=>{const button=ui.root.findAllByType('button').find(node=>text(node)===label);assert.ok(button,label);await act(async()=>{await button.props.onClick()})};
try{
 await act(async()=>{ui=create(React.createElement(Settings,{accountId:'synthetic-account'}));await new Promise(r=>setTimeout(r,10))});
 assert.match(text(ui.toJSON()),/双打赛季积分 \+10/);assert.match(text(ui.toJSON()),/双打赛季积分 −30/);
 await click('领取首次开启奖励 +10');assert.deepEqual(fixture.claims,[true]);assert.match(text(ui.toJSON()),/已领取 10 分奖励/);
 await click('关闭系统通知');assert.match(text(ui.toJSON()),/即使其他设备仍开启，也会扣分/);assert.equal(fixture.requests.filter(a=>a==='unsubscribe').length,0,'opening confirmation never disables');
 await click('保留通知');assert.equal(fixture.requests.filter(a=>a==='unsubscribe').length,0);
 await click('关闭系统通知');await click('确认关闭');assert.equal(fixture.requests.filter(a=>a==='unsubscribe').length,1);assert.ok(fixture.toasts.some(message=>message.includes('−30')));
 await click('开启活动提醒');assert.ok(fixture.toasts.some(message=>message.includes('退还原扣除的 30')));assert.deepEqual(fixture.claims,[true,true]);
 await act(()=>ui.unmount());fixture.enabled=true;fixture.config.incentive.status='disabled';await act(async()=>{ui=create(React.createElement(Settings,{accountId:'synthetic-account'}));await new Promise(r=>setTimeout(r,10))});await click('恢复通知并退还 30 积分');assert.equal(fixture.claims.length,3);
 console.log('PASS notification incentive UI: explicit rules, existing-member claim, cancelable disable confirmation and deduction feedback');
}finally{if(ui)await act(()=>ui.unmount());for(const [key,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
