import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';

await build({entryPoints:['app/avatar.tsx'],outfile:'.test-output/avatar-fire-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*'],loader:{'.css':'empty'}});
const {Avatar}=await import(pathToFileURL(resolve('.test-output/avatar-fire-ui.mjs')).href);
const old=Object.fromEntries(['document','IntersectionObserver','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,globalThis[key]]));
const listeners=new Set(),observed=new Set();let notify,renderer;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.document={hidden:false,addEventListener:(event,fn)=>{assert.equal(event,'visibilitychange');listeners.add(fn)},removeEventListener:(_event,fn)=>listeners.delete(fn)};
globalThis.IntersectionObserver=class{constructor(callback){notify=callback}observe(element){observed.add(element)}unobserve(element){observed.delete(element)}};
const props={p:{name:'Fictional player',avatarId:'fixture-avatar',winningStreak:{singles:0,doubles:2}},size:'ranking-avatar'};
try{
 await act(async()=>{renderer=create(React.createElement(Avatar,props),{createNodeMock:()=>({})})});
 const shell=()=>renderer.root.findByType('span');assert.ok(shell().props.className.includes('avatar avatar-fire-shell ranking-avatar'));assert.match(shell().props.title,/On fire.*双打 2 连胜/);
 assert.equal(renderer.root.findByType('svg').props['aria-hidden'],'true');
 assert.equal(shell().props['data-moving'],'false');assert.equal(observed.size,1);
 await act(async()=>notify([...observed].map(target=>({target,isIntersecting:true}))));assert.equal(shell().props['data-moving'],'true');
 await act(async()=>{document.hidden=true;for(const fn of listeners)fn()});assert.equal(shell().props['data-moving'],'false');
 await act(async()=>{document.hidden=false;for(const fn of listeners)fn()});assert.equal(shell().props['data-moving'],'true');
 await act(async()=>notify([...observed].map(target=>({target,isIntersecting:false}))));assert.equal(shell().props['data-moving'],'false');
 assert.equal(renderer.root.findByType('img').props.src,'/api/photos/fixture-avatar');
 await act(async()=>renderer.root.findByType('img').props.onError());assert.equal(renderer.root.findByType('img').props.src,'/default-avatar.svg','Broken uploaded images keep the normal fallback and fire');
 await act(async()=>renderer.update(React.createElement(Avatar,{...props,p:{...props.p,avatarId:'new-fixture-avatar',winningStreak:{singles:0,doubles:0}}})));assert.equal(renderer.root.findAllByType('svg').length,0);assert.equal(renderer.root.findByType('img').props.className,'avatar ranking-avatar');assert.equal(observed.size,0);assert.equal(listeners.size,0);
 await act(async()=>renderer.update(React.createElement(Avatar,{...props,p:{...props.p,winningStreak:{singles:2,doubles:0}}})));assert.match(shell().props.title,/单打 2 连胜/);
 const css=await import('node:fs').then(fs=>fs.readFileSync('app/avatar-fire.css','utf8'));assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/animation:none!important/);assert.match(css,/pointer-events:none/);
 console.log('PASS on-fire avatar: two-win threshold, singles/doubles tooltip, unchanged dimensions/fallback, decorative SVG, pause offscreen/background, reduced motion and removal/observer cleanup on loss');
}finally{if(renderer)await act(async()=>renderer.unmount());assert.equal(observed.size,0);assert.equal(listeners.size,0);for(const [key,value]of Object.entries(old))globalThis[key]=value}
