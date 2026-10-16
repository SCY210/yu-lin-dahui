// Isolated SQLite/D1 + real WebCrypto; never contacts a push vendor or real players.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
mkdirSync('.test-output',{recursive:true});
globalThis.__feeSweepTest={env:{}};
const fixture=globalThis.__feeSweepTest;
writeFileSync('.test-output/fee-sweep-entry.ts',"export {runFeeReminderSweep} from '../lib/fee-reminder-sweep';export {feeReminderSweepKey} from '../lib/fee-reminders';export {flushPushOutbox} from '../lib/push-outbox';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';");
await build({entryPoints:['.test-output/fee-sweep-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/fee-sweep-bundle.mjs',plugins:[{name:'isolated-fee-sweep',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fee-fixture'}));b.onLoad({filter:/.*/,namespace:'fee-fixture'},()=>({contents:'export const env=globalThis.__feeSweepTest.env;',loader:'js'}))}}]});
const api=await import(pathToFileURL(resolve('.test-output/fee-sweep-bundle.mjs')).href);
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+name,'utf8'));
function statement(query,parameters=[]){return {query,parameters,bind(...args){return statement(query,args)},async first(){return sql.prepare(query).get(...parameters)??null},async all(){return {results:sql.prepare(query).all(...parameters)}},async run(){const r=sql.prepare(query).run(...parameters);return {meta:{changes:Number(r.changes)},results:[]}}}}
const db={prepare:statement,async batch(list){sql.exec('BEGIN');try{const values=[];for(const s of list)values.push(/^SELECT/i.test(s.query.trim())?await s.all():await s.run());sql.exec('COMMIT');return values}catch(e){sql.exec('ROLLBACK');throw e}}};
fixture.env.DB=db;
const encode=bytes=>Buffer.from(bytes).toString('base64url');
const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
fixture.env.PUSH_VAPID_PUBLIC_KEY=encode(await crypto.subtle.exportKey('raw',vapid.publicKey));fixture.env.PUSH_VAPID_PRIVATE_KEY=(await crypto.subtle.exportKey('jwk',vapid.privateKey)).d;fixture.env.PUSH_VAPID_SUBJECT='https://club.example';
const receiver=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),clientPublic=new Uint8Array(await crypto.subtle.exportKey('raw',receiver.publicKey)),auth=crypto.getRandomValues(new Uint8Array(16));
const captures=[],originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{captures.push(String(url));return new Response(null,{status:201})};
const hour=3600000,day=24*hour,confirmed=Date.parse('2026-10-20T08:00:00Z');
try{
 const s=api.emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=[['owner','admin','p0'],['admin','admin','p9'],['alice','member','p1'],['bob','member','p2']].map(([id,role,playerId])=>({id,email:'',role,playerId}));
 s.players=[...s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})),{id:'friend',name:'小明',ownerId:'alice',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}];
 s.events=[{id:'e',creatorId:'owner',title:'周四双打',start:confirmed-4*hour,end:confirmed-2*hour,venue:'球馆',address:'',capacity:8,signupDeadline:confirmed-5*hour,cancelDeadline:confirmed-5*hour,note:'',status:'ended',courtMode:'equal',ballMode:'equal'}];
 s.settlements=[{id:'v1',eventId:'e',version:1,created:confirmed,reason:'确认',confirmed:true,total:2400,subsidy:0,unallocated:0,bills:['p0','p1','p2','friend'].map(playerId=>({playerId,court:600,ball:0,other:0,total:600,minutes:120})),detail:[]}];
 s.payments=[{id:'pay-owner',eventId:'e',playerId:'p0',cents:600,method:'self',at:confirmed+hour,reason:'',actor:'owner'}];
 await api.save(s,'seed',api.emptyState());
 for(const account of ['alice','bob','admin'])sql.prepare('INSERT INTO push_subscriptions(id,account_id,payload,created_at) VALUES(?,?,?,?)').run('sub-'+account,account,JSON.stringify({endpoint:'https://fcm.googleapis.com/fcm/send/'+account,expirationTime:null,keys:{p256dh:encode(clientPublic),auth:encode(auth)}}),confirmed);
 const inbox=()=>sql.prepare("SELECT account_id AS account,json_extract(payload,'$.id') AS id FROM reminder_inbox ORDER BY account_id,created_at").all().map(r=>r.account+' '+r.id.split(':')[0]);
 const run=async at=>{const original=Date.now;Date.now=()=>at;try{const result=await api.runFeeReminderSweep({db,now:at});await api.flushPushOutbox(fixture.env);return result}finally{Date.now=original}};

 assert.deepEqual(await run(confirmed+23*hour),{sent:0});assert.deepEqual(inbox(),[]);
 assert.equal((await run(Date.parse('2026-10-21T01:00:00Z'))).sent,0,'03:00 in Madrid: no reminders at night');
 assert.equal((await run(confirmed+day)).sent,2);assert.deepEqual(inbox(),['alice fees-due','bob fees-due'],'the owner paid');
 assert.deepEqual(captures.sort(),['https://fcm.googleapis.com/fcm/send/alice','https://fcm.googleapis.com/fcm/send/bob'],'both devices receive a push');
 const stored=JSON.parse(sql.prepare('SELECT payload FROM settings WHERE id=?').get(api.feeReminderSweepKey).payload);assert.deepEqual(stored.progress,{v1:{sent:1}});
 assert.deepEqual(await run(confirmed+day+hour),{sent:0},'the next tick sends nothing');assert.equal(inbox().length,2);
 // Bob pays: only Alice (and her friend) are reminded on the second and third days.
 const paid=await api.load(),next=structuredClone(paid);next.payments.push({id:'pay-bob',eventId:'e',playerId:'p2',cents:600,method:'self',at:confirmed+30*hour,reason:'',actor:'bob'});await api.save(next,'bob-paid',paid);
 captures.length=0;assert.equal((await run(confirmed+2*day)).sent,1);assert.equal((await run(confirmed+3*day)).sent,1);
 assert.deepEqual(captures,['https://fcm.googleapis.com/fcm/send/alice','https://fcm.googleapis.com/fcm/send/alice']);
 // After the third reminder, the owner and administrators are told once; an administrator without a bill still gets the push.
 captures.length=0;assert.equal((await run(confirmed+4*day)).sent,1);
 assert.deepEqual(inbox().filter(r=>r.endsWith('fees-overdue')).sort(),['admin fees-overdue','owner fees-overdue']);
 assert.deepEqual(captures,['https://fcm.googleapis.com/fcm/send/admin']);
 const overdue=JSON.parse(sql.prepare("SELECT payload FROM reminder_inbox WHERE account_id='admin'").get().payload);assert.match(overdue.body,/仍有 2 人未标记付款：alice、小明/);
 assert.deepEqual(await run(confirmed+5*day),{sent:0});assert.equal(inbox().length,2+2+2);
 console.log('PASS fee reminder sweep API: 24/48/72-hour reminders with quiet hours, paid players skipped, proxy friends covered, idempotent ticks, real push delivery and a single owner/administrator escalation');
}finally{globalThis.fetch=originalFetch;sql.close();delete globalThis.__feeSweepTest}
