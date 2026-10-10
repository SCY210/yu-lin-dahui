// Real React components with isolated responses and fictional bills; never contacts production.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/home-fee-entry.ts',"export {default as ReminderButton} from '../app/reminder-button';export {default as HomeUnpaid} from '../app/home-unpaid';export {default as MyFeeList} from '../app/my-fee-list';");
await build({entryPoints:['.test-output/home-fee-entry.ts'],outfile:'.test-output/home-fee-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','react-dom','react-dom/*','lucide-react','sonner'],loader:{'.css':'empty'}});
const {ReminderButton,HomeUnpaid,MyFeeList}=await import(pathToFileURL(resolve('.test-output/home-fee-ui.mjs')).href);
const original={fetch:globalThis.fetch,document:globalThis.document,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
const requests=[],listeners=new Map(),timers=new Map();let nextTimer=0,ui;
globalThis.document={visibilityState:'visible',addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name)}};
globalThis.setInterval=fn=>{const id=++nextTimer;timers.set(id,fn);return id};globalThis.clearInterval=id=>timers.delete(id);
globalThis.fetch=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const mount=async(Component,props)=>{if(ui)await act(()=>ui.unmount());await act(async()=>{ui=renderer.create(React.createElement(Component,props))})};
const reply=async(index,accountId,unread)=>{await act(async()=>{requests[index].resolve({ok:true,json:async()=>({accountId,unread,configured:false,publicKey:null,items:[]})})})};
const text=node=>typeof node==='string'?node:(Array.isArray(node)?node:node?.children??[]).map(text).join('');
try{
 await mount(ReminderButton,{refreshKey:'home',onOpen(){}});assert.equal(ui.toJSON(),null);assert.equal(requests.length,0,'onboarding has no account or reminder request');
 let opened=0;await mount(ReminderButton,{accountId:'alice',refreshKey:'home',onOpen:()=>opened++});assert.equal(requests.length,1);
 await act(()=>listeners.get('visibilitychange')());assert.equal(requests.length,2);await reply(1,'alice',1);await reply(0,'alice',9);assert.match(ui.root.findByType('button').props['aria-label'],/1 条未读/,'late responses cannot overwrite newer counts');
 await act(()=>ui.root.findByType('button').props.onClick());assert.equal(opened,1);
 await act(()=>listeners.get('visibilitychange')());await act(async()=>ui.update(React.createElement(ReminderButton,{accountId:'bob',refreshKey:'home',onOpen(){}})));assert.equal(ui.root.findByType('button').props['aria-label'],'提醒','switching accounts immediately hides the previous count');
 await reply(2,'alice',50);assert.equal(ui.root.findByType('button').props['aria-label'],'提醒');await reply(3,'bob',105);assert.ok(text(ui.toJSON()).includes('99+'));
 await act(()=>listeners.get('visibilitychange')());await act(async()=>requests[4].reject(new Error('Fixture offline')));assert.match(ui.root.findByType('button').props['aria-label'],/105 条未读/);
 document.visibilityState='hidden';await act(()=>[...timers.values()][0]());assert.equal(requests.length,5);document.visibilityState='visible';await act(()=>[...timers.values()][0]());await reply(5,'bob',0);assert.equal(ui.root.findByType('button').props['aria-label'],'提醒');
 await act(()=>ui.unmount());ui=null;assert.equal(timers.size,0);assert.equal(listeners.size,0);
 assert.match(readFileSync('app/reminder-button.css','utf8'),/@media\(prefers-reduced-motion:reduce\).*animation:none/);
 const bill=(playerId,total)=>({playerId,total,court:total,ball:0,other:0,minutes:60}),split=(id,version,bills)=>({id,eventId:'e',version,bills,created:version,confirmed:true,total:600,subsidy:0,unallocated:0,detail:[],reason:'Fixture'});
 const old=split('v1',1,[bill('p1',300)]),latest=split('v2',2,[bill('friend',300)]),props={settlements:[old,latest],payments:[],players:[{id:'p1',ownerId:'alice',name:'Fictional Alice'},{id:'friend',ownerId:'alice',name:'Fictional Friend'}],me:{id:'alice',playerId:'p1'},events:[{id:'e',title:'Fictional activity'}],onOpen:id=>requests.push(id)};
 await mount(HomeUnpaid,props);assert.ok(text(ui.toJSON()).includes('有 1 场活动还没付款'));assert.ok(text(ui.toJSON()).includes('代 Fictional Friend 付'));await act(()=>ui.root.findByType('button').props.onClick());assert.equal(requests.at(-1),'e');
 await act(async()=>ui.update(React.createElement(HomeUnpaid,{...props,payments:[{eventId:'e',playerId:'friend',cents:300}]})));assert.equal(ui.toJSON(),null,'paying the latest bill hides the card');
 await mount(MyFeeList,{settlements:[old,latest],playerId:'p1',eventName:id=>id,onOpen(){}});assert.equal(ui.root.findAllByType('button').length,0,'the newer version removes the old member bill');
 await mount(MyFeeList,{settlements:[old],playerId:'p1',payments:[{eventId:'e',playerId:'p1',cents:300}],eventName:id=>id,onOpen(){}});assert.ok(text(ui.toJSON()).includes('已付款'));
 console.log('PASS home fee/reminder UI: onboarding, latest response wins, account isolation, 99+, failure preservation, visible-only refresh, cleanup/reduced motion, latest bills, proxy navigation, paid and removed hiding');
}finally{if(ui)await act(()=>ui.unmount());Object.assign(globalThis,{fetch:original.fetch,document:original.document,setInterval:original.setInterval,clearInterval:original.clearInterval,IS_REACT_ACT_ENVIRONMENT:original.act})}
