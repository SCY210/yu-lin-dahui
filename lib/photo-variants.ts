import type {Photo} from './domain/types';

export type PhotoVariant='avatar'|'preview';
export const photoVariantNames:readonly PhotoVariant[]=['avatar','preview'];
const specifications={avatar:{edge:192,maxBytes:256*1024},preview:{edge:960,maxBytes:2*1024*1024}} as const;
// Tiny originals transfer cheaply; bypass conversion across visits and cold isolates,
// instead of spending an R2 miss and an encoder call to save at most 16 KiB.
const originalOnlyMaxBytes=16*1024;
const variantVersion='v1';
const maxGenerations=4;
const retryDelay=60_000,maxFailures=128;
type PhotoBucket=Pick<R2Bucket,'get'|'put'|'delete'>;
type PhotoImages=Pick<ImagesBinding,'input'>;
export type PhotoRepresentation={body:BodyInit|null;type:string;size:number;variant:PhotoVariant|null};
type Generation={kind:'ready';bytes:Uint8Array<ArrayBuffer>}|{kind:'fallback'}|{kind:'gone'};
const pending=new WeakMap<PhotoBucket,Map<string,Promise<Generation>>>();
const failed=new WeakMap<PhotoBucket,Map<string,number>>();
let activeGenerations=0;

/** Only these two variants can spend transformation/storage resources. */
export function parsePhotoVariant(value:string|null):PhotoVariant|null{return value==='avatar'||value==='preview'?value:null}
/** Include this token in the authorized browser validator, never the fallback's validator. */
export function photoVariantVersion(variant:PhotoVariant){return variantVersion+'-'+variant}

async function originalKeyHash(key:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function variantKey(hash:string,variant:PhotoVariant){return 'media-variants/'+variantVersion+'/'+hash+'/'+variant+'.webp'}
export async function photoVariantKey(storageKey:string,variant:PhotoVariant){return variantKey(await originalKeyHash(storageKey),variant)}
/** Deletion retries retain only the immutable original key, so no database row is needed. */
export async function photoVariantKeys(storageKey:string){const hash=await originalKeyHash(storageKey);return photoVariantNames.map(variant=>variantKey(hash,variant))}
/** R2 deletion is idempotent; retries include both fixed derivatives even after the row is gone. */
export async function deletePhotoObjects(bucket:Pick<R2Bucket,'delete'>,storageKey:string){await bucket.delete([storageKey,...await photoVariantKeys(storageKey)])}

async function boundedBytes(stream:ReadableStream<Uint8Array>,limit:number){
 // A fixed buffer bounds encoding output even when Content-Length is absent or wrong.
 // R2 requires a known-length body; this bounded buffer also lets concurrent callers
 // receive independent response bodies without teeing an unconsumed original stream.
 const reader=stream.getReader(),buffer=new Uint8Array(limit);let length=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   if(value.byteLength>limit-length){await reader.cancel('Photo variant exceeds its byte limit');throw new Error('Photo variant exceeds its byte limit')}
   buffer.set(value,length);length+=value.byteLength;
  }
  if(!length)throw new Error('Empty photo variant');
  return buffer.slice(0,length);
 }finally{reader.releaseLock()}
}

async function generate(bucket:PhotoBucket,images:PhotoImages,photo:Photo,variant:PhotoVariant,key:string,isCurrent:()=>Promise<boolean>):Promise<Generation>{
 let bytes:Uint8Array<ArrayBuffer>;
 let source:ReadableStream<Uint8Array>|undefined;
 try{
  const original=await bucket.get(photo.key);if(!original)return {kind:'gone'};
  source=original.body;
  const spec=specifications[variant];
  const transformed=await images.input(source).transform({width:spec.edge,height:spec.edge,fit:'scale-down'})
   .output({format:'image/webp',quality:82,anim:true});
  if(transformed.contentType()!=='image/webp'){await transformed.image().cancel();return {kind:'fallback'}}
  bytes=await boundedBytes(transformed.image(),spec.maxBytes);
  if(bytes.byteLength>=original.size)return {kind:'fallback'};
 }catch{await source?.cancel().catch(()=>{});return {kind:'fallback'}}
 // Generation may outlive photo deletion or replacement. Never recreate its
 // private derived object after the authoritative database row has disappeared.
 if(!await isCurrent())return {kind:'gone'};
 try{await bucket.put(key,bytes,{httpMetadata:{contentType:'image/webp',cacheControl:'private, no-store'}})}catch{return {kind:'fallback'}}
 try{
  if(await isCurrent())return {kind:'ready',bytes};
 }catch(error){
  await bucket.delete(key).catch(()=>{});throw error;
 }
 await bucket.delete(key);
 return {kind:'gone'};
}

/** Call only after fresh authentication, membership and photo visibility checks.
 * The route can answer an authorized variant-specific 304 before calling this.
 * Originals and fallbacks stream unchanged and must use the original ETag.
 * `isCurrent` is required to create derivatives; it checks the photo row still
 * references this immutable key, without caching viewer-specific permissions.
 */
export async function readPhotoRepresentation({photo,variant,bucket,images,isCurrent,originalUnchanged=false,now=Date.now}:{
 photo:Photo;variant:PhotoVariant|null;bucket:PhotoBucket;images?:PhotoImages;isCurrent?:()=>Promise<boolean>;originalUnchanged?:boolean;now?:()=>number;
}):Promise<PhotoRepresentation|null>{
 const original=async()=>{
  // The caller already validated this original's ETag after fresh authorization.
  // Still check for an available derivative before choosing a body-free fallback.
  if(originalUnchanged)return {body:null,type:photo.type,size:photo.size,variant:null};
  const object=await bucket.get(photo.key);return object?{body:object.body,type:photo.type,size:object.size,variant:null}:null;
 };
 if(!variant||photo.size<=originalOnlyMaxBytes)return original();
 const key=await photoVariantKey(photo.key,variant);
 try{
  const cached=await bucket.get(key);
  if(cached)return {body:cached.body,type:'image/webp',size:cached.size,variant};
 }catch{return original()}
 // A missing binding can still serve already-generated private derivatives.
 if(!images||!isCurrent)return original();
 const failures=failed.get(bucket),retryAfter=failures?.get(key);
 if(retryAfter!==undefined){if(now()<retryAfter)return original();failures!.delete(key)}
 let bucketPending=pending.get(bucket);if(!bucketPending){bucketPending=new Map();pending.set(bucket,bucketPending)}
 let operation=bucketPending.get(key);
 if(!operation){
  if(activeGenerations>=maxGenerations)return original();
  activeGenerations++;
  operation=generate(bucket,images,photo,variant,key,isCurrent);
  bucketPending.set(key,operation);
 }
 let result:Generation;
 try{result=await operation}finally{
  if(bucketPending.get(key)===operation){bucketPending.delete(key);activeGenerations--}
 }
 if(result.kind==='gone')return null;
 if(result.kind==='fallback'){
  // Remember only transformation/storage failure, never permission decisions or
  // private bytes. A quota outage or larger encoding must not repeat on every view.
  let failures=failed.get(bucket);if(!failures){failures=new Map();failed.set(bucket,failures)}
  failures.delete(key);failures.set(key,now()+retryDelay);
  while(failures.size>maxFailures)failures.delete(failures.keys().next().value!);
 }
 return result.kind==='ready'?{body:result.bytes,type:'image/webp',size:result.bytes.byteLength,variant}:original();
}
