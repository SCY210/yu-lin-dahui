// Isolated SQLite/D1; fictional members only, never contacts production.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
mkdirSync('.test-output',{recursive:true});
globalThis.__liveScoreTest={env:{}};
const fixture=globalThis.__liveScoreTest;
writeFileSync('.test-output/live-score-entry.ts',"export {applyLiveScore,liveScores} from '../lib/live-score-store';export {apply} from '../lib/domain/commands';export {newTournament} from '../lib/domain/tournament';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';");
await build({entryPoints:['.test-output/live-score-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/live-score-bundle.mjs',plugins:[{name:'isolated-live-score',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'live-fixture'}));b.onLoad({filter:/.*/,namespace:'live-fixture'},()=>({contents:'export const env=globalThis.__liveScoreTest.env;',loader:'js'}))}}]});
const api=await import(pathToFileURL(resolve('.test-output/live-score-bundle.mjs')).href);
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+name,'utf8'));
const queries=[];
function statement(query,parameters=[]){return {query,parameters,bind(...args){return statement(query,args)},async first(){queries.push(query);return sql.prepare(query).get(...parameters)??null},async all(){queries.push(query);return {results:sql.prepare(query).all(...parameters)}},async run(){queries.push(query);const r=sql.prepare(query).run(...parameters);return {meta:{changes:Number(r.changes)},results:[]}}}}
// Batches run synchronously, like an atomic D1 batch, so concurrent taps interleave only between round trips.
const db={prepare:statement,async batch(list){sql.exec('BEGIN');try{const values=list.map(s=>{queries.push(s.query);if(/^SELECT/i.test(s.query.trim()))return {results:sql.prepare(s.query).all(...s.parameters)};const r=sql.prepare(s.query).run(...s.parameters);return {meta:{changes:Number(r.changes)},results:[]}});sql.exec('COMMIT');return values}catch(e){sql.exec('ROLLBACK');throw e}}};
fixture.env.DB=db;
const now=Date.now();
try{
 const s=api.emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=Array.from({length:6},(_,i)=>({id:i?'member'+i:'owner',email:'',playerId:'p'+i,role:i?'member':'admin'}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.playerId,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 const e={id:'cup',creatorId:'owner',title:'Fictional cup',matchFormat:'singles',tournament:{...api.newTournament(),format:'knockout',autoArrange:false},start:now-3600000,end:now+3600000*5,venue:'Fixture venue',address:'',capacity:8,note:'',signupDeadline:now,cancelDeadline:now-86400000,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events=[e];s.bookings=[{id:'court0',eventId:e.id,name:'Court 0',start:e.start,end:e.end,pricing:'total',cents:0}];
 s.registrations=s.players.slice(0,4).map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 const owner=s.accounts[0],referee=s.accounts[4],stranger=s.accounts[5];
 await api.apply(s,owner,'tournamentDraw',{eventId:e.id,teams:[['p0'],['p1'],['p2'],['p3']],seed:1,seeded:true},now);
 const [first,second]=e.tournament.fixtures;
 await api.apply(s,owner,'tournamentReferee',{eventId:e.id,fixtureId:first.id,playerId:'p4'},now);
 await api.apply(s,owner,'tournamentStart',{eventId:e.id,fixtureId:first.id,courtId:'court0'},now);
 await api.save(s,'seed',api.emptyState());
 const matchId=first.matchId;
 await assert.rejects(()=>api.applyLiveScore(stranger,{op:'start',matchId}),e=>e.status===403);
 await assert.rejects(()=>api.applyLiveScore(owner,{op:'start',matchId:'missing'}),e=>e.status===404);
 await assert.rejects(()=>api.applyLiveScore(referee,{op:'point',matchId,side:'a'}),/开始比赛/);
 await api.applyLiveScore(referee,{op:'start',matchId});
 queries.length=0;
 // Five taps at once from two phones: every point counts.
 const results=await Promise.all(Array.from({length:5},(_,i)=>api.applyLiveScore(i%2?owner:referee,{op:'point',matchId,side:'a'})));
 const [live]=await api.liveScores(e.id);
 assert.equal(live.events.filter(x=>x.type==='point').length,5);assert.equal(live.version,6);assert.equal(Math.max(...results.map(r=>r.version)),6);
 assert.ok(queries.every(q=>/live_scores|FROM matches WHERE id=|FROM events WHERE id=/.test(q)),'a tap reads only its match, activity and live row');
 await api.applyLiveScore(referee,{op:'swap',matchId});assert.equal((await api.liveScores(e.id))[0].swapped,true);
 // The second fixture has not been started: it cannot be scored live yet.
 await assert.rejects(()=>api.applyLiveScore(owner,{op:'start',matchId:second.matchId??'none'}),e=>e.status===404);
 console.log('PASS live score store: referee and organisers only, start before points, concurrent taps all counted, single-row reads and writes');
}finally{sql.close();delete globalThis.__liveScoreTest}
