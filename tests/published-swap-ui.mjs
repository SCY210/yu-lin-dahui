import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';

await build({entryPoints:['app/score-dialog.tsx'],outfile:'.test-output/published-swap-score.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*'],loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},plugins:[{name:'dialog-shell',setup(b){b.onResolve({filter:/^\.\/ui$/},a=>a.importer.endsWith('score-dialog.tsx')?{path:'pick',namespace:'swap-ui'}:undefined);b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'swap-ui'}));b.onLoad({filter:/.*/,namespace:'swap-ui'},a=>({loader:'js',contents:a.path==='pick'?"import{createElement as h}from'react';export function Pick({value,onChange,options}){return h('select',{value,onChange:e=>onChange(e.target.value)},options.map(([v,l])=>h('option',{key:v,value:v},l)))}":"import{createElement as h}from'react';const box=({children})=>h('section',null,children);export const Dialog=({open,children})=>open?children:null;export const DialogContent=box,DialogHeader=box,DialogTitle=box,DialogDescription=box;"}))}}]});
const ScoreDialog=(await import(pathToFileURL(resolve('.test-output/published-swap-score.mjs')).href)).default;
const old=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const m={id:'m',eventId:'e',roundId:'r',courtId:'court',status:'published',start:null,end:null,a:['p0','p1'],b:['p2','p3'],games:[]};
const calls=[],ctx={busy:false,name:id=>id,data:{me:{playerId:'p0'},events:[{id:'e',title:'Fictional activity',start:Date.now()+86400000}],rounds:[{id:'r',start:Date.now()+86400000}],bookings:[],seasons:[],settings:{rules:{ceiling:30}}},action:async(...args)=>calls.push(args)};
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const mount=async()=>{if(ui)await act(()=>ui.unmount());await act(()=>{ui=create(React.createElement(ScoreDialog,{m,ctx,close(){}}))})};
try{
 await mount();const inputs=ui.root.findAllByType('input');await act(()=>{inputs[0].props.onChange({target:{value:'21'}})});await act(()=>{inputs[1].props.onChange({target:{value:'19'}})});
 await act(async()=>ui.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.deepEqual(calls[0][1].expectedA,['p0','p1']);assert.deepEqual(calls[0][1].expectedB,['p2','p3']);
 await mount();await act(()=>ui.update(React.createElement(ScoreDialog,{m:{...m,a:['p8','p1']},ctx,close(){}})));
 const submit=ui.root.findAllByType('button').find(b=>text(b)==='提交比分');assert.ok(submit.props.disabled);assert.ok(text(ui.toJSON()).includes('人员已更新'));
 await act(async()=>ui.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(calls.length,1,'stale form does not save scores for the new players');
 console.log('PASS published swap score UI: captured team snapshots, updated lineup warning, disabled stale submit and no accidental score');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=old}
