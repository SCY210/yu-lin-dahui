import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
mkdirSync('.test-output',{recursive:true});
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
let forceFailure=false;
function statement(sql,args=[]){return {sql,args,bind(...args){return statement(sql,args)},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}}}}}
globalThis.__trialDb={prepare:sql=>statement(sql),async batch(queries){sqlite.exec('BEGIN');try{const result=queries.map(q=>{if(forceFailure&&q.sql.startsWith('DELETE FROM accounts'))throw Error('injected failure');const query=sqlite.prepare(q.sql);return q.sql.startsWith('SELECT')?{results:query.all(...q.args)}:{results:[],meta:{changes:Number(query.run(...q.args).changes)}}});sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const base=process.cwd();
await build({entryPoints:['app/api/trial-cleanup/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/trial-cleanup-route.mjs',plugins:[{name:'isolated-trial-auth',setup(b){b.onResolve({filter:/cloudflare:workers/},()=>({path:'workers',namespace:'trial-test'}));b.onResolve({filter:/(auth|rate-limit)$/},args=>{const file=path.resolve(args.resolveDir,args.path)+'.ts';if(file===path.join(base,'lib/auth.ts'))return {path:'auth',namespace:'trial-test'};if(file===path.join(base,'lib/rate-limit.ts'))return {path:'limits',namespace:'trial-test'}});b.onLoad({filter:/.*/,namespace:'trial-test'},args=>({loader:'js',contents:args.path==='workers'?'export const env={get DB(){return globalThis.__trialDb}}':args.path==='auth'?'export async function getAppUser(){return globalThis.__trialUser}':'export const consumeRateLimit=async()=>{};export class RateLimitError extends Error{}'}))}}]});
const {GET,POST}=await import('../.test-output/trial-cleanup-route.mjs');
const targets=[['account:e29d64f3-868f-451e-8098-81c1cff46162','c93de032-a6b1-435d-9152-6368416c8ee6','试用球友01','trial01'],['account:0f36ebff-b6b3-4fba-924e-aa764ecd5dfa','4d0c1655-369e-4547-8efa-3c0b65e033ec','试用球友02','trial02'],['account:2012e6b1-6489-42a8-8499-c553e9c9059f','099e2b55-c020-4ca0-a616-08197476a578','试用球友03','trial03']];
const insert=(sql,args)=>sqlite.prepare(sql).run(...args),count=table=>sqlite.prepare('SELECT COUNT(*) AS n FROM '+table).get().n;
insert('INSERT INTO settings(id,payload) VALUES(?,?)',['club',JSON.stringify({name:'Fixture',initialized:true,ownerAccountId:'owner',inviteHash:'',rules:{win:3,loss:0,minimum:0,cap:12,target:21,ceiling:30,lead:2,k:32,algorithm:'doubles-elo-v1'}})]);
for(const [id,playerId,name,username] of [['owner','owner-player','正式群主',null],['admin','admin-player','正式管理员',null],...targets]){
 const account={id,playerId,email:'',role:id==='owner'||id==='admin'?'admin':'member'},player={id:playerId,ownerId:id,name,rating:1000,initialRating:1000,ratedGames:0,enabled:true,ratingReason:''};
 insert('INSERT INTO accounts(id,email,role,player_id,payload) VALUES(?,?,?,?,?)',[id,'',account.role,playerId,JSON.stringify(account)]);insert('INSERT INTO players(id,owner_id,payload) VALUES(?,?,?)',[playerId,id,JSON.stringify(player)]);
 if(username)insert('INSERT INTO password_credentials(id,username,salt,hash,created) VALUES(?,?,?,?,?)',[id,username,'a'.repeat(64),'b'.repeat(128),1]);
}
insert('INSERT INTO auth_sessions(id,user_id,expires) VALUES(?,?,?)',['trial-session',targets[0][0],Date.now()+100000]);
globalThis.__trialUser={userId:'owner'};
const revision=()=>Number(sqlite.prepare('SELECT COALESCE(MAX(revision),0) AS n FROM commits').get().n);
const post=(action,requestId=crypto.randomUUID(),revisionValue=revision(),origin='https://fixture.invalid')=>POST(new Request('https://fixture.invalid/api/trial-cleanup',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({action,requestId,revision:revisionValue})}));
assert.equal((await GET()).status,200);
globalThis.__trialUser={userId:'admin'};assert.equal((await GET()).status,403);assert.equal((await post('remove')).status,403);assert.equal(count('players'),5);
globalThis.__trialUser={userId:'owner'};assert.equal((await post('remove',crypto.randomUUID(),0,'https://other.invalid')).status,403);assert.equal((await post('remove',crypto.randomUUID(),99)).status,409);
forceFailure=true;assert.equal((await post('remove')).status,503);assert.equal(count('players'),5);assert.equal(count('password_credentials'),3);assert.equal(count('auth_sessions'),1);assert.equal(count('trial_credential_archive'),0);assert.equal(revision(),0);forceFailure=false;
const key=crypto.randomUUID();assert.equal((await post('remove',key)).status,200);assert.equal(count('accounts'),2);assert.equal(count('players'),2);assert.equal(count('password_credentials'),0);assert.equal(count('auth_sessions'),0);assert.equal(count('trial_credential_archive'),1);
assert.equal((await post('remove',key,0)).status,200);assert.equal(revision(),1);
const publicState=sqlite.prepare('SELECT payload FROM audits').all().map(r=>JSON.parse(r.payload));assert.ok(!JSON.stringify(publicState).includes('b'.repeat(128)));
// Reserved-name collision must not overwrite a newer login credential.
insert('INSERT INTO password_credentials(id,username,salt,hash,created) VALUES(?,?,?,?,?)',['admin','trial01','c'.repeat(64),'d'.repeat(128),1]);assert.equal((await post('restore')).status,409);assert.equal(count('accounts'),2);sqlite.prepare('DELETE FROM password_credentials WHERE id=?').run('admin');
assert.equal((await post('restore')).status,200);assert.equal(count('accounts'),5);assert.equal(count('players'),5);assert.equal(count('password_credentials'),3);assert.equal(count('trial_credential_archive'),0);assert.equal(count('auth_sessions'),0);
assert.equal(sqlite.prepare('SELECT hash FROM password_credentials WHERE id=?').get(targets[0][0]).hash,'b'.repeat(128));
console.log('PASS trial removal API: owner-only, CSRF, stale revision, real SQLite foreign keys, transactional rollback, private credential archive, session revocation, idempotence and safe restore/name conflict');
sqlite.close();delete globalThis.__trialDb;delete globalThis.__trialUser;
