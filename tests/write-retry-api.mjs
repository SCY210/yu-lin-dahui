// Real API/store against isolated in-memory SQLite: a resent write never saves twice
// and never runs as a different account. No production data.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__writeRetryTest={env:{},user:null};
writeFileSync('.test-output/write-retry-entry.ts',`export {POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';`);
await build({entryPoints:['.test-output/write-retry-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/write-retry-api-bundle.mjs',plugins:[{name:'isolated-write-retry',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'write-retry-fixture'}));b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'write-retry-fixture'}));b.onLoad({filter:/.*/,namespace:'write-retry-fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__writeRetryTest.env;':'export const getAppUser=async()=>globalThis.__writeRetryTest.user;export const passwordEnabled=async()=>true;',loader:'js'}))}}]});
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function statement(query,parameters=[]){return {query,parameters,bind(...args){return statement(query,args)},async first(){return sql.prepare(query).get(...parameters)??null},async all(){return {results:sql.prepare(query).all(...parameters)}},async run(){const r=sql.prepare(query).run(...parameters);return {meta:{changes:Number(r.changes)},results:[]}}}}
fixture.env.DB={prepare:statement,async batch(list){sql.exec('BEGIN');try{const values=list.map(s=>/^SELECT/i.test(s.query.trim())?{results:sql.prepare(s.query).all(...s.parameters)}:{meta:{changes:Number(sql.prepare(s.query).run(...s.parameters).changes)},results:[]});sql.exec('COMMIT');return values}catch(e){sql.exec('ROLLBACK');throw e}}};
const api=await import(pathToFileURL(resolve('.test-output/write-retry-api-bundle.mjs')).href);
try{
 const initial=api.emptyState(),s=api.emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=['owner','memberA','memberB'].map((id,i)=>({id,email:'',role:i?'member':'admin',playerId:'p-'+id}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 await api.save(s,'seed',initial);
 const origin='https://club.example';
 const signIn=id=>fixture.user={userId:id,email:'',username:id,displayName:id,fullName:null,method:'password'};
 const post=body=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 const friends=async name=>(await api.load()).players.filter(p=>p.name===name);
 const commitKeys=()=>sql.prepare('SELECT key FROM commits').all().map(r=>r.key);

 // The same account resends after losing the response: one record only.
 signIn('memberA');
 const lost={action:'friend',payload:{name:'虚构代报球友甲'},requestId:crypto.randomUUID(),actor:'memberA'};
 let r=await post(lost);assert.equal(r.status,200);assert.equal((await r.json()).duplicate,undefined);
 r=await post(lost);assert.equal(r.status,200);assert.equal((await r.json()).duplicate,true);
 assert.deepEqual((await friends('虚构代报球友甲')).map(p=>p.ownerId),['memberA']);

 // The browser switches to B while the retry waits: nothing is saved as B.
 const switched={action:'friend',payload:{name:'虚构代报球友乙'},requestId:crypto.randomUUID(),actor:'memberA'};
 signIn('memberA');assert.equal((await post(switched)).status,200);
 signIn('memberB');r=await post(switched);assert.equal(r.status,409);
 const refused=await r.json();assert.equal(refused.actorMismatch,true);assert.match(refused.error,/登录账号已切换/);
 assert.deepEqual((await friends('虚构代报球友乙')).map(p=>p.ownerId),['memberA']);
 assert.ok(commitKeys().includes('memberA:'+switched.requestId));
 assert.ok(!commitKeys().includes('memberB:'+switched.requestId));

 // A stale page that still belongs to A cannot write as B, even on its first attempt or for other actions.
 const revision=(await api.load()).revision;
 r=await post({action:'profile',payload:{playerId:'p-memberB',name:'不应保存的名字'},requestId:crypto.randomUUID(),revision,actor:'memberA'});
 assert.equal(r.status,409);assert.equal((await api.load()).players.find(p=>p.id==='p-memberB').name,'memberB');
 assert.deepEqual(await friends('不应保存的名字'),[]);

 // B's own writes, and older pages that send no actor, keep working.
 r=await post({action:'friend',payload:{name:'虚构代报球友丙'},requestId:crypto.randomUUID(),actor:'memberB'});assert.equal(r.status,200);
 r=await post({action:'friend',payload:{name:'虚构代报球友丁'},requestId:crypto.randomUUID()});assert.equal(r.status,200);
 assert.deepEqual((await friends('虚构代报球友丙')).map(p=>p.ownerId),['memberB']);
 assert.deepEqual((await friends('虚构代报球友丁')).map(p=>p.ownerId),['memberB']);
 console.log('PASS write retries: lost responses saved once; account switches never write as the new account');
}finally{sql.close()}
