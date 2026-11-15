// Real phone prompt with fictional values; never contacts production.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import renderer from 'react-test-renderer';

mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/phone-prompt-entry.ts',"export {default as PhonePrompt} from '../app/phone-prompt';");
const shell=`import {createElement as h} from 'react';const box=({children})=>h('section',null,children);const heading=({children})=>h('h2',null,children);`;
await build({entryPoints:['.test-output/phone-prompt-entry.ts'],outfile:'.test-output/phone-prompt-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'dialog',setup(b){
 b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'phone-ui'}));
 b.onLoad({filter:/.*/,namespace:'phone-ui'},()=>({loader:'js',contents:shell+`export const Dialog=({open,children})=>open?children:null;export const DialogContent=box,DialogHeader=box,DialogTitle=heading,DialogDescription=box;`}));
}}]});
const {PhonePrompt}=await import(pathToFileURL(resolve('.test-output/phone-prompt-ui.mjs')).href);
const prior=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=node=>typeof node==='string'?node:(Array.isArray(node)?node:node?.children??[]).map(text).join('');
const mount=async props=>{if(ui)await act(()=>ui.unmount());await act(async()=>{ui=renderer.create(React.createElement(PhonePrompt,props))})};
const button=label=>ui.root.findAllByType('button').find(b=>text(b).includes(label));
try{
 const calls=[],props={blocked:false,onFill:()=>calls.push('fill'),onClose:()=>calls.push('close')};
 await mount({...props,phone:undefined});
 const shown=text(ui.toJSON());
 for(const part of ['道友仙箓尚缺传讯之号','各转各的','宗主、副宗主和与你互相转账的道友可见'])assert.ok(shown.includes(part),part);
 await act(()=>button('即刻补录').props.onClick());
 assert.deepEqual(calls,['close','fill'],'filling closes the prompt and opens the phone form');assert.equal(ui.toJSON(),null);
 calls.length=0;await mount({...props,phone:'  '});await act(()=>button('容后再议').props.onClick());
 assert.deepEqual(calls,['close'],'later closes it until the app opens again');assert.equal(ui.toJSON(),null);
 await mount({...props,phone:'600 111 111'});assert.equal(ui.toJSON(),null,'nothing to ask once a number is saved');
 await mount({...props,phone:undefined,blocked:true});assert.equal(ui.toJSON(),null,'waits behind other popups');
 console.log('PASS phone prompt UI: asks members without a number, fill and later, saved numbers and blocking popups');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=prior}
