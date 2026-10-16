import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {renderToString} from 'react-dom/server';
import {create} from 'react-test-renderer';

mkdirSync('.test-output',{recursive:true});
globalThis.__entryLoads=0;
await build({entryPoints:['app/club-entry.tsx'],outfile:'.test-output/club-entry-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*'],loader:{'.css':'empty'},plugins:[{name:'entry-import-boundary',setup(b){
 b.onResolve({filter:/\/club-app$/},()=>({path:'application',namespace:'entry-test'}));
 b.onLoad({filter:/.*/,namespace:'entry-test'},()=>({loader:'js',contents:`import {createElement} from 'react';globalThis.__entryLoads++;export default function App(){return createElement('main',{'data-club':true},'Ready')}`}));
}}]});
const {default:Entry}=await import(pathToFileURL(resolve('.test-output/club-entry-ui.mjs')).href);
assert.equal(globalThis.__entryLoads,0,'the application module is not evaluated when the entry is imported');
const html=renderToString(React.createElement(Entry));
assert.ok(html.includes('role="status"'));assert.ok(html.includes('正在读取群组数据'));
assert.equal(globalThis.__entryLoads,0,'SSR must never evaluate the full application module');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let ui;
try{
 await act(async()=>{ui=create(React.createElement(Entry));await new Promise(r=>setTimeout(r,0))});
 assert.equal(globalThis.__entryLoads,1,'hydration loads the application once');
 assert.equal(ui.root.findByProps({'data-club':true}).children.join(''),'Ready');
 await act(()=>ui.update(React.createElement(Entry)));assert.equal(globalThis.__entryLoads,1);
 console.log('PASS lightweight entry: accessible SSR fallback, no application evaluation on the server, application starts after mount.');
}finally{if(ui)await act(()=>ui.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT;delete globalThis.__entryLoads}
