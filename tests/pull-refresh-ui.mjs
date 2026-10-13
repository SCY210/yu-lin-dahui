import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['app/pull-to-refresh.tsx'],outfile:'.test-output/pull-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','lucide-react'],loader:{'.css':'empty'}});
const {default:Pull}=await import(pathToFileURL(resolve('.test-output/pull-ui.mjs')).href);
const original={Element:globalThis.Element,window:globalThis.window,document:globalThis.document,matchMedia:globalThis.matchMedia,act:globalThis.IS_REACT_ACT_ENVIRONMENT};let standalone=true,modal=false,refreshed=0,ui;const handlers=new Map();
globalThis.Element=class Element{};globalThis.matchMedia=()=>({matches:standalone});globalThis.document={querySelector:()=>modal?{}:null};globalThis.window={scrollY:0,addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const fire=async(name,ys,target={closest:()=>false})=>act(()=>handlers.get(name)?.({target,touches:ys.map(clientY=>({clientY})),cancelable:true,preventDefault(){}}));
try{
 await act(async()=>{ui=renderer.create(React.createElement(Pull,{onRefresh:()=>refreshed++}))});
 await fire('touchstart',[0]);await fire('touchmove',[180]);assert.ok(ui.toJSON());await fire('touchcancel',[]);assert.equal(refreshed,0);assert.equal(ui.toJSON(),null);
 await fire('touchstart',[0]);await fire('touchmove',[180]);await fire('touchmove',[180,185]);await fire('touchend',[]);assert.equal(refreshed,0);assert.equal(ui.toJSON(),null);
 await fire('touchstart',[0]);await fire('touchmove',[]);await fire('touchend',[]);assert.equal(refreshed,0);
 modal=true;await fire('touchstart',[0]);await fire('touchmove',[180]);await fire('touchend',[]);assert.equal(refreshed,0);modal=false;
 await fire('touchstart',[0],{closest:()=>({})});await fire('touchmove',[180]);await fire('touchend',[]);assert.equal(refreshed,0);
 await fire('touchstart',[0]);await fire('touchmove',[180]);window.scrollY=5;await fire('touchmove',[185]);await fire('touchend',[]);assert.equal(refreshed,0);window.scrollY=0;
 await fire('touchstart',[0]);await fire('touchmove',[100]);await fire('touchend',[]);assert.equal(refreshed,0);
 await fire('touchstart',[0]);await fire('touchmove',[180]);await fire('touchend',[]);assert.equal(refreshed,1);await fire('touchend',[]);assert.equal(refreshed,1);
 await act(()=>ui.unmount());ui=null;assert.equal(handlers.size,0);standalone=false;await act(async()=>{ui=renderer.create(React.createElement(Pull,{onRefresh:()=>refreshed++}))});assert.equal(handlers.size,0);assert.equal(ui.toJSON(),null);
 console.log('PASS pull refresh UI: cancel, multitouch, empty touches, dialogs, editable targets, page scroll, short pulls, one valid refresh, cleanup and ordinary-browser exclusion');
}finally{if(ui)await act(()=>ui.unmount());Object.assign(globalThis,{Element:original.Element,window:original.window,document:original.document,matchMedia:original.matchMedia,IS_REACT_ACT_ENVIRONMENT:original.act})}
