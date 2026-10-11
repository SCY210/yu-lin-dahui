import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['app/notification-prompt.tsx'],outfile:'.test-output/notification-prompt-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'notification-test-shells',setup(b){
 b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'prompt-test'}));
 b.onResolve({filter:/client\/push-notifications$/},()=>({path:'push',namespace:'prompt-test'}));
 b.onResolve({filter:/^sonner$/},()=>({path:'toast',namespace:'prompt-test'}));
 b.onLoad({filter:/.*/,namespace:'prompt-test'},a=>({loader:'js',contents:a.path==='dialog'?`import {createElement} from 'react';export const Dialog=({open,children,onOpenChange,historyCloseBlocked})=>open?createElement('section',{role:'dialog',onOpenChange,historyCloseBlocked},children):null;export const DialogContent=({children})=>children;export const DialogHeader=({children})=>children;export const DialogTitle=({children})=>createElement('h2',null,children);export const DialogDescription=({children})=>createElement('p',null,children);`:a.path==='toast'?`export const toast={success:()=>{}};`:`export const syncPushAccount=(id)=>window.push.sync(id);export const pushSupport=()=>window.push.support;export const notificationConfig=(id)=>window.push.config(id);export const enablePush=(id,key)=>window.push.enable(id,key);`}));
}}]});
const {default:Prompt}=await import(pathToFileURL(resolve('.test-output/notification-prompt-ui.mjs')).href);
const originals=Object.fromEntries(['window','document','Notification','MutationObserver','localStorage','IS_REACT_ACT_ENVIRONMENT','setTimeout'].map(k=>[k,globalThis[k]]));
const values=new Map([['yulin:notification-prompt:v1:fictional-member',String(Date.now()+7*86400000)]]),timers=[],observers=new Set(),listeners=new Set(),windowListeners=new Map();let otherDialog=false,ui,enableCalls=0,permissionCalls=0,configCalls=0;
const push={support:'supported',sync:async()=>false,config:async()=>{configCalls++;return {configured:true,publicKey:'fictional-public-key'}},enable:async()=>{enableCalls++}};
globalThis.window={push,Notification:{},addEventListener:(name,f)=>{if(!windowListeners.has(name))windowListeners.set(name,new Set());windowListeners.get(name).add(f)},removeEventListener:(name,f)=>windowListeners.get(name)?.delete(f)};globalThis.Notification={permission:'default',requestPermission:()=>{permissionCalls++;return Promise.resolve('granted')}};
globalThis.document={hidden:false,body:{},querySelector:()=>otherDialog?{}:null,addEventListener:(_,f)=>listeners.add(f),removeEventListener:(_,f)=>listeners.delete(f)};
globalThis.MutationObserver=class{constructor(f){this.f=f}observe(){observers.add(this.f)}disconnect(){observers.delete(this.f)}};
globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
globalThis.setTimeout=(f,ms,...args)=>ms===2000?(timers.push(f),-1):originals.setTimeout(f,ms,...args);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const pause=()=>new Promise(r=>originals.setTimeout(r,0));
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const dialogs=()=>ui.root.findAll(n=>n.props.role==='dialog');
async function flush(){await act(async()=>{for(const f of timers.splice(0))f();await pause()})}
async function mount(props={}){if(ui)await act(()=>ui.unmount());await act(async()=>{ui=create(React.createElement(React.StrictMode,null,React.createElement(Prompt,{accountId:'fictional-member',...props})));await pause()});await flush()}
async function click(label){const button=ui.root.findAllByType('button').find(n=>text(n)===label);assert.ok(button,label);await act(async()=>{button.props.onClick();await pause()})}
async function foreground(){await act(async()=>{document.hidden=true;for(const f of listeners)f();document.hidden=false;for(const f of listeners)f();await pause()});await flush()}
try{
 await mount();assert.equal(dialogs().length,1);assert.equal(permissionCalls,0);assert.equal(enableCalls,0,'entry never enables notifications implicitly');
 await click('暂不开启');assert.equal(dialogs().length,0);await act(async()=>{ui.update(React.createElement(React.StrictMode,null,React.createElement(Prompt,{accountId:'fictional-member'})));await pause()});await flush();assert.equal(dialogs().length,0,'polling/rerenders do not reopen the current visit');
 await foreground();assert.equal(dialogs().length,1,'returning to the app offers again when still disabled');await click('暂不开启');
 await act(async()=>{for(const f of windowListeners.get('pageshow')??[])f({persisted:true});await pause()});await flush();assert.equal(dialogs().length,1,'restoring a page rechecks eligibility');await click('暂不开启');
 await mount();assert.equal(dialogs().length,1,'new page entry ignores old seven-day snooze values');
 await mount({accountId:'another-member'});assert.equal(dialogs().length,1,'a different account has its own choice');await click('开启通知');assert.equal(enableCalls,1);assert.equal(dialogs().length,0);
 push.sync=async()=>true;await mount();assert.equal(dialogs().length,0,'enabled devices stay quiet');await foreground();assert.equal(dialogs().length,0,'enabled devices remain quiet on return');push.sync=async()=>null;await mount();assert.equal(dialogs().length,0,'unknown status is not an opt-in decision');push.sync=async()=>false;
 push.support='unsupported';await mount();assert.equal(dialogs().length,0);push.support='iphone-install';await mount();assert.equal(dialogs().length,1);assert.ok(text(ui.toJSON()).includes('添加到主屏幕'));assert.ok(!text(ui.toJSON()).includes('点击开启后'));push.support='supported';
 Notification.permission='denied';await mount();assert.equal(dialogs().length,1);assert.ok(text(ui.toJSON()).includes('系统已阻止通知'));assert.equal(ui.root.findAllByType('button').some(n=>text(n)==='开启通知'),false);Notification.permission='default';
 await mount({blocked:true});assert.equal(dialogs().length,0);await act(async()=>{ui.update(React.createElement(Prompt,{accountId:'fictional-member',blocked:false}));await pause()});await flush();assert.equal(dialogs().length,1,'score/write dialogs defer the offer');
 otherDialog=true;await mount();assert.equal(dialogs().length,0);otherDialog=false;await act(async()=>{for(const f of observers)f();await pause()});assert.equal(dialogs().length,1,'closing another dialog releases the queued offer');
 push.enable=async()=>{enableCalls++;throw Error('模拟连接失败，请重试')};await click('开启通知');assert.equal(dialogs().length,1);assert.ok(text(ui.toJSON()).includes('模拟连接失败'));assert.equal(ui.root.findByProps({role:'alert'}).children.length,1);assert.ok(ui.root.findAllByType('button').every(n=>!n.props.disabled));
 let finishEnable;push.enable=()=>{enableCalls++;return new Promise(resolve=>{finishEnable=resolve})};await click('开启通知');assert.equal(dialogs()[0].props.historyCloseBlocked,true);await foreground();assert.equal(dialogs().length,1,'a system permission foreground return must not restart an in-flight enable');assert.equal(dialogs()[0].props.historyCloseBlocked,true);await act(async()=>{finishEnable();await pause()});assert.equal(dialogs().length,0,'retry succeeds without forcing a reload');
 push.config=async()=>({configured:false,publicKey:null});await mount();assert.equal(dialogs().length,0,'unconfigured service does not advertise a working enable button');
 assert.equal(permissionCalls,0);assert.ok(configCalls>0);
 console.log('PASS notification entry opt-in: fresh/foreground/restored visit reminders, ignored legacy snooze, no polling repeats, enabled-device suppression, permission-flow protection, retry and dialog priority.');
}finally{if(ui)await act(()=>ui.unmount());for(const [k,v] of Object.entries(originals))globalThis[k]=v}
