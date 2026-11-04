import assert from 'node:assert/strict';import {build} from 'esbuild';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import React,{act} from 'react';import {create} from 'react-test-renderer';
await build({entryPoints:['app/team-bond.tsx'],outfile:'.test-output/team-bond-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*'],loader:{'.css':'empty'}});
const {default:TeamBond}=await import(pathToFileURL(resolve('.test-output/team-bond-ui.mjs')).href);
const prior=Object.fromEntries(['document','IntersectionObserver','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,globalThis[k]])),listeners=new Set(),observed=new Set();let notify,ui;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.document={hidden:false,addEventListener:(_e,fn)=>listeners.add(fn),removeEventListener:(_e,fn)=>listeners.delete(fn)};
globalThis.IntersectionObserver=class{constructor(cb){notify=cb}observe(e){observed.add(e)}unobserve(e){observed.delete(e)}};
const render=async props=>{if(ui)await act(()=>ui.unmount());await act(()=>{ui=create(React.createElement(TeamBond,props),{createNodeMock:()=>({})})})};
const props={players:['p1','p2'],bond:{players:['p1','p2'],tier:10},active:true};
try{
 const silhouettes=new Set();for(let tier=0;tier<11;tier++){await render({...props,bond:{...props.bond,tier},active:false});assert.equal(ui.root.findByProps({role:'img'}).props['data-active'],'false');assert.ok(ui.root.findByProps({role:'img'}).props['aria-label'].includes('第 '+(tier+1)+' 阶'));silhouettes.add(JSON.stringify(ui.root.findByProps({className:'tb-symbol'}).children.map(n=>n.props)));assert.equal(observed.size,0,'static cards do not register motion observers')}
 assert.equal(silhouettes.size,11);
 for(const change of [{players:['p1','p3']},{players:['p1']},{players:['p1','p1']},{bond:{players:['p1','p2'],tier:99}},{bond:{tier:2}},{bond:null}]){await render({...props,...change});assert.equal(ui.toJSON(),null,'invalid or stale pairing must not show a badge')}
 await render({...props,players:['p2','p1']});assert.ok(ui.toJSON(),'reversing a pair keeps its relationship');assert.equal(observed.size,1);
 const badge=()=>ui.root.findByProps({role:'img'});assert.equal(badge().props['data-moving'],'false');await act(()=>notify([...observed].map(target=>({target,isIntersecting:true}))));assert.equal(badge().props['data-moving'],'true');
 await act(()=>{document.hidden=true;for(const fn of listeners)fn()});assert.equal(badge().props['data-moving'],'false');await act(()=>{document.hidden=false;for(const fn of listeners)fn()});assert.equal(badge().props['data-moving'],'true');
 await act(()=>notify([...observed].map(target=>({target,isIntersecting:false}))));assert.equal(badge().props['data-moving'],'false');
 console.log('PASS team bond badges: eleven emblems, stale/invalid/singles suppression, reversed teammates, static history and active visibility lifecycle');
}finally{if(ui)await act(()=>ui.unmount());assert.equal(observed.size,0);assert.equal(listeners.size,0);for(const [k,v]of Object.entries(prior))globalThis[k]=v}
