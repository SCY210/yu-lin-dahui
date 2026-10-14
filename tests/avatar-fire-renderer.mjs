import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

await build({entryPoints:['lib/client/avatar-fire-renderer.ts'],outfile:'.test-output/avatar-fire-renderer.mjs',bundle:true,platform:'node',format:'esm'});
const {subscribeAvatarFire}=await import(pathToFileURL(resolve('.test-output/avatar-fire-renderer.mjs')).href);
const keys=['document','window','ResizeObserver','requestAnimationFrame','cancelAnimationFrame'];
const old=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
const frames=new Map(),observed=new Set(),mediaListeners=new Set();
let frameId=0,contexts=0,draws=0,released=0,resize,unsupported=false,compilationFails=false;
const sources=[],uniforms=new Map();
const media={matches:false,addEventListener:(_event,fn)=>mediaListeners.add(fn),removeEventListener:(_event,fn)=>mediaListeners.delete(fn)};
const gl={
 VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,FLOAT:7,TRIANGLES:8,
 createShader:()=>({}),shaderSource:()=>{},compileShader:()=>{},getShaderParameter:()=>!compilationFails,deleteShader:()=>{},
 createProgram:()=>({}),attachShader:()=>{},linkProgram:()=>{},getProgramParameter:()=>true,useProgram:()=>{},deleteProgram:()=>{},
 createBuffer:()=>({}),bindBuffer:()=>{},bufferData:()=>{},deleteBuffer:()=>{},getAttribLocation:()=>0,enableVertexAttribArray:()=>{},vertexAttribPointer:()=>{},
 getUniformLocation:(_program,name)=>name,uniform1f:(name,value)=>uniforms.set(name,value),uniform2f:()=>{},viewport:()=>{},drawArrays:()=>draws++,
 getExtension:()=>({loseContext:()=>released++}),
};
function canvas(){
 const result={width:0,height:0,dataset:{},copies:0,getBoundingClientRect:()=>({width:80,height:105}),getContext:()=>({clearRect:()=>{},drawImage:()=>result.copies++})};
 return result;
}
function step(time){assert.equal(frames.size,1,'Every visible avatar shares one pending frame');const [id,fn]=frames.entries().next().value;frames.delete(id);fn(time);}
function preference(reduced){media.matches=reduced;for(const fn of mediaListeners)fn();}
globalThis.document={hidden:false,documentElement:{classList:{contains:()=>false}},createElement:()=>{
 const events=new Map(),source={width:0,height:0,events,getContext:()=>{contexts++;return unsupported?null:gl},addEventListener:(event,fn)=>events.set(event,fn),removeEventListener:event=>events.delete(event)};
 sources.push(source);return source;
}};
globalThis.window={devicePixelRatio:3,matchMedia:()=>media};
globalThis.ResizeObserver=class{constructor(callback){resize=callback}observe(element){observed.add(element)}unobserve(element){observed.delete(element)}disconnect(){observed.clear()}};
globalThis.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
try{
 const first=canvas(),second=canvas(),a=subscribeAvatarFire(first),b=subscribeAvatarFire(second);
 assert.equal(contexts,1,'Many avatars must not exhaust the browser GPU context limit');assert.equal(frames.size,0,'Offscreen avatars have no animation timer');assert.equal(first.dataset.fireReady,'true');assert.equal(first.height,158,'High-density displays use a bounded rendering scale');
 a.setMoving(true);b.setMoving(true);const before=draws;step(10);assert.equal(draws,before+1,'One GPU draw supplies both avatars');assert.equal(frames.size,1);
 const firstCopies=first.copies;step(20);assert.equal(first.copies,firstCopies,'Drawing is capped at 30 fps');step(50);assert.ok(uniforms.get('time')>3);
 b.setMoving(false);const frozen=second.copies;step(90);assert.equal(second.copies,frozen,'Offscreen targets keep their last frame');
 a.setMoving(false);assert.equal(frames.size,0,'The last offscreen target cancels the timer');
 a.setMoving(true);document.hidden=true;step(130);assert.equal(frames.size,0,'A hidden page cannot continue painting');document.hidden=false;a.setMoving(true);
 preference(true);assert.equal(frames.size,0);assert.equal(uniforms.get('embers'),0,'Reduced-motion users get no floating embers');assert.equal(uniforms.get('time'),3,'Reduced motion uses a stable static frame');
 preference(false);assert.equal(frames.size,1);assert.equal(uniforms.get('embers'),1);
 let prevented=false;sources[0].events.get('webglcontextlost')({preventDefault:()=>{prevented=true}});assert.ok(prevented);assert.equal(frames.size,0);assert.equal(first.dataset.fireReady,'false','Context loss reveals the CSS fallback');
 sources[0].events.get('webglcontextrestored')();assert.equal(first.dataset.fireReady,'true');assert.equal(frames.size,1,'Restored contexts resume visible flames');
 first.getBoundingClientRect=()=>({width:160,height:210});resize([{target:first}]);assert.equal(first.height,315,'Resized avatars redraw at the correct size');
 a.dispose();a.dispose();assert.equal(observed.size,1);assert.equal(mediaListeners.size,1);b.dispose();assert.equal(observed.size,0);assert.equal(mediaListeners.size,0);assert.equal(frames.size,0);assert.equal(sources[0].events.size,0);assert.equal(released,1,'Removing the final avatar releases the GPU context');
 unsupported=true;const fallback=canvas();const c=subscribeAvatarFire(fallback);c.setMoving(true);c.dispose();assert.notEqual(fallback.dataset.fireReady,'true');assert.equal(frames.size,0);assert.equal(mediaListeners.size,0);
 unsupported=false;compilationFails=true;const failed=canvas();const d=subscribeAvatarFire(failed);d.setMoving(true);d.dispose();assert.notEqual(failed.dataset.fireReady,'true','Shader failures retain the static fallback');assert.equal(frames.size,0);assert.equal(mediaListeners.size,0);
 console.log('PASS flowing fire renderer: shared GPU/context/frame, bounded density/30fps, offscreen/hidden pause, reduced-motion frame without embers, resize, context loss/recovery, unsupported/failed shader fallback and final cleanup');
}finally{for(const [key,value]of Object.entries(old))if(value===undefined)delete globalThis[key];else globalThis[key]=value}
