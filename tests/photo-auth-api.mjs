// Real cookie/session authentication and photo authorization against SQLite.
// Only the request context and Cloudflare binding are replaced with fixtures.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {sqliteD1} from './helpers/sqlite-d1.mjs';

mkdirSync('.test-output',{recursive:true});
const sqlite=sqliteD1(),now=1800000000000,realNow=Date.now;
const fixture=globalThis.__photoAuthTest={cookies:new Map(),headers:new Headers(),headerReads:0,queries:[],env:{}};
fixture.env.DB={prepare(query){fixture.queries.push(query);return sqlite.db.prepare(query)}};
const output='.test-output/photo-auth-api.mjs';
await build({stdin:{contents:"export {readAuthorizedPhoto} from './lib/photo-read';export {getAppUser,hashToken} from './lib/auth';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:output,plugins:[{name:'photo-auth-context',setup(builder){
 builder.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'photo-auth'}));
 builder.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'photo-auth'}));
 builder.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'photo-auth'}));
 builder.onLoad({filter:/.*/,namespace:'photo-auth'},({path})=>({loader:'js',contents:path==='env'
  ?'export const env=globalThis.__photoAuthTest.env;'
  :path==='headers'
   ?'export async function cookies(){return {get:key=>{const value=globalThis.__photoAuthTest.cookies.get(key);return value===undefined?undefined:{value}}}};export async function headers(){const t=globalThis.__photoAuthTest;t.headerReads++;return t.headers;}'
   :'export function redirect(){throw new Error("Unexpected redirect")}'}));
}}]});
const api=await import(pathToFileURL(resolve(output)).href);
const member={id:'member',role:'member',playerId:'member-player',email:'member@example.test'};
const admin={id:'admin',role:'admin',playerId:'admin-player',email:'admin@example.test'};
const avatar={id:'avatar',key:'media/avatar',kind:'avatar',eventId:null,created:1,type:'image/png',size:4};
const eventPhoto={...avatar,id:'event-photo',key:'media/event',kind:'photo',eventId:'event'};
const event={id:'event',creatorId:'creator',status:'open'};
const token='a'.repeat(43),otherToken='b'.repeat(43),sessionId=await api.hashToken(token),otherSessionId=await api.hashToken(otherToken);
const writeAccount=a=>sqlite.sql.prepare('INSERT OR REPLACE INTO accounts(id,email,role,player_id,payload) VALUES(?,?,?,?,?)').run(a.id,a.email,a.role,a.playerId,JSON.stringify(a));
const writeCredentials=a=>sqlite.sql.prepare('INSERT OR REPLACE INTO password_credentials(id,username,salt,hash,created) VALUES(?,?,?,?,?)').run(a.id,a.id,'fictional-salt','fictional-hash',1);
const writeSession=(id=sessionId,actor='member',expires=now+60000)=>sqlite.sql.prepare('INSERT OR REPLACE INTO auth_sessions(id,user_id,expires) VALUES(?,?,?)').run(id,actor,expires);
const writePhoto=p=>sqlite.sql.prepare('INSERT OR REPLACE INTO photos(id,payload) VALUES(?,?)').run(p.id,JSON.stringify(p));
const writeEvent=e=>sqlite.sql.prepare('INSERT OR REPLACE INTO events(id,payload) VALUES(?,?)').run(e.id,JSON.stringify(e));
const password=(value=token)=>{fixture.cookies=new Map([['yulin_session',value]]);fixture.headers=new Headers()};
const external=(id='member')=>{fixture.cookies=new Map();fixture.headers=new Headers({'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@example.test'})};
async function read(id='avatar',expectedQueries=1){
 const before=fixture.queries.length,result=await api.readAuthorizedPhoto(id);
 assert.equal(fixture.queries.length-before,expectedQueries,'one database round trip per authenticated photo check');
 return result;
}
async function expectStatus(status,id='avatar',expectedQueries=1){assert.equal((await read(id,expectedQueries)).status,status)}

try{
 Date.now=()=>now;
 for(const account of [member,admin]){writeAccount(account);writeCredentials(account)}
 writeSession();writeSession(otherSessionId,'admin');writePhoto(avatar);writePhoto(eventPhoto);writeEvent(event);
 password();
 assert.deepEqual(await read(),{status:200,account:member,photo:avatar});
 const passwordQuery=fixture.queries.at(-1),plan=sqlite.sql.prepare('EXPLAIN QUERY PLAN '+passwordQuery).all('avatar',sessionId,now);
 assert.ok(plan.every(row=>!row.detail.startsWith('SCAN ')),JSON.stringify(plan));
 assert.equal(plan.filter(row=>row.detail.includes('SEARCH ')).length,5,'session, credentials, account, photo and event use primary-key indexes');
 assert.equal(fixture.headerReads,0,'password authentication does not consult platform headers');
 // getAppUser retains its original representation for all non-photo callers.
 assert.deepEqual(await api.getAppUser(),{userId:'member',email:'',username:'member',displayName:'member',fullName:null,method:'password'});
 // Every repeat and every distinct avatar rechecks the current session once.
 for(let index=0;index<20;index++)await expectStatus(200);
 writeSession(sessionId,'member',now);await expectStatus(401);assert.equal(await api.getAppUser(),null);
 writeSession(sessionId,'member',now-1);await expectStatus(401);
 writeSession();sqlite.sql.prepare('DELETE FROM auth_sessions WHERE id=?').run(sessionId);await expectStatus(401);writeSession();
 sqlite.sql.prepare('DELETE FROM password_credentials WHERE id=?').run('member');await expectStatus(401);writeCredentials(member);
 writeEvent({...event,status:'draft'});await expectStatus(404,'event-photo');
 password(otherToken);await expectStatus(200,'event-photo');
 writeAccount({...admin,role:'member'});await expectStatus(404,'event-photo');writeAccount(admin);
 password();writeEvent({...event,status:'draft',creatorId:'member'});await expectStatus(200,'event-photo');
 writeEvent({...event,deletedAt:now});await expectStatus(404,'event-photo');
 sqlite.sql.prepare('DELETE FROM events WHERE id=?').run('event');await expectStatus(404,'event-photo');writeEvent(event);
 sqlite.sql.prepare('DELETE FROM photos WHERE id=?').run('avatar');await expectStatus(404);writePhoto(avatar);
 await expectStatus(404,"' OR 1=1; --");
 // A bad/expired password cookie cannot fall through to platform identity.
 for(const value of ['', 'invalid', 'a'.repeat(42), 'a'.repeat(44), '/'.repeat(43)]){
  external('admin');fixture.cookies.set('yulin_session',value);const headersBefore=fixture.headerReads;
  await expectStatus(401,'avatar',0);assert.equal(await api.getAppUser(),null);assert.equal(fixture.headerReads,headersBefore);
 }
 external('admin');fixture.cookies.set('yulin_session','z'.repeat(43));await expectStatus(401);
 external();assert.deepEqual(await read(),{status:200,account:member,photo:avatar});
 const externalQuery=fixture.queries.at(-1),externalPlan=sqlite.sql.prepare('EXPLAIN QUERY PLAN '+externalQuery).all('avatar','member');
 assert.ok(externalPlan.every(row=>!row.detail.startsWith('SCAN ')));assert.equal(externalPlan.filter(row=>row.detail.includes('SEARCH ')).length,3);
 assert.deepEqual(await api.getAppUser(),{userId:'member',email:'member@example.test',username:null,displayName:'member@example.test',fullName:null,method:'chatgpt'});
 external('outsider');await expectStatus(403);
 external();fixture.cookies.set('yulin_signed_out','1');const headersBefore=fixture.headerReads;
 await expectStatus(401,'avatar',0);assert.equal(await api.getAppUser(),null);assert.equal(fixture.headerReads,headersBefore);
 // A valid password cookie still wins over the signed-out platform marker.
 fixture.cookies.set('yulin_session',token);await expectStatus(200);
 fixture.cookies=new Map();fixture.headers=new Headers();await expectStatus(401,'avatar',0);
 external();sqlite.sql.prepare('DELETE FROM auth_sessions WHERE user_id=?').run('member');sqlite.sql.prepare('DELETE FROM password_credentials WHERE id=?').run('member');sqlite.sql.prepare('DELETE FROM accounts WHERE id=?').run('member');await expectStatus(403);
 writeAccount(member);writeCredentials(member);writeSession();password();
 sqlite.injectFailure(()=>true);await assert.rejects(()=>api.readAuthorizedPhoto('avatar'),/Injected database failure/);sqlite.injectFailure(null);
 await expectStatus(200);
 console.log('PASS photo authentication: one indexed D1 trip (formerly two), real cookie/hash/session checks, unchanged getAppUser identity, fresh expiration/revocation/credentials/membership/role/draft/deletion enforcement, platform identity and signed-out precedence, no stale fallback on database failure.');
}finally{Date.now=realNow;sqlite.close();delete globalThis.__photoAuthTest}
