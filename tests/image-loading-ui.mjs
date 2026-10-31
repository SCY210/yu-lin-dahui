import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React,{act} from 'react';
import {create} from 'react-test-renderer';

mkdirSync('.test-output',{recursive:true});
await build({stdin:{contents:"export {Avatar} from './app/avatar';export {default as PlayerSocialCard} from './app/player-social-card';",resolveDir:process.cwd(),loader:'ts'},outfile:'.test-output/image-loading-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','lucide-react'],loader:{'.css':'empty'}});
const {Avatar,PlayerSocialCard}=await import(pathToFileURL(resolve('.test-output/image-loading-ui.mjs')).href);
const saved=Object.fromEntries(['window','fetch','Image','setTimeout','clearTimeout','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,globalThis[key]]));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window={matchMedia:()=>({matches:false})};
globalThis.fetch=()=>{throw new Error('Image intent must not issue a duplicate fetch')};
globalThis.Image=class{constructor(){throw new Error('Image intent must use the existing image element')}};
let ui,nextTimer=0;const timers=new Map();
globalThis.setTimeout=callback=>{const id=++nextTimer;timers.set(id,callback);return id};
globalThis.clearTimeout=id=>timers.delete(id);
const mount=async(Component,props)=>{if(ui)await act(()=>ui.unmount());await act(()=>{ui=create(React.createElement(Component,props))})};
const image=()=>ui.root.findByType('img');
const runFlipPhase=async()=>{assert.equal(timers.size,1);const [id,callback]=timers.entries().next().value;timers.delete(id);await act(()=>callback())};
const player={id:'fictional-player',name:'Fictional player',avatarId:'fictional-avatar',profile:{racket:'Fictional racket'}};
const props={player,photo:{id:'fictional-racket'},avatar:null,self:false,onProfile(){}};
try{
 await mount(Avatar,{p:player});
 assert.equal(image().props.loading,'lazy','ordinary roster avatars retain deferred loading');
 assert.equal(image().props.decoding,'async');
 for(const extra of [{},{winningStreak:{singles:2,doubles:0}},{losingStreak:{singles:0,doubles:4}}]){
  await act(()=>ui.update(React.createElement(Avatar,{p:{...player,...extra},eager:true})));
  assert.equal(image().props.loading,'eager','prominent avatars start immediately with every decoration');
  assert.equal(image().props.src,'/api/photos/fictional-avatar');
 }
 await act(()=>image().props.onError());
 assert.equal(image().props.src,'/default-avatar.svg');assert.equal(image().props.loading,'eager');
 await act(()=>ui.update(React.createElement(Avatar,{p:{...player,avatarId:'replacement-avatar'},eager:true})));
 assert.equal(image().props.src,'/api/photos/replacement-avatar','replacement avatars recover after an old image failed');

 for(const intent of ['onPointerEnter','onPointerDown','onFocusCapture']){
  await mount(PlayerSocialCard,props);
  const existing=image(),back=ui.root.findByProps({className:'pc-face pc-back'});
  assert.equal(back.props.hidden,true);assert.equal(existing.props.loading,'lazy');
  await act(()=>ui.root.findByType('article').props[intent]({pointerType:intent==='onPointerDown'?'touch':'mouse'}));
  assert.equal(image(),existing,'intent upgrades the existing element instead of mounting another image');
  assert.equal(image().props.loading,'eager',intent+' starts the hidden image before the flip');
  assert.equal(back.props.hidden,true);assert.equal(image().props.decoding,'async');
  assert.equal(ui.root.findAllByType('img').length,1);assert.equal(ui.root.findAllByType('link').length,0);
 }

 await mount(PlayerSocialCard,props);
 const existing=image();
 await act(()=>ui.root.findByProps({className:'pc-front-trigger'}).props.onClick());
 assert.equal(image().props.loading,'eager','click without prior hover also begins loading');
 assert.equal(ui.root.findByProps({className:'pc-face pc-back'}).props.hidden,true,'request begins during the outward animation');
 await runFlipPhase();await runFlipPhase();
 assert.equal(ui.root.findByProps({className:'pc-face pc-back'}).props.hidden,false);
 await act(()=>ui.root.findByProps({className:'pc-face pc-back'}).props.onClick({target:{closest:()=>null}}));
 await runFlipPhase();await runFlipPhase();
 assert.equal(image(),existing,'flipping both directions keeps the same loaded element');
 assert.equal(image().props.loading,'eager');
 assert.equal(ui.root.findByProps({className:'pc-face pc-back'}).props.hidden,true);
 await act(()=>ui.update(React.createElement(PlayerSocialCard,{...props,photo:{id:'replacement-racket'}})));
 assert.equal(image().props.src,'/api/photos/replacement-racket');assert.equal(image().props.loading,'lazy','a different hidden photo waits for its own intent');
 await act(()=>ui.root.findByType('article').props.onFocusCapture());
 assert.equal(image().props.loading,'eager');
 await act(()=>image().props.onError());assert.equal(ui.root.findAllByType('img').length,0,'failed photos retain the visible fallback');
 await act(()=>ui.update(React.createElement(PlayerSocialCard,{...props,photo:{id:'third-racket'}})));
 assert.equal(image().props.src,'/api/photos/third-racket');assert.equal(image().props.loading,'lazy');
 console.log('PASS image loading UI: default lazy roster, eager prominent avatars including streak decorations and fallback, pointer/touch/focus/flip intent loads the existing hidden photo before reveal, no duplicate preloader, retained element across flips and reset for replacement photos.');
}finally{
 if(ui)await act(()=>ui.unmount());
 for(const [key,value]of Object.entries(saved))globalThis[key]=value;
}
