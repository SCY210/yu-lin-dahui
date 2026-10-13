// Actual score reminder/dialog lifecycle; fictional data and no production writes.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/score-conflict-ui-entry.ts',"export {default} from '../app/score-reminder';export {emptyState} from '../lib/domain/types';");
await build({entryPoints:['.test-output/score-conflict-ui-entry.ts'],outfile:'.test-output/score-conflict-ui.mjs',bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*'],loader:{'.css':'empty'},plugins:[{name:'score-dialog-shell',setup(b){
 b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'score-conflict-ui'}));
 b.onResolve({filter:/components\/ui\/checkbox$/},()=>({path:'checkbox',namespace:'score-conflict-ui'}));
 b.onLoad({filter:/.*/,namespace:'score-conflict-ui'},a=>({loader:'js',contents:a.path==='dialog'?"import{createElement as h}from'react';export const Dialog=({children})=>children;export const DialogContent=({children})=>h('section',{role:'dialog'},children);export const DialogHeader=({children})=>h('header',null,children);export const DialogTitle=({children})=>h('h2',null,children);export const DialogDescription=({children})=>h('p',null,children);export const DialogFooter=({children})=>children;export const DialogClose=({children})=>children;export const DialogTrigger=({children})=>children;":"import{createElement as h}from'react';export const Checkbox=props=>h('input',{type:'checkbox',...props});"}));
}}]});
const {default:Reminder,emptyState}=await import(pathToFileURL(resolve('.test-output/score-conflict-ui.mjs')).href);
const old={document:globalThis.document,window:globalThis.window,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
globalThis.document={hidden:false,querySelector:()=>null,addEventListener(){},removeEventListener(){}};
globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join(''),pause=()=>new Promise(resolve=>setTimeout(resolve,0));let ui;
const now=Date.now(),data={...emptyState(),me:{id:'viewer',playerId:'p2',role:'member'}};
data.players=['p0','p1','p2','p3'].map((id,i)=>({id,name:['First','Partner','Me','Other'][i],enabled:true}));
data.events=[{id:'e',title:'Fictional activity',start:now-3600000,end:now+3600000,status:'live'}];
data.bookings=[{id:'court',eventId:'e',name:'Court 1'}];data.rounds=[{id:'r',eventId:'e',status:'playing',start:now-60000,live:true}];
data.registrations=[{eventId:'e',playerId:'p2',status:'confirmed',arrival:now-3600000,departure:now+3600000}];
data.matches=[{id:'m',eventId:'e',roundId:'r',courtId:'court',a:['p0','p1'],b:['p2','p3'],status:'playing',start:now-60000,end:null,games:[],monthly:true,elo:true}];
let current=data;const writes=[];
const props=()=>({ctx:{data:current,busy:false,name:id=>current.players.find(p=>p.id===id)?.name??id,refresh:async()=>current,action:async(action,payload)=>{writes.push({action,payload})}}});
try{
 await act(async()=>{ui=create(React.createElement(Reminder,props()));await pause()});
 assert.ok(ui.root.findAllByType('form').length,'initial pending game opens its score form');
 let inputs=ui.root.findAllByType('input').filter(n=>n.props.type==='number');assert.equal(inputs[0].props['aria-label'],'第1局乙队比分');
 await act(()=>inputs[0].props.onChange({target:{value:'15'}}));
 current=structuredClone(data);Object.assign(current.matches[0],{status:'complete',end:now,games:[{a:21,b:17}],scoreA:21,scoreB:17,enteredByPlayerId:'p1'});
 await act(async()=>{ui.update(React.createElement(Reminder,props()));await pause()});
 assert.ok(text(ui.toJSON()).includes('这局已录入比分'),'remote completion must leave the selected game visible');assert.ok(text(ui.toJSON()).includes('Partner'));
 assert.equal(ui.root.findAllByType('form').length,0,'a stale score draft cannot overwrite the saved score');assert.equal(writes.length,0);
 const correct=ui.root.findAllByType('button').find(b=>text(b).includes('比分不对'));await act(()=>correct.props.onClick());
 inputs=ui.root.findAllByType('input').filter(n=>n.props.type==='number');assert.deepEqual(inputs.map(i=>i.props.value),[17,21],'correction follows the displayed side-B-first order');
 await act(()=>inputs[0].props.onChange({target:{value:'19'}}));
 await act(async()=>{await ui.root.findByType('form').props.onSubmit({preventDefault(){}})});
 assert.equal(writes.length,1);assert.equal(writes[0].action,'score');assert.deepEqual(writes[0].payload.expectedGames,[{a:21,b:17}]);assert.deepEqual(writes[0].payload.games,[{a:21,b:19}]);
 assert.equal(ui.root.findAllByType('form').length,0,'a successful correction closes the reminder');
 console.log('PASS score conflict UI: remote completion stays visible, stale edits blocked, named scorer, explicit correction and side-B snapshot mapping.');
}finally{if(ui)await act(()=>ui.unmount());globalThis.document=old.document;globalThis.window=old.window;globalThis.IS_REACT_ACT_ENVIRONMENT=old.act}
