import assert from 'node:assert/strict';import {build} from 'esbuild';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import React,{act} from 'react';import {create} from 'react-test-renderer';import {readFileSync} from 'node:fs';
await build({entryPoints:['app/gift-art.tsx'],outfile:'.test-output/gift-art-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*'],loader:{'.css':'empty'}});
const {default:GiftArt,GiftReveal,giftArtKind}=await import(pathToFileURL(resolve('.test-output/gift-art-ui.mjs')).href);
const old=Object.fromEntries(['document','IntersectionObserver','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,globalThis[k]])),listeners=new Set(),observed=new Set();let notify,ui;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.document={hidden:false,addEventListener:(event,fn)=>{assert.equal(event,'visibilitychange');listeners.add(fn)},removeEventListener:(_event,fn)=>listeners.delete(fn)};
globalThis.IntersectionObserver=class{constructor(callback){notify=callback}observe(e){observed.add(e)}unobserve(e){observed.delete(e)}};
try{
 for(const [name,kind]of [['清风传意','feather'],['同心玉佩','jade'],['金兰灵契','scroll']]){assert.equal(giftArtKind(name),kind);assert.equal(giftArtKind(name+' × 99'),kind)}
 assert.equal(giftArtKind('自定义礼物'),'parcel');assert.equal(giftArtKind('金兰灵契伪装名称'),'parcel');
 await act(()=>{ui=create(React.createElement('div',null,...['清风传意','同心玉佩','金兰灵契'].map(name=>React.createElement(GiftArt,{name,key:name}))))});
 const svgs=ui.root.findAllByType('svg');assert.equal(svgs.length,3);for(const svg of svgs)assert.equal(svg.props['aria-hidden'],'true');
 const ids=ui.root.findAllByType('linearGradient').map(g=>g.props.id);assert.equal(new Set(ids).size,ids.length,'multiple icons cannot share gradient ids');
 await act(()=>ui.unmount());
 await act(()=>{ui=create(React.createElement(GiftReveal,{name:'同心玉佩 × 2'}),{createNodeMock:()=>({})})});
 const scene=()=>ui.root.findAllByType('div').find(d=>d.props['data-motion']);assert.equal(scene().props['data-motion'],'paused');assert.equal(observed.size,1);
 await act(()=>notify([...observed].map(target=>({target,isIntersecting:true}))));assert.equal(scene().props['data-motion'],'running');
 const iconId=ui.root.findAllByType('linearGradient')[0].props.id;
 await act(()=>ui.update(React.createElement(GiftReveal,{name:'同心玉佩 × 2'})));assert.equal(ui.root.findAllByType('linearGradient')[0].props.id,iconId,'unchanged receipt reuses the illustration on polling');
 await act(()=>{document.hidden=true;for(const fn of listeners)fn()});assert.equal(scene().props['data-motion'],'paused');
 await act(()=>{document.hidden=false;for(const fn of listeners)fn()});assert.equal(scene().props['data-motion'],'running');
 await act(()=>notify([...observed].map(target=>({target,isIntersecting:false}))));assert.equal(scene().props['data-motion'],'paused');
 const css=readFileSync('app/gift-art.css','utf8');assert.ok(!/infinite/.test(css));assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/animation:none!important/);
 console.log('PASS gift artwork: three receipt variants, unknown fallback, unique SVG ids, same-receipt reuse, pause offscreen/background, reduced motion and finite animation');
}finally{if(ui)await act(()=>ui.unmount());assert.equal(observed.size,0);assert.equal(listeners.size,0);for(const [k,v]of Object.entries(old))globalThis[k]=v}
