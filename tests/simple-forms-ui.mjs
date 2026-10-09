// Exercise real form and score components without browser portals or production data.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
const shell=`import {createElement as h} from 'react';const box=({children})=>h('section',null,children);const heading=({children})=>h('h2',null,children);const button=({children,...props})=>h('button',props,children);`;
const dialog=shell+`export const Dialog=({open,children})=>open?children:null;export const DialogContent=box,DialogHeader=box,DialogDescription=box,DialogTitle=heading;`;
const alert=shell+`export const AlertDialog=({open,children})=>open?children:null;export const AlertDialogContent=box,AlertDialogHeader=box,AlertDialogDescription=box,AlertDialogFooter=box,AlertDialogTitle=heading,AlertDialogAction=button,AlertDialogCancel=button;`;
await build({entryPoints:['tests/fixtures/simple-forms-preview.tsx'],outfile:'.test-output/simple-forms-fixture.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*'],loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},plugins:[{name:'dialog-shells',setup(b){
 b.onResolve({filter:/components\/ui\/(dialog|alert-dialog|checkbox)$/},a=>({path:a.path.split('/').at(-1),namespace:'simple-ui'}));
 b.onLoad({filter:/.*/,namespace:'simple-ui'},a=>({loader:'js',contents:a.path==='dialog'?dialog:a.path==='alert-dialog'?alert:`import {createElement} from 'react';export const Checkbox=props=>createElement('input',{type:'checkbox',...props});`}));
}}]});
const {default:Preview}=await import(pathToFileURL(resolve('.test-output/simple-forms-fixture.mjs')).href),prior=globalThis.IS_REACT_ACT_ENVIRONMENT;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;let renderer;const calls=[];const onAction=async(action,payload)=>{calls.push({action,payload})};
try{
 await act(async()=>{renderer=create(React.createElement(Preview,{kind:'edit',onAction}))});
 assert.equal(renderer.root.findAllByType('input').length,1,'Reason field is not rendered');
 await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}})});assert.deepEqual(calls.pop(),{action:'bookingEdit',payload:{cents:690,reason:'调整场地费用'}});
 await act(async()=>{renderer.unmount();renderer=create(React.createElement(Preview,{kind:'danger',onAction}))});assert.equal(renderer.root.findAllByType('input').length,0);
 const confirm=renderer.root.findAllByType('button').find(b=>b.children.join('')==='确认删除');assert.ok(confirm);assert.equal(confirm.props.disabled,false);await act(async()=>{confirm.props.onClick()});assert.deepEqual(calls.pop(),{action:'deleteEvent',payload:{eventId:'fixture-event',reason:'确认删除活动'}});
 await act(async()=>{renderer.unmount();renderer=create(React.createElement(Preview,{kind:'score',onAction}))});const inputs=renderer.root.findAllByType('input');assert.equal(inputs.length,2);assert.ok(inputs.every(n=>n.props.type==='number'));
 await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}})});const scored=calls.pop();assert.equal(scored.action,'score');assert.equal(scored.payload.reason,'修正比赛结果');assert.deepEqual(scored.payload.games,[{a:21,b:19}]);
 console.log('PASS simplified real React forms: no required reason input, automatic audit text, destructive confirmation retained and singles score correction');
}finally{if(renderer)await act(async()=>renderer.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=prior}
