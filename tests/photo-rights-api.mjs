// Exercise the real upload handler with fictional storage/auth only.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

mkdirSync('.test-output',{recursive:true});
const output='.test-output/photo-rights-route.mjs';
const modules={
 auth:'export const getAppUser=async()=>({userId:"member"});',
 store:'export const load=async()=>structuredClone(globalThis.__photoRightsTest.state); export const committed=async()=>false; export const save=async(s)=>{const t=globalThis.__photoRightsTest;t.saved++;t.state=s};',
 rates:'export const cleanExpiredRateLimits=async()=>{};export const consumeRateLimit=async()=>{};export const reserveUploadBytes=async()=>{globalThis.__photoRightsTest.reserved++};export const trustedClientIP=()=>"unavailable";export class RateLimitError extends Error {}',
 cloudflare:'export const env={get BUCKET(){return globalThis.__photoRightsTest.bucket}};',
};
await build({entryPoints:['app/api/photos/route.ts'],bundle:true,platform:'node',format:'esm',outfile:output,plugins:[{
 name:'fictional-photo-rights',setup(builder){
  builder.onResolve({filter:/cloudflare:workers|(?:^|\/)(?:auth|store|rate-limit)$/},args=>({path:args.path==='cloudflare:workers'?'cloudflare':args.path.endsWith('rate-limit')?'rates':args.path.split('/').at(-1),namespace:'rights-test'}));
  builder.onLoad({filter:/.*/,namespace:'rights-test'},args=>({contents:modules[args.path],loader:'js'}));
 },
}]});
const {POST}=await import(pathToFileURL(resolve(output)).href);
const origin='https://example.invalid';
const fixture=globalThis.__photoRightsTest={saved:0,reserved:0,writes:0,state:{revision:1,settings:{ownerAccountId:'owner'},accounts:[{id:'member',role:'member',playerId:'player'}],players:[{id:'player',ownerId:'member'}],events:[{id:'event',status:'open',creatorId:'member'}],matches:[],attendance:[],photos:[],audits:[]},bucket:{async put(){fixture.writes++},async delete(){}}};
function upload(kind,values){
 const form=new FormData();form.set('file',new Blob([readFileSync('tests/fixtures/shuttlecock.png')],{type:'image/png'}),'fictional.png');
 form.set('kind',kind);form.set('playerId','player');form.set('eventId','event');form.set('revision',String(fixture.state.revision));form.set('requestId',crypto.randomUUID());
 for(const value of values)form.append('rightsConfirmed',value);
 return POST(new Request(origin+'/api/photos',{method:'POST',headers:{Origin:origin},body:form}));
}
try{
 for(const kind of ['avatar','racket','photo']){
  for(const values of [[],['false'],['true','false']]){
   const before=structuredClone(fixture.state),writes=fixture.writes,reserved=fixture.reserved,saved=fixture.saved;
   const response=await upload(kind,values);assert.equal(response.status,400);assert.equal(response.headers.get('Cache-Control'),'no-store');
   assert.deepEqual(fixture.state,before);assert.equal(fixture.writes,writes);assert.equal(fixture.reserved,reserved);assert.equal(fixture.saved,saved);
  }
  const allowed=await upload(kind,['true']);assert.equal(allowed.status,200);
  const audit=fixture.state.audits.at(-1);assert.equal(audit.changes.rightsConfirmed,true);assert.equal(audit.changes.rightsVersion,'2026-10-05');
 }
 assert.equal(fixture.writes,3);assert.equal(fixture.saved,3);
 console.log('PASS real photo handler: missing/unchecked/duplicate rights rejected before quota/storage for all image kinds; explicit confirmation saved with versioned audit');
}finally{delete globalThis.__photoRightsTest}
