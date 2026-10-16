import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__activityApi={user:null,state:null,loads:0,metadata:0};
const modules={
 auth:'export const getAppUser=async()=>globalThis.__activityApi.user;',
 store:`export const raw=()=>({prepare:()=>({bind(){return this},async all(){return {results:[]}},async first(){return null}})});
  export const clubReadVersion=async()=>{const t=globalThis.__activityApi;t.metadata++;const s=t.state;return {revision:s.revision,settings:s.settings,account:s.accounts.find(a=>a.id===t.user.userId)??null}};
  export const load=async()=>structuredClone(globalThis.__activityApi.state);export const save=async()=>{};export const committed=async()=>false;`,
 maintenance:'export const loadClubState=async()=>{const t=globalThis.__activityApi;t.loads++;return structuredClone(t.state)};',
};
await build({stdin:{contents:`export {GET} from './app/api/club/route';export {createSimulation} from './tests/helpers/scheduling-fixture';export {apply} from './lib/domain/commands';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-output/club-activity-api.mjs',plugins:[{name:'isolated-activity',setup(b){
 b.onResolve({filter:/(?:^|\/)(auth|store|club-maintenance)$/},a=>({path:a.path.endsWith('club-maintenance')?'maintenance':a.path.split('/').at(-1),namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:modules[a.path],loader:'js'}));
}}]});
const {GET,createSimulation,apply}=await import(pathToFileURL(resolve('.test-output/club-activity-api.mjs')).href);
const realNow=Date.now;let now=Date.parse('2026-10-15T18:00:00Z');Date.now=()=>now;
const user=a=>({userId:a.id,email:'',username:a.id,displayName:a.id,method:'password'});
const read=(activity,token)=>GET(new Request('https://example.invalid/api/club?month=2026-10&year=2026'+(activity===undefined?'':'&activity='+encodeURIComponent(activity)),{headers:token?{'If-None-Match':token}:{}}));
try{
 const s=createSimulation(now).state,a=s.accounts[0],e=s.events[0];fixture.state=s;fixture.user=user(a);
 await apply(s,a,'liveStart',{eventId:e.id},now);s.revision=20;
 const template=s.matches[0];s.events.push({...e,id:'past',status:'ended',start:now-86400000,end:now-80000000},{...e,id:'private',status:'draft',creatorId:'other'});
 for(let i=0;i<200;i++)s.matches.push({...template,id:'past-'+i,eventId:'past',status:'complete',start:now-86000000,end:now-85000000,scoreA:21,scoreB:15,games:[{a:21,b:15}],enteredBy:a.id});
 s.matches.push({...template,id:'secret',eventId:'private'});
 for(let i=0;i<600;i++)s.audits.push({id:'audit-'+i,at:now-1,actor:a.id,action:'fixture',reason:'Fictional historical row '.repeat(20)});
 const full=await read(),fullToken=full.headers.get('ETag'),fullText=await full.text();assert.equal(full.status,200);
 const fullData=JSON.parse(fullText);assert.deepEqual(fullData.audits,s.audits.slice(-50),'ordinary reads retain exactly the 50 rows rendered by management');assert.deepEqual(fullData.ratingHistory,[],'unused per-game replay is absent from ordinary reads');
 const exported=await GET(new Request('https://example.invalid/api/club?export=1'));
 assert.equal(exported.status,200);assert.equal((await exported.json()).audits.length,s.audits.length,'authorized exports retain the entire history');
 const scoped=await read(e.id,fullToken),scopedText=await scoped.text(),part=JSON.parse(scopedText);assert.equal(scoped.status,200);assert.equal(part.activityScope,e.id);
 assert.ok(scopedText.length<fullText.length*.4);assert.deepEqual(part.audits,[]);assert.ok(part.matches.every(m=>m.eventId===e.id||m.status==='playing'));
 let token=scoped.headers.get('ETag');const loads=fixture.loads;now+=3000;assert.equal((await read(e.id,token)).status,304);assert.equal(fixture.loads,loads);
 assert.equal((await read(undefined,token)).status,200,'a scoped validator never returns a false 304 to the full screen');
 await apply(s,a,'score',{matchId:template.id,a:21,b:17},now);s.revision++;
 let response=await read(e.id,token),data=await response.json();assert.equal(response.status,200);assert.equal(data.matches.find(m=>m.id===template.id).scoreA,21);assert.equal(data.revision,s.revision);
 token=response.headers.get('ETag');const playing=s.matches.find(m=>m.eventId===e.id&&m.status==='playing');
 await apply(s,a,'liveLineup',{matchId:playing.id,expectedA:[...playing.a],expectedB:[...playing.b],a:[...playing.b],b:[...playing.a]},now);s.revision++;
 response=await read(e.id,token);data=await response.json();assert.equal(response.status,200);assert.deepEqual(data.matches.find(m=>m.id===playing.id).a,s.matches.find(m=>m.id===playing.id).a);
 const adminToken=response.headers.get('ETag');fixture.user=user(s.accounts[1]);response=await read(e.id,adminToken);data=await response.json();assert.equal(response.status,200);assert.equal(data.me.role,'member');assert.ok(!data.matches.some(m=>m.id==='secret'));
 response=await read('private');data=await response.json();assert.equal(data.activityScope,undefined);assert.ok(!data.events.some(event=>event.id==='private'));
 const memberToken=response.headers.get('ETag');fixture.user=null;assert.equal((await read('private',memberToken)).status,401);fixture.user={...user(a),userId:'removed'};assert.equal((await read(e.id,memberToken)).status,403);
 fixture.user=user(a);s.events[0].deletedAt=now;s.events[0].mergedInto='past';s.revision++;response=await read(e.id,adminToken);data=await response.json();assert.equal(data.activityScope,undefined);assert.equal(data.mergedEventTargets[e.id],'past');assert.ok(!data.events.some(event=>event.id===e.id));
 assert.equal((await read('')).status,400);assert.equal((await read('x'.repeat(201))).status,400);
 const receipt={fullBytes:Buffer.byteLength(fullText),activityBytes:Buffer.byteLength(scopedText),reduction:1-Buffer.byteLength(scopedText)/Buffer.byteLength(fullText),note:'Synthetic authenticated GET handler, historical rows and live score/lineup changes; no production traffic.'};
 writeFileSync('.test-output/club-activity-response.json',JSON.stringify(receipt,null,2)+'\n');
 console.log('PASS activity API: scoped validators, quiet 304, next-poll score/lineup updates, current permissions, private/deleted/merged recovery, 401/403 and malformed scopes.');console.log(JSON.stringify(receipt));
}finally{Date.now=realNow;delete globalThis.__activityApi}
