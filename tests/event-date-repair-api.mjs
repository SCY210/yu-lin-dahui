// Real API/store against isolated in-memory SQLite; no production grants.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__dateRepairTest={env:{},user:null};
writeFileSync('.test-output/date-repair-entry.ts',`export {GET,POST} from '../app/api/club/route';export {load,save,committed} from '../lib/store';export {emptyState} from '../lib/domain/types';export {runRequestedEventDateRepair,requestedEventDateRepair} from '../lib/requested-event-date-repair';`);
await build({entryPoints:['.test-output/date-repair-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/date-repair-api-bundle.mjs',plugins:[{name:'isolated-grants',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'award-fixture'}));b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'award-fixture'}));b.onLoad({filter:/.*/,namespace:'award-fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__dateRepairTest.env;':'export const getAppUser=async()=>globalThis.__dateRepairTest.user;export const passwordEnabled=async()=>true;',loader:'js'}))}}]});
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function statement(query,parameters=[]){return {query,parameters,bind(...args){return statement(query,args)},async first(){return sql.prepare(query).get(...parameters)??null},async all(){return {results:sql.prepare(query).all(...parameters)}},async run(){const r=sql.prepare(query).run(...parameters);return {meta:{changes:Number(r.changes)},results:[]}}}}
fixture.env.DB={prepare:statement,async batch(list){sql.exec('BEGIN');try{const values=list.map(s=>/^SELECT/i.test(s.query.trim())?{results:sql.prepare(s.query).all(...s.parameters)}:{meta:{changes:Number(sql.prepare(s.query).run(...s.parameters).changes)},results:[]});sql.exec('COMMIT');return values}catch(e){sql.exec('ROLLBACK');throw e}}};
const api=await import(pathToFileURL(resolve('.test-output/date-repair-api-bundle.mjs')).href);


const realNow=Date.now;Date.now=()=>Date.parse('2026-10-08T21:00:00Z');
try{
 const empty=api.emptyState(),s=api.emptyState(),plan=api.requestedEventDateRepair;
 s.settings.initialized=true;s.settings.ownerAccountId='owner';s.settings.progressionVersion='weekly-v2';s.settings.rankingVersion='signed-v1';s.settings.scoringPolicy='all-ranked-v1';
 s.accounts=['owner','alice','bob','carol'].map((id,i)=>({id,email:'',role:i?'member':'admin',playerId:'p'+i}));s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.playerId,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 const e={id:plan.eventId,creatorId:'owner',title:'Fictional Thursday',start:plan.fromStart,end:plan.fromEnd,venue:'Fictional',address:'',capacity:6,signupDeadline:plan.fromEnd,cancelDeadline:plan.fromStart-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal'};
 s.events=[e,{...e,id:'foreign',status:'draft'}];s.bookings.push({id:'court',eventId:e.id,name:'Fictional',start:e.start,end:e.end,pricing:'total',cents:0});
 s.registrations=s.players.map((p,i)=>({id:'r'+i,eventId:e.id,playerId:p.id,sequence:i+1,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 s.rounds.push({id:'round',eventId:e.id,start:e.start,duration:15,status:'complete',eligible:s.players.map(p=>p.id),rest:[],seed:1});s.matches.push({id:'match',eventId:e.id,roundId:'round',courtId:'court',a:['p0','p1'],b:['p2','p3'],status:'complete',start:e.start,end:e.start+900000,scoreA:21,scoreB:19,monthly:true,elo:true,locked:false,enteredBy:'owner',games:[{a:21,b:19}]});await api.save(s,'seed',empty);
 await Promise.all(Array.from({length:4},()=>api.runRequestedEventDateRepair()));let fixed=await api.load();assert.equal(fixed.events[0].start,plan.toStart);assert.equal(fixed.bookings[0].end,plan.toEnd);assert.equal(fixed.rounds[0].start,plan.toStart);assert.equal(fixed.matches[0].start,plan.toStart);assert.equal(fixed.matches[0].scoreA,21);assert.equal(fixed.registrations[0].arrival,plan.toStart);assert.equal(fixed.events[1].start,plan.fromStart);assert.equal(fixed.audits.filter(a=>a.action==='repairEventDate').length,1);assert.equal(fixed.revision,2);assert.ok(await api.committed(plan.key));
 const snapshot=structuredClone(fixed);await api.runRequestedEventDateRepair({eventId:'foreign',toStart:0});assert.deepEqual(await api.load(),snapshot);
 const rollback=structuredClone(fixed);rollback.matches[0].scoreA=30;await assert.rejects(()=>api.save(rollback,plan.key,fixed),/UNIQUE/);assert.deepEqual(await api.load(),snapshot);
 fixture.user={userId:'alice',method:'password',displayName:'alice'};const origin='https://club.example';
 const read=await api.GET(new Request(origin+'/api/club?month=2026-10&year=2026'));assert.equal(read.status,200);const view=await read.json();assert.equal(view.events.find(x=>x.id===e.id).status,'ended');assert.equal(view.leaderboard.find(r=>r.playerId==='p1').points,fixed.settings.rules.win);
 const vote=await api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'awardVote',payload:{eventId:e.id,playerId:'p2',category:'mvp'},revision:fixed.revision,actor:'alice',requestId:crypto.randomUUID()})}));assert.equal(vote.status,200,await vote.text());assert.equal((await api.load()).awardVotes.length,1);
 console.log('PASS date repair API: actual SQLite atomic migration, concurrent once-only ledger, preserved score/roster/foreign activity, rollback, ended projection and authorized voting');
}finally{Date.now=realNow;sql.close();delete globalThis.__dateRepairTest}
