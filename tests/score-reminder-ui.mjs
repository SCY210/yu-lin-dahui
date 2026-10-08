// Actual React lifecycle + score form, with lightweight dialog shells instead
// of browser portals. No browser automation, live API or real match writes.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';

await build({entryPoints:['tests/fixtures/score-reminder-preview.tsx'],outfile:'.test-output/score-reminder-ui-fixture.mjs',bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*'],loader:{'.css':'empty'},plugins:[{name:'headless-dialog-shells',setup(b){
 b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'score-ui'}));
 b.onResolve({filter:/components\/ui\/checkbox$/},()=>({path:'checkbox',namespace:'score-ui'}));
 b.onLoad({filter:/.*/,namespace:'score-ui'},a=>({loader:'js',contents:a.path==='dialog'?`import {createElement} from 'react';export const Dialog=({children})=>children;export const DialogContent=({children})=>createElement('section',{role:'dialog'},children);export const DialogHeader=({children})=>createElement('header',null,children);export const DialogTitle=({children})=>createElement('h2',null,children);export const DialogDescription=({children})=>createElement('p',null,children);export const DialogFooter=({children})=>children;export const DialogClose=({children})=>children;export const DialogTrigger=({children})=>children;`:`import {createElement} from 'react';export const Checkbox=props=>createElement('input',{type:'checkbox',...props});`}));
}}]});
const {default:Preview}=await import(pathToFileURL(resolve('.test-output/score-reminder-ui-fixture.mjs')).href);
const listeners=new Map(),documentListeners=new Map();
const doc={hidden:false,querySelector:()=>null,addEventListener:(n,f)=>{if(!documentListeners.has(n))documentListeners.set(n,new Set());documentListeners.get(n).add(f)},removeEventListener:(n,f)=>documentListeners.get(n)?.delete(f)};
const win={addEventListener:(n,f)=>{if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f)},removeEventListener:(n,f)=>listeners.get(n)?.delete(f)};
const prior={document:globalThis.document,window:globalThis.window,act:globalThis.IS_REACT_ACT_ENVIRONMENT};globalThis.document=doc;globalThis.window=win;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.children?.map(text).join('')??'';
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));let renderer;
const button=label=>renderer.root.findAllByType('button').find(n=>text(n).includes(label));
const headings=()=>renderer.root.findAllByType('h2').map(text);
async function click(label){await act(async()=>{const target=button(label);assert.ok(target,label);target.props.onClick();await pause()})}
try{
 await act(async()=>{renderer=create(React.createElement(React.StrictMode,null,React.createElement(Preview,{blocked:true})));await pause()});
 assert.equal(headings().includes('录入本局比分'),false,'An existing dialog/write must defer the reminder');
 await act(async()=>{renderer.update(React.createElement(React.StrictMode,null,React.createElement(Preview,{blocked:false})));await pause()});assert.ok(headings().includes('录入本局比分'));
 await click('稍后再录');assert.equal(headings().includes('录入本局比分'),false);
 await act(async()=>{renderer.update(React.createElement(React.StrictMode,null,React.createElement(Preview)));await pause()});assert.equal(headings().includes('录入本局比分'),false,'Polling/rerender must not re-open a postponed prompt');
 await click('去录分');assert.ok(headings().includes('录入本局比分'));
 let inputs=renderer.root.findAllByType('input').filter(n=>n.props.type==='number');assert.equal(inputs.length,2);assert.ok(inputs.every(n=>n.props.value===''&&n.props.inputMode==='numeric'));assert.equal(renderer.root.findAllByType('input').length,2,'First entry has only two score inputs, no reason input');assert.equal(inputs[0].props.autoFocus,true);
 await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}})});assert.ok(renderer.root.findAll(n=>n.props.role==='alert').some(n=>text(n).includes('实际比分')));assert.equal(renderer.root.findAll(n=>n.props.role==='status').length,0);
 await act(async()=>{inputs[0].props.onChange({target:{value:'21'}})});inputs=renderer.root.findAllByType('input').filter(n=>n.props.type==='number');await act(async()=>{inputs[1].props.onChange({target:{value:'19'}})});
 inputs=renderer.root.findAllByType('input').filter(n=>n.props.type==='number');await act(async()=>{inputs[0].props.onChange({target:{value:''}})});inputs=renderer.root.findAllByType('input').filter(n=>n.props.type==='number');assert.equal(inputs[0].props.value,'','Clearing must not turn a missing score into zero');
 await act(async()=>{inputs[0].props.onChange({target:{value:'21'}})});await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}});await pause()});
 assert.ok(renderer.root.findAll(n=>n.props.role==='status').some(n=>text(n).includes('已保存')));assert.equal(headings().includes('录入本局比分'),false);assert.equal(headings().includes('录入本局比分'),false,'A next live assignment must not immediately re-open score entry');
 await act(async()=>{doc.hidden=true;for(const f of documentListeners.get('visibilitychange')??[])f();doc.hidden=false;for(const f of documentListeners.get('visibilitychange')??[])f();await pause()});assert.ok(headings().includes('录入本局比分'),'Returning to the app refreshes and offers the next own pending game');
 await act(async()=>{renderer.unmount();renderer=create(React.createElement(Preview,{teamSide:'b'}));await pause()});
 assert.ok(headings().includes('录入本局比分'));inputs=renderer.root.findAllByType('input').filter(n=>n.props.type==='number');assert.equal(inputs[0].props['aria-label'],'第1局乙队比分','My team must be first even on side B');assert.equal(inputs[0].props.autoFocus,true);
 await act(async()=>{inputs[0].props.onChange({target:{value:'21'}})});inputs=renderer.root.findAllByType('input').filter(n=>n.props.type==='number');await act(async()=>{inputs[1].props.onChange({target:{value:'19'}})});await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}});await pause()});assert.ok(renderer.root.findAll(n=>n.props.role==='status').some(n=>text(n).includes('19:21')),'My team display order must preserve the stored A/B score mapping');
 console.log('PASS direct score dialog: immediate two-input form, no reason step, postpone/manual return, blank and cleared score validation, save dismissal, no immediate next-game popup, foreground return and correct side-B score mapping');
}finally{if(renderer)await act(async()=>renderer.unmount());globalThis.document=prior.document;globalThis.window=prior.window;globalThis.IS_REACT_ACT_ENVIRONMENT=prior.act}
