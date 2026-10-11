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
 b.onLoad({filter:/.*/,namespace:'prompt-test'},a=>({loader:'js',contents:a.path==='dialog'?`import {createElement} from 'react';export const Dialog=({open,children,onOpenChange,historyCloseBlocked})=>open?createElement('section',{role:'dialog',onOpenChange,historyCloseBlocked},children):null;export const DialogContent=({children,...props})=>createElement('article',{'data-prompt-content':true,...props},children);export const DialogHeader=({children})=>children;export const DialogTitle=({children})=>createElement('h2',null,children);export const DialogDescription=({children})=>createElement('p',null,children);`:a.path==='toast'?`export const toast={success:()=>{}};`:`export const syncPushAccount=(id)=>window.push.sync(id);export const pushSupport=()=>window.push.support;export const notificationConfig=(id)=>window.push.config(id);export const enablePush=(id,key)=>window.push.enable(id,key);`}));
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
 assert.equal(dialogs()[0].props.historyCloseBlocked,true,'phone back cannot dismiss the idle prompt');
 const content=()=>ui.root.find(n=>n.props['data-prompt-content']);assert.equal(content().props.showCloseButton,false);
 assert.ok(!ui.root.findAllByType('button').some(n=>/暂不开启|我知道了|关闭/.test(text(n))));
 await act(()=>dialogs()[0].props.onOpenChange(false));assert.equal(dialogs().length,1,'root close requests are ignored');
 let escape=false,outside=false;await act(()=>{content().props.onEscapeKeyDown({preventDefault(){escape=true}});content().props.onInteractOutside({preventDefault(){outside=true}})});assert.ok(escape&&outside);assert.equal(dialogs().length,1);
 await foreground();assert.equal(dialogs().length,1,'foreground rechecks never hide an unconfirmed prompt');
 await act(async()=>{for(const f of windowListeners.get('pageshow')??[])f({persisted:true});await pause()});await flush();assert.equal(dialogs().length,1,'page restore preserves the locked prompt');
 await click('开启通知');assert.equal(enableCalls,1);assert.equal(dialogs().length,0,'successful subscription closes the prompt');
 await mount({accountId:'another-member'});assert.equal(dialogs().length,1,'a different account rechecks its own device');
 push.sync=async()=>true;await foreground();assert.equal(dialogs().length,0,'a verified external enable can release the prompt');await mount();assert.equal(dialogs().length,0,'enabled devices stay quiet');
 push.sync=async()=>null;await mount();assert.equal(dialogs().length,0,'unknown status never forces an unusable permission flow');push.sync=async()=>false;
 push.support='unsupported';await mount();assert.equal(dialogs().length,0,'unsupported devices cannot satisfy a forced subscription');
 push.support='iphone-install';await mount();assert.equal(dialogs().length,1);assert.ok(text(ui.toJSON()).includes('添加到主屏幕'));const priorEnable=enableCalls;await click('重新检测通知支持');assert.equal(dialogs().length,1);assert.equal(enableCalls,priorEnable);
 push.support='supported';await click('重新检测通知支持');assert.ok(ui.root.findAllByType('button').some(n=>text(n)==='开启通知'));await click('开启通知');assert.equal(dialogs().length,0);
 Notification.permission='denied';await mount();assert.equal(dialogs().length,1);assert.ok(text(ui.toJSON()).includes('系统已阻止通知'));assert.equal(ui.root.findAllByType('button').some(n=>text(n)==='开启通知'),false);
 await click('已允许，重新检测并开启');assert.equal(dialogs().length,1,'denied permission cannot be acknowledged away');assert.equal(enableCalls,priorEnable+1);
 Notification.permission='granted';push.config=async()=>({configured:false,publicKey:null});await click('已允许，重新检测并开启');assert.equal(dialogs().length,1);assert.ok(text(ui.toJSON()).includes('通知服务暂不可用'));assert.ok(ui.root.findAllByType('button').some(n=>text(n)==='重新检测通知服务'));
 push.config=async()=>({configured:true,publicKey:'fictional-public-key'});await click('重新检测通知服务');assert.equal(dialogs().length,0,'permission recovery saves the subscription before closing');Notification.permission='default';
 await mount({blocked:true});assert.equal(dialogs().length,0);await act(async()=>{ui.update(React.createElement(Prompt,{accountId:'fictional-member',blocked:false}));await pause()});await flush();assert.equal(dialogs().length,1,'score/write dialogs retain initial priority');
 otherDialog=true;await mount();assert.equal(dialogs().length,0);otherDialog=false;await act(async()=>{for(const f of observers)f();await pause()});assert.equal(dialogs().length,1);
 push.enable=async()=>{enableCalls++;throw Error('模拟连接失败，请重试')};await click('开启通知');assert.equal(dialogs().length,1);assert.ok(text(ui.toJSON()).includes('模拟连接失败'));assert.equal(ui.root.findByProps({role:'alert'}).children.length,1);
 let finishEnable;push.enable=()=>{enableCalls++;return new Promise(resolve=>{finishEnable=resolve})};await click('开启通知');assert.ok(ui.root.findAllByType('button').every(n=>n.props.disabled));await foreground();assert.equal(dialogs().length,1);assert.equal(dialogs()[0].props.historyCloseBlocked,true);await act(async()=>{finishEnable();await pause()});assert.equal(dialogs().length,0);
 push.config=async()=>({configured:false,publicKey:null});await mount();assert.equal(dialogs().length,0,'unconfigured services do not lock the app at entry');
 assert.equal(permissionCalls,0);assert.ok(configCalls>0);
 console.log('PASS locked notification prompt: no dismissal routes, back protection, persistent foreground/restore state, explicit permission gesture, denied/install recovery, service failures, confirmed-success close and dialog priority.');

}finally{if(ui)await act(()=>ui.unmount());for(const [k,v] of Object.entries(originals))globalThis[k]=v}
