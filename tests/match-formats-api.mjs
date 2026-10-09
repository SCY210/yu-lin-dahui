// Actual handlers and storage, isolated in memory; never production data.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__formatApiTest={env:{},user:null};
writeFileSync('.test-output/formats-entry.ts',`export {GET,POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {emptyState,month} from '../lib/domain/types';export {loadClubState} from '../lib/club-maintenance';`);
await build({entryPoints:['.test-output/formats-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/formats-api.mjs',plugins:[{name:'isolated-live',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'live-fixture'}));b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'live-fixture'}));b.onLoad({filter:/.*/,namespace:'live-fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__formatApiTest.env;':'export const getAppUser=async()=>globalThis.__formatApiTest.user;export const passwordEnabled=async()=>true;',loader:'js'}))}}]});
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function statement(query,parameters=[]){return {query,parameters,bind(...args){return statement(query,args)},async first(){return sql.prepare(query).get(...parameters)??null},async all(){return {results:sql.prepare(query).all(...parameters)}},async run(){const r=sql.prepare(query).run(...parameters);return {meta:{changes:Number(r.changes)},results:[]}}}}
fixture.env.DB={prepare:statement,async batch(list){sql.exec('BEGIN');try{const values=list.map(s=>/^SELECT/i.test(s.query.trim())?{results:sql.prepare(s.query).all(...s.parameters)}:{meta:{changes:Number(sql.prepare(s.query).run(...s.parameters).changes)},results:[]});sql.exec('COMMIT');return values}catch(e){sql.exec('ROLLBACK');throw e}}};
const api=await import(pathToFileURL(resolve('.test-output/formats-api.mjs')).href);
try{
 const empty=api.emptyState(),s=api.emptyState(),now=Date.now();s.settings.initialized=true;s.settings.ownerAccountId='owner';s.settings.realmVersion='elo-v1';s.settings.rankingVersion='signed-v1';s.settings.progressionVersion='weekly-v2';s.settings.scoringPolicy='all-ranked-v1';s.settings.strengthVersion='realm-elo-v2';
 s.accounts=Array.from({length:6},(_,i)=>({id:i?'member'+i:'owner',email:'',role:i?'member':'admin',playerId:'p'+i}));s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));await api.save(s,'seed',empty);
 const origin='https://club.example',user=id=>fixture.user={userId:id,displayName:id,method:'password'};
 const command=async(action,payload)=>({action,payload,requestId:crypto.randomUUID(),revision:(await api.loadClubState()).revision});
 const post=body=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 const send=async(action,payload)=>{const r=await post(await command(action,payload));assert.equal(r.status,200,await r.clone().text());return r};
 const base={start:now-60000,end:now+3600000,venue:'Fictional court',address:'',capacity:8,cancelDeadline:now-86400000,note:'',status:'open',bookings:[{name:'Court 1',start:now-60000,end:now+3600000,pricing:'hourly',cents:690}]};
 const register=async e=>{for(let i=0;i<4;i++)await send('register',{eventId:e.id,playerId:'p'+i,arrival:e.start,departure:e.end,note:''})};
 const view=async()=>{const r=await api.GET(new Request(origin+'/api/club?month='+api.month(now)+'&year='+new Date(now).getUTCFullYear()));assert.equal(r.status,200);return r.json()};
 user('owner');await send('event',{...base,matchFormat:'singles'});let stored=await api.load(),single=stored.events[0];assert.match(single.title,/单打/);assert.equal(single.creatorId,'owner');await register(single);
 for(let i=0;i<2;i++)await send('livePreference',{eventId:single.id,playerId:'p'+i,avoidConsecutive:true});
 await send('liveStart',{eventId:single.id});stored=await api.load();const first=stored.matches[0];assert.equal(first.a.length,1);assert.equal(first.b.length,1);
 user('member5');assert.equal((await post(await command('score',{matchId:first.id,a:21,b:19}))).status,403);
 user('member1');const score=await command('score',{matchId:first.id,a:21,b:19});assert.equal((await post(score)).status,200);assert.equal((await post(score)).status,200);stored=await api.load();assert.equal(stored.matches.length,2);assert.deepEqual(new Set([...stored.matches[1].a,...stored.matches[1].b]),new Set(['p2','p3']));
 const visible=await view();assert.equal(visible.singlesQuarterlyLeaderboard.length,2);assert.ok(visible.quarterlyLeaderboard.every(r=>r.games===0&&r.points===0));assert.ok(visible.singlesQuarterlyLeaderboard.some(r=>r.points===3));
 await send('score',{matchId:first.id,a:19,b:21,reason:''});stored=await api.load();assert.equal(stored.matches.length,2);assert.equal(stored.audits.at(-1).reason,'常规修改');assert.ok(stored.players.every(p=>p.rating===1000));
 const before=structuredClone(stored),second=stored.matches.find(m=>m.status==='playing'),request=await command('score',{matchId:second.id,a:21,b:19}),batch=fixture.env.DB.batch;
 fixture.env.DB.batch=async list=>{sql.exec('BEGIN');try{const q=list[0];sql.prepare(q.query).run(...q.parameters);throw Error('injected failure')}finally{sql.exec('ROLLBACK')}};
 assert.equal((await post(request)).status,503);fixture.env.DB.batch=batch;assert.deepEqual(await api.load(),before);
 user('owner');await send('livePause',{eventId:single.id,paused:true});await send('score',{matchId:second.id,a:21,b:19});
 await send('event',base);stored=await api.load();const double=stored.events.find(e=>e.id!==single.id);assert.equal(double.matchFormat,'doubles');assert.match(double.title,/双打/);await register(double);await send('liveStart',{eventId:double.id});stored=await api.load();const d=stored.matches.find(m=>m.eventId===double.id);assert.equal(d.a.length,2);assert.equal(d.b.length,2);await send('livePause',{eventId:double.id,paused:true});await send('score',{matchId:d.id,a:21,b:19});
 const boards=await view();assert.equal(boards.quarterlyLeaderboard.filter(r=>r.games).length,4);assert.ok(boards.quarterlyLeaderboard.filter(r=>r.games).every(r=>r.games===1));assert.equal(boards.singlesQuarterlyLeaderboard.length,4);assert.ok(boards.singlesQuarterlyLeaderboard.every(r=>r.games===1));
 await send('eventEdit',{eventId:double.id,venue:double.venue,address:'',capacity:8,cancelDeadline:double.cancelDeadline,note:''});stored=await api.load();assert.equal(stored.events.find(e=>e.id===double.id).title,double.title);assert.equal(stored.audits.at(-1).actor,'owner');assert.equal(stored.audits.at(-1).reason,'常规修改');
 console.log('PASS formats API: no-title persistent creation, default doubles, one-versus-one live play, rest/fair replacement, separated score boards, note-free corrections, permissions, idempotence and transactional rollback');
}finally{sql.close();delete globalThis.__formatApiTest}
