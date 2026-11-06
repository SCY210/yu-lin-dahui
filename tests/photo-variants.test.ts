import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Photo} from '../lib/domain/types';
import {deletePhotoObjects,parsePhotoVariant,photoVariantKey,photoVariantKeys,photoVariantNames,photoVariantVersion,readPhotoRepresentation,type PhotoRepresentation} from '../lib/photo-variants';

const photo:Photo={id:'fictional-photo',key:'media/fictional-original',type:'image/png',size:1024*1024,kind:'avatar',created:1,eventId:null,matchId:null,playerIds:['fictional-player'],ownerId:'fictional-member',caption:''};
const stream=(bytes:Uint8Array)=>new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes);controller.close()}});
const body=async(value:PhotoRepresentation|null)=>{assert.ok(value);return new Uint8Array(await new Response(value.body).arrayBuffer())};
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done});return {promise,resolve}}
function fixture(){
 const original=new Uint8Array(photo.size).fill(31),encoded=new Uint8Array(2048).fill(87);
 const objects=new Map<string,Uint8Array>([[photo.key,original]]),gets:string[]=[],puts:{key:string;bytes:Uint8Array;options:unknown}[]=[],deletes:string[]=[],inputs:Uint8Array[]=[],transforms:ImageTransform[]=[],outputs:ImageOutputOptions[]=[];
 const control={transformError:false,putError:false,getErrorKey:'',encoded,contentType:'image/webp',gate:null as ReturnType<typeof deferred>|null,outputFactory:null as (()=>ReadableStream<Uint8Array>)|null};
 const bucket={
  async get(key:string){gets.push(key);if(key===control.getErrorKey)throw new Error('Storage unavailable');const bytes=objects.get(key);return bytes?{body:stream(bytes),size:bytes.byteLength}:null},
  async put(key:string,value:Uint8Array,options:unknown){if(control.putError)throw new Error('Storage write unavailable');const bytes=new Uint8Array(value);puts.push({key,bytes,options});objects.set(key,bytes);return {key}},
  async delete(value:string|string[]){for(const key of typeof value==='string'?[value]:value){deletes.push(key);objects.delete(key)}},
 } as unknown as Pick<R2Bucket,'get'|'put'|'delete'>;
 const images={input(source:ReadableStream<Uint8Array>){return {
  transform(options:ImageTransform){transforms.push(options);return this},
  async output(options:ImageOutputOptions){
   outputs.push(options);inputs.push(new Uint8Array(await new Response(source).arrayBuffer()));
   if(control.gate)await control.gate.promise;
   if(control.transformError)throw new Error('9422 transformation quota reached');
   return {contentType:()=>control.contentType,image:()=>control.outputFactory?.()??stream(control.encoded)};
  },
 }}} as unknown as Pick<ImagesBinding,'input'>;
 return {bucket,images,objects,gets,puts,deletes,inputs,transforms,outputs,control,original,encoded};
}

test('fixed variant names and immutable keys bound storage and deletion independently of deleted metadata',async()=>{
 assert.deepEqual(photoVariantNames,['avatar','preview']);
 for(const name of photoVariantNames)assert.equal(parsePhotoVariant(name),name);
 for(const input of [null,'','original','../../avatar','avatar&width=4000','Avatar','toString'])assert.equal(parsePhotoVariant(input),null);
 const keys=await photoVariantKeys(photo.key);
 assert.equal(keys.length,2);assert.equal(new Set(keys).size,2);
 for(const [index,name]of photoVariantNames.entries()){
  assert.equal(await photoVariantKey(photo.key,name),keys[index]);
  assert.match(keys[index],new RegExp('^media-variants/v1/[0-9a-f]{64}/'+name+'\\.webp$'));
  assert.equal(photoVariantVersion(name),'v1-'+name);
 }
 assert.notDeepEqual(await photoVariantKeys('media/replacement'),keys);
 assert.ok(keys.every(key=>!key.includes(photo.key)));
});

test('existing originals become smaller private variants once and cached reads need one R2 lookup',async()=>{
 for(const variant of photoVariantNames){
  const f=fixture();let checks=0;const isCurrent=async()=>{checks++;return true};
  const result=await readPhotoRepresentation({photo,variant,bucket:f.bucket,images:f.images,isCurrent});
  assert.ok(result);assert.equal(result.variant,variant);assert.equal(result.type,'image/webp');assert.equal(result.size,2048);
  assert.deepEqual(await body(result),f.encoded);assert.equal(result.size/photo.size,1/512,'synthetic transfer bytes drop without modifying the original');
  const key=await photoVariantKey(photo.key,variant);
  assert.deepEqual(f.gets,[key,photo.key]);assert.equal(f.puts.length,1);assert.equal(f.outputs.length,1);assert.equal(checks,2);
  assert.deepEqual(f.objects.get(photo.key),f.original);assert.deepEqual(f.inputs,[f.original]);
  const edge=variant==='avatar'?192:960;
  assert.deepEqual(f.transforms,[{width:edge,height:edge,fit:'scale-down'}]);
  assert.deepEqual(f.outputs,[{format:'image/webp',quality:82,anim:true}]);
  assert.deepEqual(f.puts[0].options,{httpMetadata:{contentType:'image/webp',cacheControl:'private, no-store'}});
  f.gets.length=0;
  // Persisted derivatives do not depend on the transform binding staying enabled.
  const cached=await readPhotoRepresentation({photo,variant,bucket:f.bucket});
  assert.deepEqual(await body(cached),f.encoded);assert.equal(cached?.variant,variant);
  assert.deepEqual(f.gets,[key]);assert.equal(f.outputs.length,1);assert.equal(checks,2);
 }
});

test('tiny originals bypass derivative reads and transformation across visits, including unchanged304 fallbacks',async()=>{
 for(const variant of photoVariantNames){
  const f=fixture(),bytes=new Uint8Array(16*1024).fill(71),small={...photo,size:bytes.byteLength};f.objects.set(photo.key,bytes);
  const args={photo:small,variant,bucket:f.bucket,images:f.images,isCurrent:async()=>{throw new Error('Tiny originals must not initiate generation')}};
  for(let i=0;i<3;i++){const result=await readPhotoRepresentation(args);assert.equal(result?.variant,null);assert.deepEqual(await body(result),bytes)}
  assert.deepEqual(f.gets,[photo.key,photo.key,photo.key]);assert.equal(f.outputs.length,0);assert.equal(f.puts.length,0);
  f.gets.length=0;
  const unchanged=await readPhotoRepresentation({...args,originalUnchanged:true});assert.equal(unchanged?.body,null);assert.equal(unchanged?.variant,null);assert.deepEqual(f.gets,[]);
 }
 const f=fixture(),bytes=new Uint8Array(16*1024+1);f.objects.set(photo.key,bytes);
 assert.equal((await readPhotoRepresentation({photo:{...photo,size:bytes.byteLength},variant:'avatar',bucket:f.bucket,images:f.images,isCurrent:async()=>true}))?.variant,'avatar');
 assert.equal(f.outputs.length,1,'larger originals remain eligible for their fixed-size derivative');
});

test('original requests and unavailable generation keep original bytes and representation identity',async()=>{
 for(const mode of ['original','missing-binding','missing-current-check','quota','put-failure','wrong-type','cache-failure'] as const){
  const f=fixture(),variant=mode==='original'?null:'avatar';
  if(mode==='quota')f.control.transformError=true;
  if(mode==='put-failure')f.control.putError=true;
  if(mode==='wrong-type')f.control.contentType='image/jpeg';
  if(mode==='cache-failure')f.control.getErrorKey=await photoVariantKey(photo.key,'avatar');
  const result=await readPhotoRepresentation({photo,variant,bucket:f.bucket,images:mode==='missing-binding'?undefined:f.images,isCurrent:mode==='missing-current-check'?undefined:async()=>true});
  assert.ok(result);assert.equal(result.variant,null,mode+' must never claim a derivative ETag');
  assert.equal(result.type,photo.type);assert.equal(result.size,photo.size);assert.deepEqual(await body(result),f.original);
  assert.equal(f.puts.length,0);
  if(mode==='original')assert.deepEqual(f.gets,[photo.key]);
 }
 const f=fixture();f.objects.clear();
 assert.equal(await readPhotoRepresentation({photo,variant:'avatar',bucket:f.bucket,images:f.images,isCurrent:async()=>true}),null);
 assert.equal(f.outputs.length,0);assert.equal(f.puts.length,0);
});

test('simultaneous authorized readers share generation but receive complete independent bodies',async()=>{
 const f=fixture();f.control.gate=deferred();let checks=0;
 const requests=Array.from({length:12},()=>readPhotoRepresentation({photo,variant:'avatar',bucket:f.bucket,images:f.images,isCurrent:async()=>{checks++;return true}}));
 // The generation deliberately waits, so every request reaches the same operation.
 for(let i=0;i<50&&f.outputs.length===0;i++)await new Promise(resolve=>setTimeout(resolve,1));
 assert.equal(f.outputs.length,1);f.control.gate.resolve();
 const results=await Promise.all(requests);
 assert.equal(f.outputs.length,1);assert.equal(f.gets.filter(key=>key===photo.key).length,1);assert.equal(f.puts.length,1);assert.equal(checks,2);
 for(const result of results)assert.deepEqual(await body(result),f.encoded);
});

test('failed transforms back off briefly and recover without retaining original bytes as a variant',async()=>{
 const f=fixture();f.control.transformError=true;let now=0;
 const args={photo,variant:'avatar' as const,bucket:f.bucket,images:f.images,isCurrent:async()=>true,now:()=>now};
 assert.equal((await readPhotoRepresentation(args))?.variant,null);
 assert.equal(f.puts.length,0);f.control.transformError=false;
 now=59_999;assert.equal((await readPhotoRepresentation(args))?.variant,null);assert.equal(f.outputs.length,1);
 now=60_000;
 assert.equal((await readPhotoRepresentation(args))?.variant,'avatar');
 assert.equal(f.outputs.length,2);assert.equal(f.puts.length,1);
});

test('authorized unchanged original fallbacks skip source reads but still discover available derivatives',async()=>{
 const f=fixture(),key=await photoVariantKey(photo.key,'avatar');
 const args={photo,variant:'avatar' as const,bucket:f.bucket,isCurrent:async()=>true,originalUnchanged:true,now:()=>0};
 const unavailable=await readPhotoRepresentation(args);
 assert.equal(unavailable?.body,null);assert.equal(unavailable?.variant,null);assert.equal(unavailable?.type,photo.type);assert.equal(unavailable?.size,photo.size);
 assert.deepEqual(f.gets,[key]);
 f.control.transformError=true;f.gets.length=0;
 const failed=await readPhotoRepresentation({...args,images:f.images});
 assert.equal(failed?.body,null);assert.deepEqual(f.gets,[key,photo.key],'the failed transform reads its source once but fallback304 never rereads it');
 f.gets.length=0;
 const cooldown=await readPhotoRepresentation({...args,images:f.images});assert.equal(cooldown?.body,null);assert.deepEqual(f.gets,[key]);assert.equal(f.outputs.length,1);
 f.objects.set(key,f.encoded);f.gets.length=0;
 const promoted=await readPhotoRepresentation({...args,images:f.images});assert.equal(promoted?.variant,'avatar');assert.deepEqual(await body(promoted),f.encoded);assert.deepEqual(f.gets,[key]);
});

test('oversized and empty transformation streams never enter R2 or acquire a variant identity',async()=>{
 for(const variant of photoVariantNames){
  const f=fixture();let cancelled=false;const cap=variant==='avatar'?256*1024:2*1024*1024;
  f.control.outputFactory=()=>new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(cap));controller.enqueue(new Uint8Array(1))},cancel(){cancelled=true}});
  const args={photo,variant,bucket:f.bucket,images:f.images,isCurrent:async()=>true};
  const result=await readPhotoRepresentation(args);assert.equal(result?.variant,null);assert.deepEqual(await body(result),f.original);
  assert.equal(cancelled,true);assert.equal(f.puts.length,0);
  f.control.outputFactory=()=>stream(new Uint8Array());
  assert.equal((await readPhotoRepresentation({...args,now:()=>Date.now()+60_001}))?.variant,null);assert.equal(f.puts.length,0);
 }
});

test('row deletion or replacement during generation prevents late persisted derivatives',async()=>{
 for(const phase of ['before','after'] as const){
  const f=fixture();let checks=0;
  const result=await readPhotoRepresentation({photo,variant:'avatar',bucket:f.bucket,images:f.images,isCurrent:async()=>{checks++;return phase==='after'&&checks===1}});
  assert.equal(result,null);assert.equal(f.puts.length,phase==='before'?0:1);
  assert.equal(f.deletes.length,phase==='before'?0:1);
  assert.equal(f.objects.has(await photoVariantKey(photo.key,'avatar')),false);
  assert.deepEqual(f.objects.get(photo.key),f.original);
 }
});

test('failed current-row checks fail closed and clean a completed derivative write',async()=>{
 for(const phase of ['before','after'] as const){
  const f=fixture();let checks=0;
  await assert.rejects(readPhotoRepresentation({photo,variant:'preview',bucket:f.bucket,images:f.images,isCurrent:async()=>{checks++;if(phase==='before'||checks===2)throw new Error('Current metadata unavailable');return true}}),/Current metadata unavailable/);
  assert.equal(f.puts.length,phase==='before'?0:1);assert.equal(f.deletes.length,phase==='before'?0:1);
  assert.equal(f.objects.has(await photoVariantKey(photo.key,'preview')),false);
 }
});

test('concurrent generation is capped across buckets and released on completion',async()=>{
 const gate=deferred(),fixtures=Array.from({length:5},()=>fixture());
 const start=(f:ReturnType<typeof fixture>)=>readPhotoRepresentation({photo,variant:'preview',bucket:f.bucket,images:f.images,isCurrent:async()=>true});
 for(const f of fixtures)f.control.gate=gate;
 const first=fixtures.slice(0,4).map(start);
 for(let i=0;i<50&&fixtures.slice(0,4).some(f=>!f.outputs.length);i++)await new Promise(resolve=>setTimeout(resolve,1));
 assert.equal(fixtures.slice(0,4).reduce((count,f)=>count+f.outputs.length,0),4);
 const overloaded=await start(fixtures[4]);assert.equal(overloaded?.variant,null);assert.equal(fixtures[4].outputs.length,0);
 gate.resolve();assert.ok((await Promise.all(first)).every(result=>result?.variant==='preview'));
 assert.equal((await start(fixtures[4]))?.variant,'preview');assert.equal(fixtures[4].outputs.length,1);
});

test('a larger encoding keeps the smaller original and avoids repeated transformation attempts',async()=>{
 const f=fixture(),small=new Uint8Array(20*1024).fill(12);f.objects.set(photo.key,small);f.control.encoded=new Uint8Array(24*1024);
 const args={photo:{...photo,size:small.byteLength},variant:'avatar' as const,bucket:f.bucket,images:f.images,isCurrent:async()=>true,now:()=>1};
 for(let i=0;i<3;i++){const result=await readPhotoRepresentation(args);assert.equal(result?.variant,null);assert.deepEqual(await body(result),small)}
 assert.equal(f.outputs.length,1);assert.equal(f.puts.length,0);
});

test('failure cooldown is bounded and never shares failure decisions between buckets',async()=>{
 const f=fixture();f.control.transformError=true;
 const small=new Uint8Array(32*1024),args={variant:'avatar' as const,bucket:f.bucket,images:f.images,isCurrent:async()=>true,now:()=>0};
 for(let i=0;i<129;i++){const key='media/failed-'+i;f.objects.set(key,small);await readPhotoRepresentation({...args,photo:{...photo,key,size:small.byteLength}})}
 assert.equal(f.outputs.length,129);
 await readPhotoRepresentation({...args,photo:{...photo,key:'media/failed-128',size:small.byteLength}});assert.equal(f.outputs.length,129,'a recent failure remains in cooldown');
 await readPhotoRepresentation({...args,photo:{...photo,key:'media/failed-0',size:small.byteLength}});assert.equal(f.outputs.length,130,'the oldest failure is evicted at the fixed capacity');
 const other=fixture();assert.equal((await readPhotoRepresentation({...args,photo,bucket:other.bucket,images:other.images}))?.variant,'avatar');
});

test('photo deletion removes the original and both immutable variants on every retry and propagates failures',async()=>{
 const f=fixture(),keys=await photoVariantKeys(photo.key);
 for(const key of keys)f.objects.set(key,f.encoded);
 await deletePhotoObjects(f.bucket,photo.key);assert.deepEqual(f.deletes,[photo.key,...keys]);assert.equal(f.objects.size,0);
 await deletePhotoObjects(f.bucket,photo.key);assert.deepEqual(f.deletes,[photo.key,...keys,photo.key,...keys]);
 const fail={async delete(){throw new Error('R2 deletion unavailable')}} as Pick<R2Bucket,'delete'>;
 await assert.rejects(deletePhotoObjects(fail,photo.key),/R2 deletion unavailable/);
});
