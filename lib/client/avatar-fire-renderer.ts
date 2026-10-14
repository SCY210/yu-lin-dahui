import {avatarFireFragment,avatarFireVertex} from './avatar-fire-shader';

type Target={canvas:HTMLCanvasElement;context:CanvasRenderingContext2D;moving:boolean};
export type AvatarFireSubscription={setMoving:(moving:boolean)=>void;dispose:()=>void};
const idleSubscription:AvatarFireSubscription={setMoving:()=>{},dispose:()=>{}};
const targets=new Map<HTMLCanvasElement,Target>();
let source:HTMLCanvasElement|null=null,gl:WebGLRenderingContext|null=null;
let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null;
let resolution:WebGLUniformLocation|null=null,clock:WebGLUniformLocation|null=null,embers:WebGLUniformLocation|null=null,square:WebGLUniformLocation|null=null;
let resizeObserver:ResizeObserver|null=null,motion:MediaQueryList|null=null;
let themeObserver:MutationObserver|null=null;
let frame:number|null=null,lastTime:number|null=null,seconds=3,lost=false;

function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=null;}
function active(){return !lost&&!motion?.matches&&!document.hidden&&[...targets.values()].some(target=>target.moving);}
function compile(type:number,code:string){
 const shader=gl!.createShader(type);if(!shader)throw Error('Cannot create fire shader');
 gl!.shaderSource(shader,code);gl!.compileShader(shader);
 if(!gl!.getShaderParameter(shader,gl!.COMPILE_STATUS)){gl!.deleteShader(shader);throw Error('Cannot compile fire shader')}
 return shader;
}
function configure(){
 const vertex=compile(gl!.VERTEX_SHADER,avatarFireVertex);
 let fragment:WebGLShader|null=null;
 try{
  fragment=compile(gl!.FRAGMENT_SHADER,avatarFireFragment);program=gl!.createProgram();
  if(!program)throw Error('Cannot create fire program');
  gl!.attachShader(program,vertex);gl!.attachShader(program,fragment);gl!.linkProgram(program);
  if(!gl!.getProgramParameter(program,gl!.LINK_STATUS))throw Error('Cannot link fire program');
  gl!.useProgram(program);buffer=gl!.createBuffer();if(!buffer)throw Error('Cannot create fire buffer');
  gl!.bindBuffer(gl!.ARRAY_BUFFER,buffer);gl!.bufferData(gl!.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl!.STATIC_DRAW);
  const position=gl!.getAttribLocation(program,'position');gl!.enableVertexAttribArray(position);gl!.vertexAttribPointer(position,2,gl!.FLOAT,false,0,0);
  resolution=gl!.getUniformLocation(program,'resolution');clock=gl!.getUniformLocation(program,'time');embers=gl!.getUniformLocation(program,'embers');square=gl!.getUniformLocation(program,'square');
 }finally{gl!.deleteShader(vertex);if(fragment)gl!.deleteShader(fragment)}
}
function size(target:Target){
 const rect=target.canvas.getBoundingClientRect(),scale=Math.min(window.devicePixelRatio||1,1.5);
 const height=Math.min(512,Math.max(1,Math.round(rect.height*scale))),width=Math.max(1,Math.round(height*128/168));
 if(target.canvas.width!==width||target.canvas.height!==height){target.canvas.width=width;target.canvas.height=height}
}
function paint(shown:Target[]){
 if(!gl||!source||lost||!shown.length)return;
 const height=Math.max(192,...shown.map(target=>target.canvas.height)),width=Math.round(height*128/168);
 if(source.width!==width||source.height!==height){source.width=width;source.height=height}
 gl.viewport(0,0,width,height);gl.useProgram(program);gl.uniform2f(resolution,width,height);gl.uniform1f(clock,motion?.matches?3:seconds);gl.uniform1f(embers,motion?.matches?0:1);gl.uniform1f(square,document.documentElement.classList.contains('wuxia-theme')?1:0);gl.drawArrays(gl.TRIANGLES,0,6);
 for(const target of shown){target.context.clearRect(0,0,target.canvas.width,target.canvas.height);target.context.drawImage(source,0,0,target.canvas.width,target.canvas.height);target.canvas.dataset.fireReady='true'}
}
function tick(now:number){
 frame=null;if(!active()){lastTime=null;return}
 // One shared shader at 30 fps serves every visible fiery avatar.
 if(lastTime===null||now-lastTime>=1000/30){
  if(lastTime!==null)seconds+=Math.min((now-lastTime)/1000,.1);
  lastTime=now;paint([...targets.values()].filter(target=>target.moving));
 }
 frame=requestAnimationFrame(tick);
}
function schedule(){if(active()){if(frame===null)frame=requestAnimationFrame(tick)}else stop();}
function onMotion(){paint([...targets.values()]);schedule();}
function onLost(event:Event){event.preventDefault();lost=true;stop();for(const target of targets.values()){target.canvas.dataset.fireReady='false';target.context.clearRect(0,0,target.canvas.width,target.canvas.height)}}
function onRestored(){
 try{configure();lost=false;paint([...targets.values()]);schedule()}
 catch{lost=true}
}
function release(){
 stop();resizeObserver?.disconnect();resizeObserver=null;themeObserver?.disconnect();themeObserver=null;motion?.removeEventListener('change',onMotion);motion=null;
 source?.removeEventListener('webglcontextlost',onLost);source?.removeEventListener('webglcontextrestored',onRestored);
 if(gl){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext()}
 if(source){source.width=1;source.height=1}
 source=null;gl=null;buffer=null;program=null;resolution=null;clock=null;embers=null;square=null;lost=false;seconds=3;
}
function initialize(){
 if(source)return true;
 try{
  source=document.createElement('canvas');gl=source.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!gl){release();return false}
  configure();motion=window.matchMedia('(prefers-reduced-motion: reduce)');motion.addEventListener('change',onMotion);
  source.addEventListener('webglcontextlost',onLost);source.addEventListener('webglcontextrestored',onRestored);
  if(typeof MutationObserver!=='undefined'){themeObserver=new MutationObserver(()=>paint([...targets.values()]));themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']})}
  if(typeof ResizeObserver!=='undefined')resizeObserver=new ResizeObserver(entries=>{
   const resized:Target[]=[];for(const entry of entries){const target=targets.get(entry.target as HTMLCanvasElement);if(target){size(target);resized.push(target)}}paint(resized);
  });
  return true;
 }catch{release();return false}
}
/** No per-avatar WebGL contexts or timers; paused targets retain their last frame. */
export function subscribeAvatarFire(canvas:HTMLCanvasElement):AvatarFireSubscription{
 if(typeof canvas.getContext!=='function')return idleSubscription;
 const context=canvas.getContext('2d');if(!context||!initialize())return idleSubscription;
 const target:Target={canvas,context,moving:false};targets.set(canvas,target);size(target);resizeObserver?.observe(canvas);paint([target]);
 let disposed=false;
 return {
  setMoving(moving){if(disposed)return;target.moving=moving;schedule()},
  dispose(){if(disposed)return;disposed=true;resizeObserver?.unobserve(canvas);targets.delete(canvas);canvas.dataset.fireReady='false';if(!targets.size)release();else schedule()},
 };
}
