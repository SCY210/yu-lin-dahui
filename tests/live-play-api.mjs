// Actual handlers and storage, isolated in memory; never production data.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__livePlayApiTest={env:{},user:null};
writeFileSync('.test-output/live-entry.ts',`export {GET,POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {emptyState,month} from '../lib/domain/types';export {loadClubState} from '../lib/club-maintenance';`);
await build({entryPoints:['.test-output/live-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/live-api.mjs',plugins:[{name:'isolated-live',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'live-fixture'}));b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'live-fixture'}));b.onLoad({filter:/.*/,namespace:'live-fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__livePlayApiTest.env;':'export const getAppUser=async()=>globalThis.__livePlayApiTest.user;export const passwordEnabled=async()=>true;',loader:'js'}))}}]});
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function statement(query,parameters=[]){return {query,parameters,bind(...args){return statement(query,args)},async first(){return sql.prepare(query).get(...parameters)??null},async all(){return {results:sql.prepare(query).all(...parameters)}},async run(){const r=sql.prepare(query).run(...parameters);return {meta:{changes:Number(r.changes)},results:[]}}}}
fixture.env.DB={prepare:statement,async batch(list){sql.exec('BEGIN');try{const values=list.map(s=>/^SELECT/i.test(s.query.trim())?{results:sql.prepare(s.query).all(...s.parameters)}:{meta:{changes:Number(sql.prepare(s.query).run(...s.parameters).changes)},results:[]});sql.exec('COMMIT');return values}catch(e){sql.exec('ROLLBACK');throw e}}};
const api=await import(pathToFileURL(resolve('.test-output/live-api.mjs')).href);
try{
 const empty=api.emptyState(),s=api.emptyState(),now=Date.now();s.settings.initialized=true;s.settings.ownerAccountId='owner';s.settings.progressionVersion='weekly-v2';s.settings.realmVersion='elo-v1';s.settings.rankingVersion='signed-v1';s.settings.scoringPolicy='all-ranked-v1';
 s.accounts=Array.from({length:9},(_,i)=>({id:i?'member'+i:'owner',email:'',role:i?'member':'admin',playerId:'p'+i}));s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 const event={id:'live-event',creatorId:'owner',title:'Fictional live play',start:now-3600000,end:now+3600000,venue:'Fictional venue',address:'',capacity:8,signupDeadline:now,cancelDeadline:now-86400000,note:'',status:'open',courtMode:'equal',ballMode:'equal',attendanceMode:'automatic'};s.events.push(event);s.bookings.push({id:'court',eventId:event.id,name:'Court 1',start:event.start,end:event.end,pricing:'total',cents:1000});
 s.registrations=s.players.slice(0,8).map((p,i)=>({id:'reg'+i,eventId:event.id,playerId:p.id,sequence:i,status:'confirmed',arrival:event.start,departure:event.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));await api.save(s,'seed',empty);
 const origin='https://club.example',user=id=>fixture.user={userId:id,displayName:id,method:'password'};
 const request=async(action,payload,requestId=crypto.randomUUID())=>({action,payload,requestId,revision:(await api.loadClubState()).revision});
 const post=body=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 user('member1');assert.equal((await post(await request('liveStart',{eventId:event.id,role:'admin'}))).status,403);
 assert.equal((await post(await request('livePreference',{eventId:event.id,playerId:'p0',avoidConsecutive:true}))).status,403);
 user('member8');assert.equal((await post(await request('livePreference',{eventId:event.id,playerId:'p8',avoidConsecutive:true}))).status,400);
 user('owner');for(let i=0;i<4;i++)assert.equal((await post(await request('livePreference',{eventId:event.id,playerId:'p'+i,avoidConsecutive:true}))).status,200);
 const begin=await request('liveStart',{eventId:event.id});assert.equal((await post(begin)).status,200);assert.equal((await post(begin)).status,200);
 let stored=await api.load();assert.equal(stored.matches.length,1);assert.equal(stored.matches[0].status,'playing');assert.equal(stored.events[0].livePlay.preferences.length,4);
 user('member4');const first=await request('score',{matchId:stored.matches[0].id,a:21,b:19,reason:'Finish without a time input'});assert.equal((await post(first)).status,200);assert.equal((await post(first)).status,200);
 stored=await api.load();assert.equal(stored.matches.length,2);assert.equal(stored.matches[0].status,'complete');assert.equal(stored.matches[1].status,'playing');assert.deepEqual(new Set([...stored.matches[1].a,...stored.matches[1].b]),new Set(['p4','p5','p6','p7']));assert.equal(stored.events[0].livePlay.rest.length,4);
 const view=await (await api.GET(new Request(origin+'/api/club?month='+api.month(now)+'&year='+new Date(now).getUTCFullYear()))).json();assert.ok(view.matches.some(m=>m.status==='playing'));assert.equal(view.events[0].livePlay.rest.length,4);
 const correction=await request('score',{matchId:stored.matches[0].id,a:19,b:21,reason:'Correct result'});assert.equal((await post(correction)).status,200);stored=await api.load();assert.equal(stored.matches.length,2);assert.equal(stored.events[0].livePlay.completions[0].count,1);
 const before=structuredClone(stored),next=await request('score',{matchId:stored.matches[1].id,a:21,b:19,reason:'Storage rollback'}),batch=fixture.env.DB.batch;
 fixture.env.DB.batch=async list=>{sql.exec('BEGIN');try{const q=list[0];sql.prepare(q.query).run(...q.parameters);throw new Error('injected storage failure')}finally{sql.exec('ROLLBACK')}};
 assert.equal((await post(next)).status,503);fixture.env.DB.batch=batch;assert.deepEqual(await api.load(),before);
 assert.equal((await post(next)).status,200);stored=await api.load();assert.equal(stored.matches.length,3);assert.equal(stored.matches.filter(m=>m.status==='playing').length,1);assert.equal(stored.events[0].livePlay.completions[0].count,2);
 const current=stored.matches.find(m=>m.status==='playing'),a=await request('score',{matchId:current.id,a:21,b:19,reason:'Concurrent A'}),b={...a,requestId:crypto.randomUUID(),payload:{...a.payload,a:19,b:21,reason:'Concurrent B'}};
 assert.deepEqual((await Promise.all([post(a),post(b)])).map(r=>r.status).sort(),[200,409]);stored=await api.load();assert.equal(stored.matches.length,4);assert.equal(stored.matches.filter(m=>m.status==='playing').length,1);
 console.log('PASS live-play API: stored preferences, permissions, no time inputs, atomic score/next-game save, request idempotence, correction without advancing, SQLite rollback and concurrent scoring conflict');
}finally{sql.close();delete globalThis.__livePlayApiTest}
