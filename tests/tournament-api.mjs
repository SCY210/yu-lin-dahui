import {seedAccountNoticeFixture} from './helpers/account-notice.mjs';
// Actual handlers and storage, isolated in memory; never production data.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__tournamentApiTest={env:{},user:null};
writeFileSync('.test-output/live-entry.ts',`export {GET,POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {emptyState,month} from '../lib/domain/types';export {loadClubState} from '../lib/club-maintenance';`);
await build({entryPoints:['.test-output/live-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/tournament-api.mjs',plugins:[{name:'isolated-live',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'live-fixture'}));b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'live-fixture'}));b.onLoad({filter:/.*/,namespace:'live-fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__tournamentApiTest.env;':'export const getAppUser=async()=>globalThis.__tournamentApiTest.user;export const passwordEnabled=async()=>true;',loader:'js'}))}}]});
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function statement(query,parameters=[]){return {query,parameters,bind(...args){return statement(query,args)},async first(){return sql.prepare(query).get(...parameters)??null},async all(){return {results:sql.prepare(query).all(...parameters)}},async run(){const r=sql.prepare(query).run(...parameters);return {meta:{changes:Number(r.changes)},results:[]}}}}
fixture.env.DB={prepare:statement,async batch(list){sql.exec('BEGIN');try{const values=list.map(s=>/^SELECT/i.test(s.query.trim())?{results:sql.prepare(s.query).all(...s.parameters)}:{meta:{changes:Number(sql.prepare(s.query).run(...s.parameters).changes)},results:[]});sql.exec('COMMIT');return values}catch(e){sql.exec('ROLLBACK');throw e}}};
const api=await import(pathToFileURL(resolve('.test-output/tournament-api.mjs')).href);
try{
 const s=api.emptyState(),now=Date.now();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=Array.from({length:8},(_,i)=>({id:i?'member'+i:'owner',email:'',playerId:'p'+i,role:i?'member':'admin'}));s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 const e={id:'t',creatorId:'owner',title:'Fictional competition',matchFormat:'doubles',tournament:{phase:'setup',teams:[],groups:[],advance:2,fixtures:[]},start:now-3600000,end:now+3600000,venue:'Fictional venue',address:'',capacity:8,signupDeadline:now,cancelDeadline:now-86400000,note:'',status:'open',courtMode:'interval',ballMode:'interval',attendanceMode:'automatic'};
 s.events=[e];s.bookings=[{id:'court',eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:1000}];s.registrations=s.players.map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));await seedAccountNoticeFixture(s);await api.save(s,'seed',api.emptyState());
 const origin='https://club.example',user=id=>fixture.user={userId:id,displayName:id,method:'password'};
 const request=async(action,payload)=>({action,payload,requestId:crypto.randomUUID(),revision:(await api.loadClubState()).revision});
 const post=body=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 const draw={eventId:e.id,teams:[['p0','p1'],['p2','p3'],['p4','p5'],['p6','p7']],groups:2,advance:1,seed:1};user('member1');assert.equal((await post(await request('tournamentDraw',draw))).status,403);user('owner');
 const drawWrite=await request('tournamentDraw',draw),before=await api.load(),batch=fixture.env.DB.batch;fixture.env.DB.batch=async()=>{throw new Error('test tournament rollback')};assert.equal((await post(drawWrite)).status,503);fixture.env.DB.batch=batch;assert.deepEqual(await api.load(),before);
 assert.equal((await post(drawWrite)).status,200);assert.equal((await post(drawWrite)).status,200);let stored=await api.load();assert.equal(stored.events[0].tournament.fixtures.length,2);assert.equal(stored.audits.filter(x=>x.action==='tournamentDraw').length,1);
 const f=stored.events[0].tournament.fixtures[0],begin=await request('tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court'});assert.equal((await post(begin)).status,200);assert.equal((await post(begin)).status,200);stored=await api.load();assert.equal(stored.matches.length,1);assert.equal(stored.events[0].tournament.fixtures[0].matchId,stored.matches[0].id);assert.equal((await post(await request('tournamentStart',begin.payload))).status,409);
 user('member1');const scoring=await request('score',{matchId:stored.matches[0].id,a:21,b:19});assert.equal((await post(scoring)).status,200);assert.equal((await post(scoring)).status,200);stored=await api.load();assert.equal(stored.matches.length,1);assert.equal(stored.matches[0].status,'complete');
 const view=await (await api.GET(new Request(origin+'/api/club?month='+api.month(now)+'&year=2030'))).json();assert.equal(view.events[0].tournament.teams.length,4);assert.equal(view.matches[0].scoreA,21);
 user('owner');const f2=stored.events[0].tournament.fixtures[1];assert.equal((await post(await request('tournamentStart',{eventId:e.id,fixtureId:f2.id,courtId:'court'}))).status,200);stored=await api.load();assert.equal((await post(await request('score',{matchId:stored.matches[1].id,a:21,b:19}))).status,200);
 const qualify=await request('tournamentKnockout',{eventId:e.id});assert.equal((await post(qualify)).status,200);assert.equal((await post(qualify)).status,200);stored=await api.load();assert.equal(stored.events[0].tournament.fixtures.length,3);
 assert.equal((await post(await request('score',{matchId:stored.matches[0].id,a:19,b:21}))).status,400);
 const final=stored.events[0].tournament.fixtures.at(-1),race=await request('tournamentStart',{eventId:e.id,fixtureId:final.id,courtId:'court'});assert.deepEqual((await Promise.all([post(race),post({...race,requestId:crypto.randomUUID()})])).map(r=>r.status).sort(),[200,409]);stored=await api.load();assert.equal(stored.matches.length,3);
 console.log('PASS tournament API: persisted group draw and bracket, stored authority, atomic rollback, idempotent draws/starts/scores, signup scoring, sealed group results and concurrent start refusal');
}finally{sql.close();delete globalThis.__tournamentApiTest}
