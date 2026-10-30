// Isolated SQLite/D1 + real WebCrypto; never contacts a push vendor or real players.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
mkdirSync('.test-output',{recursive:true});
globalThis.__bountySweepTest={env:{}};
const fixture=globalThis.__bountySweepTest;
writeFileSync('.test-output/bounty-sweep-entry.ts',"export {runBountyReminderSweep} from '../lib/bounty-reminder-sweep';export {drawnBounty} from '../lib/domain/bounties';export {flushPushOutbox} from '../lib/push-outbox';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';");
await build({entryPoints:['.test-output/bounty-sweep-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/bounty-sweep-bundle.mjs',plugins:[{name:'isolated-bounty-sweep',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'bounty-fixture'}));b.onLoad({filter:/.*/,namespace:'bounty-fixture'},()=>({contents:'export const env=globalThis.__bountySweepTest.env;',loader:'js'}))}}]});
const api=await import(pathToFileURL(resolve('.test-output/bounty-sweep-bundle.mjs')).href);
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
const minute=60000,start=Date.parse('2026-10-22T17:00:00Z');
/** An activity id for which Alice and Carol draw a bounty and Bob draws none (the draw is a fixed hash). */
const pick=prefix=>{for(let i=0;;i++){const id=prefix+i;if(api.drawnBounty(id,'p1')&&api.drawnBounty(id,'p3')&&!api.drawnBounty(id,'p2'))return id}};
try{
 const s=api.emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=[['owner','admin','p0'],['alice','member','p1'],['bob','member','p2'],['carol','member','p3']].map(([id,role,playerId])=>({id,email:'',role,playerId}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 const event=(id,at,fields={})=>({id,creatorId:'owner',title:'周四积分赛',start:at,end:at+120*minute,venue:'球馆',address:'',capacity:8,signupDeadline:at-60*minute,cancelDeadline:at-60*minute,note:'',status:'open',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal',ranked:true,...fields});
 const points=pick('points-'),later=pick('later-'),practice=pick('practice-');
 s.events=[event(points,start),event(later,start+180*minute),event(practice,start,{ranked:false})];
 for(const e of s.events)for(const [i,playerId] of ['p1','p2','p3'].entries())s.registrations.push({id:e.id+'-'+playerId,eventId:e.id,playerId,sequence:i+1,status:playerId==='p3'?'waitlist':'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 await api.save(s,'seed',api.emptyState());
 for(const account of ['alice','bob','carol'])sql.prepare('INSERT INTO push_subscriptions(id,account_id,payload,created_at) VALUES(?,?,?,?)').run('sub-'+account,account,JSON.stringify({endpoint:'https://fcm.googleapis.com/fcm/send/'+account,expirationTime:null,keys:{p256dh:encode(clientPublic),auth:encode(auth)}}),start-24*60*minute);
 // Preferences saved before the bounty option existed keep it on.
 sql.prepare('INSERT INTO reminder_settings(account_id,payload) VALUES(?,?)').run('alice',JSON.stringify({signup:true,registration:true,changes:true,matches:true,fees:true,awards:true,upcoming:true}));
 const inbox=()=>sql.prepare("SELECT account_id AS account,event_id AS event FROM reminder_inbox WHERE kind='bounty' ORDER BY created_at,account_id").all().map(r=>r.account+' '+r.event);
 const run=async(at,flush=true)=>{const original=Date.now;Date.now=()=>at;try{const result=await api.runBountyReminderSweep({db,now:at});if(flush)await api.flushPushOutbox(fixture.env);return result}finally{Date.now=original}};

 assert.deepEqual(await run(start-40*minute),{sent:0},'the offer opens 30 minutes before the start');
 assert.deepEqual(await run(start-30*minute),{sent:1});
 assert.deepEqual(inbox(),['alice '+points],'Bob drew no bounty, Carol is on the waitlist, the practice is not a points match');
 assert.deepEqual(captures,['https://fcm.googleapis.com/fcm/send/alice'],'her device receives a push');
 const notice=JSON.parse(sql.prepare("SELECT payload FROM reminder_inbox WHERE kind='bounty'").get().payload);
 assert.match(notice.title,/^悬赏令 · /);assert.match(notice.body,/^周四积分赛 19:00 开打。.+完成得 .+；接下没完成扣 10 积分。/);assert.equal(notice.tab,'overview');
 assert.deepEqual(await run(start-20*minute),{sent:0},'told once');assert.equal(captures.length,1);
 // Carol is promoted from the waitlist before the start: she is told on the next tick.
 const promoted=await api.load(),next=structuredClone(promoted);next.registrations.find(r=>r.id===points+'-p3').status='confirmed';await api.save(next,'promote',promoted);
 captures.length=0;assert.deepEqual(await run(start-10*minute),{sent:1});assert.deepEqual(captures,['https://fcm.googleapis.com/fcm/send/carol']);
 assert.deepEqual(await run(start+minute),{sent:0},'nothing once the activity has started');
 // Alice answers before her push goes out: the queued push lapses, the inbox keeps the notice.
 captures.length=0;assert.deepEqual(await run(start+150*minute,false),{sent:1});
 const queued=await api.load(),answered=structuredClone(queued);answered.events.find(e=>e.id===later).bounties=[{playerId:'p1',kind:api.drawnBounty(later,'p1'),status:'declined',at:start+151*minute,coins:0,points:0,penalty:10}];await api.save(answered,'answer',queued);
 const original=Date.now;Date.now=()=>start+152*minute;try{await api.flushPushOutbox(fixture.env)}finally{Date.now=original}
 assert.deepEqual(captures,[],'no push after answering');assert.deepEqual(inbox().at(-1),'alice '+later);
 assert.equal(sql.prepare("SELECT state FROM push_deliveries WHERE job_id=?").get('bounty:'+later+':p1').state,'cancelled');
 console.log('PASS bounty reminder sweep API: one notice per offered member when the offer opens, waitlist promotions told later, no notice for practices or after the start, old preferences keep it on, a push lapses once answered');
}finally{globalThis.fetch=originalFetch;sql.close();delete globalThis.__bountySweepTest}
