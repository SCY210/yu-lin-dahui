// Actual photo GET + SQLite metadata, with fictional authentication and R2.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {sqliteD1} from './helpers/sqlite-d1.mjs';

mkdirSync('.test-output',{recursive:true});
const avatarBytes=new Uint8Array(20*1024);avatarBytes.set([137,80,78,71]);
const sqlite=sqliteD1(),objects=new Map([['media/avatar',avatarBytes],['media/event',new Uint8Array([255,216,255])]]);
const fixture=globalThis.__photoReadTest={actor:'member',authReads:0,queries:[],objectReads:0,env:{}};
fixture.env.DB={prepare(query){fixture.queries.push(query);return sqlite.db.prepare(query)}};
fixture.env.BUCKET={async get(key){fixture.objectReads++;if(key==='fail')throw new Error('fictional R2 outage');const body=objects.get(key);return body?{body:new Blob([body]).stream(),size:body.byteLength}:null}};
const output='.test-output/photo-read-api.mjs';
await build({stdin:{contents:`export {GET} from './app/api/photos/[id]/route'; export {secureResponse} from './lib/security-headers'; export {default as config} from './next.config';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:output,plugins:[{name:'isolated-photo-read',setup(builder){
 builder.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'photo-read'}));
 builder.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'photo-read'}));
 builder.onLoad({filter:/.*/,namespace:'photo-read'},({path})=>({loader:'js',contents:path==='env'?'export const env=globalThis.__photoReadTest.env;':'export const getAppUser=async()=>{const t=globalThis.__photoReadTest;return t.actor?{userId:t.actor}:null};export const getAppCredential=async()=>{const t=globalThis.__photoReadTest;t.authReads++;return t.actor?{method: "chatgpt",user:{userId:t.actor}}:null};'}));
}}]});
const api=await import(pathToFileURL(resolve(output)).href);
const {applyConfigHeadersToResponse}=await import(pathToFileURL(resolve('node_modules/vinext/dist/server/config-headers.js')).href);
const configHeaders=await api.config.headers();
const member={id:'member',role:'member',playerId:'player',email:''},admin={id:'admin',role:'admin',playerId:'admin-player',email:''};
const avatar={id:'avatar',key:'media/avatar',kind:'avatar',eventId:null,created:1,type:'image/png',size:avatarBytes.byteLength};
const eventPhoto={id:'event-photo',key:'media/event',kind:'photo',eventId:'event',created:2,type:'image/jpeg',size:3};
const event={id:'event',creatorId:'creator',status:'open'};
const writeAccount=a=>sqlite.sql.prepare('INSERT OR REPLACE INTO accounts(id,email,role,player_id,payload) VALUES(?,?,?,?,?)').run(a.id,a.email,a.role,a.playerId,JSON.stringify(a));
const writePhoto=p=>sqlite.sql.prepare('INSERT OR REPLACE INTO photos(id,payload) VALUES(?,?)').run(p.id,JSON.stringify(p));
const writeEvent=e=>sqlite.sql.prepare('INSERT OR REPLACE INTO events(id,payload) VALUES(?,?)').run(e.id,JSON.stringify(e));
async function read(id='avatar',validator,method='GET',variant){
 const request=new Request('https://club.example/api/photos/'+encodeURIComponent(id)+(variant?'?size='+variant:''),{method,headers:validator?{'If-None-Match':validator}:{}});
 const response=await api.GET(request,{params:Promise.resolve({id})});
 // Use the installed framework's actual header merge before the Worker wrapper.
 applyConfigHeadersToResponse(response.headers,{configHeaders,pathname:new URL(request.url).pathname});
 return api.secureResponse(response,request);
}
function cached(response){assert.equal(response.headers.get('Cache-Control'),'private, no-cache, must-revalidate');assert.equal(response.headers.get('Vary'),'Cookie');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.match(response.headers.get('ETag'),/^"photo-v1-[0-9a-f]{64}"$/)}
function denied(response,status){assert.equal(response.status,status);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('ETag'),null)}

try{
 writeAccount(member);writeAccount(admin);writePhoto(avatar);writePhoto(eventPhoto);writeEvent(event);
 const initial=await read();assert.equal(initial.status,200);cached(initial);assert.deepEqual(new Uint8Array(await initial.arrayBuffer()),objects.get(avatar.key));
 const token=initial.headers.get('ETag');assert.ok(!token.includes(avatar.key));assert.equal(fixture.authReads,1);assert.equal(fixture.queries.length,1);assert.equal(fixture.objectReads,1);
 const plan=sqlite.sql.prepare('EXPLAIN QUERY PLAN '+fixture.queries[0]).all('avatar','member');
 assert.ok(plan.every(row=>!row.detail.startsWith('SCAN ')));assert.equal(plan.filter(row=>row.detail.includes('SEARCH ')).length,3,'all account/photo/event accesses must use indexes');
 for(const validator of [token,'W/'+token,'"unrelated", W/'+token]){const response=await read('avatar',validator);assert.equal(response.status,304);cached(response);assert.equal(await response.text(),'')}
 assert.equal(fixture.authReads,4);assert.equal(fixture.queries.length,4);assert.equal(fixture.objectReads,1,'conditional hits must not read or download R2');
 for(const validator of ['"unknown"','*',token.slice(1),'W/'+token.toLowerCase().slice(0,-1),token+',broken','x'.repeat(4097)])assert.equal((await read('avatar',validator)).status,200);
 assert.equal(fixture.objectReads,7);
 // A second identity cannot reuse the first identity's validator, even if the
 // upstream authentication mechanism changes identity without changing Cookie.
 fixture.actor='admin';const other=await read('avatar',token);assert.equal(other.status,200);assert.notEqual(other.headers.get('ETag'),token);fixture.actor='member';
 let before=fixture.objectReads;fixture.actor=null;denied(await read('avatar',token),401);fixture.actor='outsider';denied(await read('avatar',token),403);fixture.actor='member';assert.equal(fixture.objectReads,before);
 // Existing image access is rechecked after every membership and visibility edit.
 sqlite.sql.prepare('DELETE FROM accounts WHERE id=?').run('member');denied(await read('avatar',token),403);writeAccount(member);
 const firstEvent=await read('event-photo');const eventToken=firstEvent.headers.get('ETag');assert.equal(firstEvent.status,200);assert.equal((await read('event-photo',eventToken)).status,304);
 writeEvent({...event,status:'draft'});before=fixture.objectReads;denied(await read('event-photo',eventToken),404);assert.equal(fixture.objectReads,before);
 fixture.actor='admin';const allowedDraft=await read('event-photo');assert.equal(allowedDraft.status,200);const adminToken=allowedDraft.headers.get('ETag');writeAccount({...admin,role:'member'});denied(await read('event-photo',adminToken),404);writeAccount(admin);
 fixture.actor='member';writeEvent({...event,status:'draft',creatorId:'member'});assert.equal((await read('event-photo',eventToken)).status,304);
 writeEvent({...event,deletedAt:1});denied(await read('event-photo',eventToken),404);sqlite.sql.prepare('DELETE FROM events WHERE id=?').run('event');denied(await read('event-photo',eventToken),404);writeEvent(event);
 sqlite.sql.prepare('DELETE FROM photos WHERE id=?').run('avatar');denied(await read('avatar',token),404);writePhoto(avatar);
 denied(await read("' OR 1=1; --",token),404);
 // An immutable content replacement changes the key and validator. Metadata
 // changes also prevent reuse; no unknown or missing object is cached.
 objects.set('media/replacement',new Uint8Array([1,2,3,4]));writePhoto({...avatar,key:'media/replacement'});
 const replacement=await read('avatar',token);assert.equal(replacement.status,200);assert.notEqual(replacement.headers.get('ETag'),token);assert.deepEqual(new Uint8Array(await replacement.arrayBuffer()),objects.get('media/replacement'));
 for(const change of [{created:2},{size:5},{type:'image/webp'}]){writePhoto({...avatar,...change});const response=await read('avatar',token);assert.equal(response.status,200);assert.notEqual(response.headers.get('ETag'),token)}
 writePhoto({...avatar,key:'missing'});denied(await read('avatar',token),404);writePhoto({...avatar,key:'fail'});denied(await read('avatar',token),503);writePhoto(avatar);
 sqlite.injectFailure(()=>true);denied(await read('avatar',token),503);sqlite.injectFailure(null);
 const head=await read('avatar',token,'HEAD');assert.equal(head.status,200);assert.equal(head.headers.get('Cache-Control'),'private, no-store');assert.equal(head.headers.get('ETag'),null);
 // Fixed representations use private R2 derivatives and cannot share validators
 // with originals or other sizes. Authorization still precedes every hit.
 let transforms=0;
 fixture.env.BUCKET.put=async(key,bytes)=>{objects.set(key,new Uint8Array(bytes))};
 fixture.env.BUCKET.delete=async key=>{for(const k of Array.isArray(key)?key:[key])objects.delete(k)};
 fixture.env.IMAGES={input(){return {transform(){return {async output(){transforms++;return {contentType:()=> 'image/webp',image:()=>new Blob([new Uint8Array([82,73])]).stream()}}}}}}};
 const thumbnail=await read('avatar',undefined,'GET','avatar');
 assert.equal(thumbnail.status,200);assert.equal(thumbnail.headers.get('Content-Type'),'image/webp');cached(thumbnail);
 const smallTag=thumbnail.headers.get('ETag');assert.notEqual(smallTag,token);assert.equal((await thumbnail.arrayBuffer()).byteLength,2);assert.equal(transforms,1);
 assert.deepEqual(objects.get(avatar.key),avatarBytes,'original upload bytes remain unchanged');
 before=fixture.objectReads;
 assert.equal((await read('avatar',smallTag,'GET','avatar')).status,304);assert.equal(fixture.objectReads,before,'variant304 skips R2');
 assert.equal((await read('avatar',token,'GET','avatar')).status,200);assert.equal(fixture.objectReads,before+1,'cached thumbnail reads one R2 object');assert.equal(transforms,1);
 const preview=await read('avatar',smallTag,'GET','preview');assert.equal(preview.status,200);assert.notEqual(preview.headers.get('ETag'),smallTag);assert.equal(transforms,2);
 assert.equal((await read('avatar',smallTag)).status,200,'original link never serves a thumbnail validator');
 before=fixture.objectReads;fixture.actor=null;denied(await read('avatar',smallTag,'GET','avatar'),401);fixture.actor='outsider';denied(await read('avatar',smallTag,'GET','avatar'),403);fixture.actor='member';assert.equal(fixture.objectReads,before);
 sqlite.sql.prepare('DELETE FROM photos WHERE id=?').run('avatar');denied(await read('avatar',smallTag,'GET','avatar'),404);writePhoto(avatar);
 fixture.env.IMAGES=undefined;
 assert.equal((await read('avatar',undefined,'GET','avatar')).headers.get('ETag'),smallTag,'persisted derivative survives missing binding');
 const fallback=await read('event-photo',undefined,'GET','preview');assert.equal(fallback.status,200);assert.equal(fallback.headers.get('Content-Type'),'image/jpeg');
 before=fixture.objectReads;assert.equal((await read('event-photo',fallback.headers.get('ETag'),'GET','preview')).status,304,'unchanged fallback need not transfer original again');assert.equal(fixture.objectReads,before,'small fallback revalidation skips all R2 reads');
 assert.equal((await read('avatar',token,'GET','arbitrary')).status,304,'unknown transforms use the original');
 console.log('PASS photo reads: indexed account/photo/event lookup; unchanged authorized browser images skip R2; bytes preserved; weak/list validators; fresh identity/membership/draft/deletion checks; immutable replacements; safe errors; real Vinext and Worker headers.');
}finally{sqlite.close();delete globalThis.__photoReadTest}
