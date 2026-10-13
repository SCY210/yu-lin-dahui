import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
await build({entryPoints:['lib/client/push-errors.ts'],outfile:'.test-output/push-errors-ui.mjs',bundle:true,platform:'node',format:'esm'});
const {browserPushError}=await import(pathToFileURL(resolve('.test-output/push-errors-ui.mjs')).href);
mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['app/notification-prompt.tsx'],outfile:'.test-output/notification-prompt-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'notification-test-shells',setup(b){
 b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'prompt-test'}));
 b.onResolve({filter:/client\/push-notifications$/},()=>({path:'push',namespace:'prompt-test'}));
 b.onResolve({filter:/^sonner$/},()=>({path:'toast',namespace:'prompt-test'}));
 b.onLoad({filter:/.*/,namespace:'prompt-test'},a=>({loader:'js',contents:a.path==='dialog'?`import {createElement} from 'react';export const Dialog=({open,children,onOpenChange,historyCloseBlocked})=>open?createElement('section',{role:'dialog',onOpenChange,historyCloseBlocked},children):null;export const DialogContent=({children,...props})=>createElement('article',{'data-prompt-content':true,...props},children);export const DialogHeader=({children})=>children;export const DialogTitle=({children})=>createElement('h2',null,children);export const DialogDescription=({children})=>createElement('p',null,children);`:a.path==='toast'?`export const toast={success:()=>{window.push.successes=(window.push.successes??0)+1},error:message=>{window.push.penaltyMessage=message}};`:`export const syncPushAccount=(id)=>window.push.sync(id);export const pushSupport=()=>window.push.support;export const notificationConfig=(id)=>window.push.config(id);export const enablePush=(id,key)=>window.push.enable(id,key);`}));
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
 const content=()=>ui.root.find(n=>n.props['data-prompt-content']);
 assert.notEqual(dialogs()[0].props.historyCloseBlocked,true,'phone back may dismiss optional setup');assert.equal(content().props.showCloseButton,true);
 assert.equal(content().props.onEscapeKeyDown,undefined);assert.equal(content().props.onInteractOutside,undefined);
 assert.ok(text(ui.toJSON()).includes('不开启也能正常使用'));
 const storedBefore=JSON.stringify([...values]),successBefore=push.successes??0;
 await click('暂不开启');assert.equal(dialogs().length,0);assert.equal(enableCalls,0);assert.equal(push.successes??0,successBefore);assert.equal(JSON.stringify([...values]),storedBefore);
 await act(async()=>{ui.update(React.createElement(React.StrictMode,null,React.createElement(Prompt,{accountId:'fictional-member'})));await pause()});await flush();assert.equal(dialogs().length,0,'ordinary rerenders do not nag');
 await foreground();assert.equal(dialogs().length,1,'a fresh foreground visit may offer optional setup again');
 await act(()=>dialogs()[0].props.onOpenChange(false));assert.equal(dialogs().length,0,'close, backdrop, Escape and Back use the normal close callback');
 await mount();await click('开启通知');assert.equal(enableCalls,1);assert.equal(dialogs().length,0);
 push.sync=async()=>true;await mount();assert.equal(dialogs().length,0);push.sync=async()=>null;await mount();assert.equal(dialogs().length,0);push.sync=async()=>false;
 push.support='unsupported';await mount();assert.equal(dialogs().length,0);
 push.support='iphone-install';await mount();assert.ok(text(ui.toJSON()).includes('添加到主屏幕'));await click('暂不开启');assert.equal(dialogs().length,0,'iPhone installation is optional');
 push.support='supported';Notification.permission='denied';await mount();assert.ok(text(ui.toJSON()).includes('系统已阻止通知'));await click('暂不开启');assert.equal(dialogs().length,0,'denied permission cannot lock the app');
 await mount();Notification.permission='granted';push.config=async()=>({configured:false,publicKey:null});await click('已允许，重新检测并开启');assert.ok(text(ui.toJSON()).includes('通知服务暂不可用'));await click('暂不开启');assert.equal(dialogs().length,0);
 Notification.permission='default';push.config=async()=>({configured:true,publicKey:'fictional-public-key'});
 await mount({blocked:true});assert.equal(dialogs().length,0);await act(async()=>{ui.update(React.createElement(Prompt,{accountId:'fictional-member',blocked:false}));await pause()});await flush();assert.equal(dialogs().length,1,'other app dialogs retain priority');
 otherDialog=true;await mount();assert.equal(dialogs().length,0);otherDialog=false;await act(async()=>{for(const f of observers)f();await pause()});assert.equal(dialogs().length,1);
 push.enable=async()=>{enableCalls++;throw Error('模拟连接失败，请重试')};await click('开启通知');assert.ok(text(ui.toJSON()).includes('模拟连接失败'));await click('暂不开启');assert.equal(dialogs().length,0,'generic/server errors are also skippable');
 push.enable=async()=>{enableCalls++;throw browserPushError(new DOMException('Registration failed - push service error','AbortError'))};await mount();await click('开启通知');assert.ok(text(ui.toJSON()).includes('登录不受影响'));await click('暂不开启');assert.equal(dialogs().length,0);
 await mount({accountId:'another-member'});assert.equal(dialogs().length,1,'each account is evaluated independently');await click('暂不开启');
 let finishEnable;push.enable=()=>{enableCalls++;return new Promise(resolve=>{finishEnable=resolve})};await mount();await click('开启通知');
 assert.equal(ui.root.findAllByType('button').find(n=>text(n)==='暂不开启').props.disabled,undefined,'slow or hung enrollment cannot trap users');
 await click('暂不开启');assert.equal(dialogs().length,0);await act(async()=>{finishEnable();await pause()});assert.equal(dialogs().length,0);
 push.config=async()=>({configured:false,publicKey:null});await mount();assert.equal(dialogs().length,0);
 push.config=async()=>({configured:true,publicKey:'fictional-key'});Notification.permission='denied';await mount();assert.match(text(ui.toJSON()),/下次进入网站/);
 await act(async()=>{for(const listener of windowListeners.get('yulin:push-changed')??[])listener(new CustomEvent('yulin:push-changed',{detail:{accountId:'fictional-member',pointsDelta:-30}}))});assert.match(push.penaltyMessage,/−30/);await click('暂不开启');
 assert.equal(permissionCalls,0);assert.ok(configCalls>0);
 console.log('PASS optional notification prompt: dismiss/Back/Escape/backdrop, all error and permission states, iPhone support, busy request escape, no false permission or success, visit/account isolation and explicit enrollment.');

}finally{if(ui)await act(()=>ui.unmount());for(const [k,v] of Object.entries(originals))globalThis[k]=v}
