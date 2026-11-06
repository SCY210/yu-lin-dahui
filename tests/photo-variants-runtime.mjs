// Local workerd + Images + R2 smoke using a generated, fictional image only.
// Miniflare currently ignores fit/quality/animation options, so the square fixture
// tests codecs, transparency, bounds and persistence, not full production parity.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare,Log,LogLevel} from 'miniflare';
import sharp from 'sharp';

mkdirSync('.test-output',{recursive:true});
const edge=1200,pixels=Buffer.alloc(edge*edge*4);
let seed=941;
for(let y=0;y<edge;y++)for(let x=0;x<edge;x++){
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 const offset=(y*edge+x)*4,noise=seed>>>27;
 pixels[offset]=(Math.floor(x/5)+noise)%256;
 pixels[offset+1]=(Math.floor(y/5)+noise)%256;
 pixels[offset+2]=(Math.floor((x+y)/10)+noise)%256;
 pixels[offset+3]=(x-edge/2)**2+(y-edge/2)**2<(edge*.46)**2?255:0;
}
const original=await sharp(pixels,{raw:{width:edge,height:edge,channels:4}}).png().toBuffer();
assert.ok(original.length<5*1024*1024,'fixture fits the upload limit');
const worker='.test-output/photo-variants-runtime-worker.mjs';
await build({stdin:{contents:`
import {readPhotoRepresentation} from './lib/photo-variants';
const photo={id:'fictional-large-image',key:'media/fictional-large-image',type:'image/png',size:${original.length}};
const stats={gets:[],puts:[],transforms:0};let bucket;
export default {async fetch(request,env){
 if(new URL(request.url).pathname==='/stats')return Response.json(stats);
 bucket??={get:key=>{stats.gets.push(key);return env.BUCKET.get(key)},put:(key,...args)=>{stats.puts.push(key);return env.BUCKET.put(key,...args)},delete:key=>env.BUCKET.delete(key)};
 const variant=new URL(request.url).pathname.slice(1);
 const result=await readPhotoRepresentation({photo,variant:variant==='original'?null:variant,bucket,
  images:{input:stream=>{stats.transforms++;return env.IMAGES.input(stream)}},isCurrent:async()=>true});
 return result?new Response(result.body,{headers:{'Content-Type':result.type,'X-Representation':result.variant??'original'}}):new Response(null,{status:404});
}};`,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',outfile:worker});

const mf=new Miniflare({modules:true,scriptPath:worker,compatibilityDate:'2026-05-15',
 cf:false,images:{binding:'IMAGES'},r2Buckets:['BUCKET'],log:new Log(LogLevel.ERROR),
 outboundService:()=>{throw new Error('External network is forbidden in the image runtime test')},
});
try{
 const bucket=await mf.getR2Bucket('BUCKET');
 await bucket.put('media/fictional-large-image',original,{httpMetadata:{contentType:'image/png'}});
 const report={fixture:{width:edge,height:edge,bytes:original.length},variants:{},runtime:'Miniflare local Images; elapsed times are not deployed Worker CPU or user network latency'};
 for(const [variant,size] of [['avatar',192],['preview',960]]){
  const before=await (await mf.dispatchFetch('http://fixture/stats')).json();
  const started=performance.now(),response=await mf.dispatchFetch('http://fixture/'+variant);
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');
  assert.equal(response.headers.get('X-Representation'),variant);
  const bytes=Buffer.from(await response.arrayBuffer()),firstMs=performance.now()-started;
  const metadata=await sharp(bytes).metadata();
  assert.equal(metadata.format,'webp');assert.equal(metadata.width,size);assert.equal(metadata.height,size);assert.equal(metadata.hasAlpha,true);
  const decoded=await sharp(bytes).ensureAlpha().raw().toBuffer();
  assert.equal(decoded[3],0,'transparent corner survives');
  assert.equal(decoded[(Math.floor(size/2)*size+Math.floor(size/2))*4+3],255,'opaque center survives');
  assert.ok(bytes.length<original.length/2,'thumbnail materially reduces transfer bytes');
  const generated=await (await mf.dispatchFetch('http://fixture/stats')).json();
  assert.equal(generated.transforms-before.transforms,1);assert.equal(generated.puts.length-before.puts.length,1);
  const warmStarted=performance.now(),warm=await mf.dispatchFetch('http://fixture/'+variant);
  assert.deepEqual(Buffer.from(await warm.arrayBuffer()),bytes,'stored representation preserves encoded bytes');
  const warmMs=performance.now()-warmStarted,after=await (await mf.dispatchFetch('http://fixture/stats')).json();
  assert.equal(after.transforms,generated.transforms,'warm read never transforms');
  assert.equal(after.puts.length,generated.puts.length,'warm read never writes');
  assert.equal(after.gets.length-generated.gets.length,1,'warm read fetches only the stored derivative');
  assert.ok(after.gets.at(-1).startsWith('media-variants/'));
  report.variants[variant]={width:metadata.width,height:metadata.height,bytes:bytes.length,reductionPercent:Number((100*(1-bytes.length/original.length)).toFixed(1)),firstLocalMs:Number(firstMs.toFixed(1)),warmLocalMs:Number(warmMs.toFixed(1))};
 }
 const untouched=await mf.dispatchFetch('http://fixture/original');
 assert.equal(untouched.headers.get('X-Representation'),'original');
 assert.deepEqual(Buffer.from(await untouched.arrayBuffer()),original,'original download remains byte-identical');
 assert.deepEqual(Buffer.from(await (await bucket.get('media/fictional-large-image')).arrayBuffer()),original,'stored original remains untouched');
 writeFileSync('.test-output/photo-variants-runtime.json',JSON.stringify(report,null,2)+'\n');
 console.log('PASS local Images/R2 runtime: '+JSON.stringify(report));
}finally{await mf.dispose()}
