import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});writeFileSync('.test-output/today-entry.ts',"export {default as HomeToday} from '../app/home-today';export {emptyState} from '../lib/domain/types';");
await build({entryPoints:['.test-output/today-entry.ts'],outfile:'.test-output/today-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','lucide-react'],loader:{'.css':'empty'}});
const {HomeToday,emptyState}=await import(pathToFileURL(resolve('.test-output/today-ui.mjs')).href);
const original={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT};const listeners=new Set(),requests=[],opened=[];let ui;
const surface={addEventListener:(n,f)=>listeners.add(f),removeEventListener:(n,f)=>listeners.delete(f)};globalThis.document=surface;globalThis.window={...surface,dispatchEvent:e=>requests.push(e.detail)};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const s=emptyState(),now=Date.now(),hour=3600000;s.me={id:'alice',playerId:'self',role:'member'};s.players=['self','partner','rival','fourth'].map(id=>({id,name:id,enabled:true}));
const activity=(id,start,end)=>({id,title:'Fixture '+id,start,end,venue:'Fixture Venue',address:'',creatorId:'host',status:'open',capacity:8,signupDeadline:end,cancelDeadline:start,ballMode:'equal',courtMode:'equal',note:''});s.events=[activity('live',now-hour,now+hour),activity('ended',now-2*hour,now-1000)];
s.registrations=s.events.map(e=>({id:e.id+'-reg',eventId:e.id,playerId:'self',status:'confirmed'}));s.rounds=[{id:'round',eventId:'live',status:'playing'}];
s.bookings=[{id:'c1',eventId:'live',name:'Court 1'},{id:'c2',eventId:'live',name:'Court 2'}];s.matches=['c1','c2'].map((courtId,i)=>({id:'m'+i,eventId:'live',roundId:'round',courtId,status:'playing',start:now-1000,a:i?['rival']:['self','partner'],b:i?['fourth']:['rival','fourth']}));
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
try{
 await act(async()=>{ui=renderer.create(React.createElement(HomeToday,{data:s,hasUnpaid:false,onOpen:(...args)=>opened.push(args),onBrowse(){}}))});
 assert.equal(ui.root.findAll(n=>n.props.className==='card home-live-activity').length,1,'courts share one activity card');assert.equal(ui.root.findAllByType('li').length,2);assert.ok(text(ui.toJSON()).includes('Court 1'));assert.ok(text(ui.toJSON()).includes('partner'));
 await act(()=>ui.root.findAllByType('button').find(b=>text(b).includes('录入比分')).props.onClick());assert.deepEqual(requests,['m0']);
 await act(()=>ui.root.findAllByType('button').find(b=>text(b)==='查看本场对局').props.onClick());await act(()=>ui.root.findAllByType('button').find(b=>text(b).includes('去投 MVP')).props.onClick());assert.deepEqual(opened,[['live','rounds'],['ended','social']]);
 const practice={...activity('practice',now-hour,now+hour),matchFormat:'practice',note:'Fixture footwork practice'};await act(async()=>ui.update(React.createElement(HomeToday,{data:{...s,events:[practice],matches:[],rounds:[]},hasUnpaid:false,onOpen:(...args)=>opened.push(args),onBrowse(){}})));assert.ok(text(ui.toJSON()).includes('练球中'));assert.ok(text(ui.toJSON()).includes('Fixture footwork practice'));assert.ok(!ui.root.findAllByType('button').some(b=>text(b).includes('录入比分')));await act(()=>ui.root.findAllByType('button').find(b=>text(b)==='查看练球安排').props.onClick());assert.deepEqual(opened.at(-1),['practice','overview']);
 await act(()=>ui.unmount());ui=null;assert.equal(listeners.size,0);
 console.log('PASS home today UI: one card for two courts, own partner/opponents, direct score event, activity route, eligible MVP route and listener cleanup');
}finally{if(ui)await act(()=>ui.unmount());Object.assign(globalThis,{window:original.window,document:original.document,IS_REACT_ACT_ENVIRONMENT:original.act})}
