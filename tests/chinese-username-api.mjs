// Actual account route and store on isolated transactional SQLite; fictional club only.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {sqliteD1} from './helpers/sqlite-d1.mjs';

mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__chineseUsernameTest={env:{},user:null};
writeFileSync('.test-output/chinese-username-entry.ts',`export {POST} from '../app/api/auth/route';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';export {makePassword} from '../lib/password';`);
await build({entryPoints:['.test-output/chinese-username-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/chinese-username-api.mjs',plugins:[{name:'isolated-username-auth',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'chinese-username'}));
 b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'chinese-username'}));
 b.onResolve({filter:/(?:^|\/)lib\/auth$|^\.\/auth$/},a=>a.importer.includes('node_modules')?undefined:({path:'auth',namespace:'chinese-username'}));
 b.onLoad({filter:/.*/,namespace:'chinese-username'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__chineseUsernameTest.env;'
  :a.path==='headers'?'export async function cookies(){return {get(){},set(){},delete(){}}}export async function headers(){return new Headers()}'
  :"export const sessionCookie='yulin_session';export async function hashToken(t){return t}export const getAppUser=async()=>globalThis.__chineseUsernameTest.user;export const passwordEnabled=async(id)=>!!(await globalThis.__chineseUsernameTest.env.DB.prepare('SELECT id FROM password_credentials WHERE id=?').bind(id).first());"}));
}}]});
const database=sqliteD1();fixture.env.DB=database.db;
const api=await import(pathToFileURL(resolve('.test-output/chinese-username-api.mjs')).href);
const origin='https://club.example',password='fictional-username-password-1';
let ip=10;
// Each request from its own fictional address, so the per-address limits never decide an assertion.
const post=(body,cookie='')=>api.POST(new Request(origin+'/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','cf-connecting-ip':'203.0.113.'+(ip++),...(cookie?{cookie}:{})},body:JSON.stringify(body)}));
const as=id=>{fixture.user=id?{userId:id,method:'password',displayName:'Fictional '+id}:null};
const login=async username=>(await post({action:'login',username,password})).status;
const stored=id=>database.db.prepare('SELECT username FROM password_credentials WHERE id=?').bind(id).first();
try{
 const empty=api.emptyState(),s=api.emptyState();
 Object.assign(s.settings,{initialized:true,ownerAccountId:'owner'});
 s.accounts=[{id:'owner',email:'',role:'admin',playerId:'p0'},{id:'legacy',email:'',role:'member',playerId:'p1'}];
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 await api.save(s,'seed',empty);
 // An owner login, and an older account stored in traditional form before this rule.
 for(const [id,username] of [['owner','fictionalowner'],['legacy','球會舊名']]){const c=api.makePassword(password);await database.db.prepare('INSERT INTO password_credentials(id,username,salt,hash,created) VALUES(?,?,?,?,?)').bind(id,username,c.salt,c.hash,Date.now()).run()}
 as('owner');
 const create=(username,extra={})=>post({action:'createAccount',name:'Fictional '+username,username,password,requestId:crypto.randomUUID(),...extra});
 const created=await create('羽林會A');assert.equal(created.status,200,await created.clone().text());
 const {accountId}=await created.json();assert.equal((await stored(accountId)).username,'羽林会a','stored under its key: simplified, lower case');
 as(null);
 for(const typed of ['羽林會A','羽林会a','羽林會a'])assert.equal(await login(typed),200,typed);
 assert.equal(await login('羽林会b'),401);
 as('owner');
 for(const taken of ['羽林会A','羽林會a']){const r=await create(taken);assert.equal(r.status,409,taken)}
 // The older traditional name: found as typed and by its simplified form, and not taken again in either form.
 as(null);assert.equal(await login('球會舊名'),200);assert.equal(await login('球会旧名'),200);
 as('owner');assert.equal((await create('球会旧名')).status,409,'an older name differing only in form is taken');
 assert.equal((await stored('legacy')).username,'球會舊名','older names are not rewritten');
 // Full-width letters and spaces stay refused.
 for(const bad of ['ＡＢＣ','羽林 会']){const r=await create(bad);assert.equal(r.status,400,bad)}
 // Renaming: a change only in simplified or traditional form is no change; another member's form is taken.
 // The owner renames with their own signed-in session.
 await database.db.prepare('INSERT INTO auth_sessions(id,user_id,expires) VALUES(?,?,?)').bind('fictional-owner-session','owner',Date.now()+3600000).run();
 const rename=newUsername=>post({action:'changeUsername',accountId,newUsername,currentPassword:password,requestId:crypto.randomUUID()},'yulin_session=fictional-owner-session');
 assert.equal((await rename('羽林会A')).status,400,'same as the current name');
 assert.equal((await rename('球會舊名')).status,409,'the older account’s name');
 const renamed=await rename('新羽林');assert.equal(renamed.status,200,await renamed.clone().text());assert.equal((await stored(accountId)).username,'新羽林');
 as(null);assert.equal(await login('新羽林'),200);
 console.log('PASS chinese username API: Chinese names stored simplified, either form logs in, older traditional names found and protected, full-width refused, rename rules');
}finally{database.close?.()}
