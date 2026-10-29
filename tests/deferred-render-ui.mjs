import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';

mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['app/disclosure.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*'],loader:{'.css':'empty'},outfile:'.test-output/deferred-render-ui.mjs'});
const {default:Disclosure}=await import(pathToFileURL(resolve('.test-output/deferred-render-ui.mjs')).href);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let ui,calculations=0,rows=Array.from({length:500},(_,i)=>i);
const expensiveRows=()=>rows.map(id=>{calculations++;return React.createElement('p',{key:id},'Activity '+id)});
const mount=async ({children,...props})=>{if(ui)await act(()=>ui.unmount());await act(()=>{ui=renderer.create(React.createElement(Disclosure,{label:'History',...props},children))})};
const toggle=async open=>act(()=>ui.root.findByType('details').props.onToggle({currentTarget:{open}}));
try{
 await mount({children:expensiveRows});
 assert.equal(calculations,0,'closed history avoids all row calculations, not just DOM mounting');
 for(let refresh=0;refresh<5;refresh++)await act(()=>ui.update(React.createElement(Disclosure,{label:'History'},expensiveRows)));
 assert.equal(calculations,0,'background refreshes do no work for closed rows');
 await toggle(true);
 assert.equal(calculations,500);assert.equal(ui.root.findAllByType('p').length,500);
 await toggle(false);const afterClose=calculations;
 rows=[700];
 await act(()=>ui.update(React.createElement(Disclosure,{label:'Updated history'},expensiveRows)));
 assert.equal(calculations,afterClose);assert.equal(ui.root.findAllByType('p').length,0);
 await toggle(true);
 assert.equal(calculations,afterClose+1);assert.equal(ui.root.findByType('p').children[0],'Activity 700','reopening uses the latest data');
 await mount({defaultOpen:true,children:expensiveRows});
 assert.equal(ui.root.findByType('p').children[0],'Activity 700','default-open sections still render immediately');
 await mount({children:React.createElement('p',null,'Ordinary child')});
 await toggle(true);assert.equal(ui.root.findByType('p').children[0],'Ordinary child','existing ReactNode callers stay compatible');
 console.log('PASS deferred render: zero calculations for 500 closed history rows across refreshes; opening/reopening, fresh data, default-open and ordinary children preserved');
}finally{if(ui)await act(()=>ui.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT}
