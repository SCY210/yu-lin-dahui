// Published results may be entered before their activity; no production requests.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__earlyScoreTest={env:{},user:null};
writeFileSync('.test-output/early-score-entry.ts',"export {GET,POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {loadClubState} from '../lib/club-maintenance';export {emptyState,month} from '../lib/domain/types';export {isRatedMatch} from '../lib/domain/realm-rating';");
await build({entryPoints:['.test-output/early-score-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/early-score-api.mjs',plugins:[{name:'isolated-early-score',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'early'}));b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'early'}));b.onLoad({filter:/.*/,namespace:'early'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__earlyScoreTest.env;':'export const getAppUser=async()=>globalThis.__earlyScoreTest.user;export const passwordEnabled=async()=>true;'}))}}]});
const db=sqliteD1();fixture.env.DB=db.db;
const api=await import(pathToFileURL(resolve('.test-output/early-score-api.mjs')).href);
await build({entryPoints:['app/match-card.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*'],loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:'.test-output/early-score-card.mjs'});
const MatchCard=(await import(pathToFileURL(resolve('.test-output/early-score-card.mjs')).href)).default;
const origin='https://club.example',now=Date.now(),future=now+86400000,period=api.month(future);
const user=id=>fixture.user=id?{userId:id,method:'password',displayName:id}:null;
const post=async(payload,requestId=crypto.randomUUID(),revision)=>(api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'score',payload,requestId,revision:revision??(await api.load()).revision})})));
const view=async()=>{const r=await api.GET(new Request(origin+'/api/club?month='+period+'&year='+period.slice(0,4)));assert.equal(r.status,200);return r.json()};
try{
 const s=api.emptyState();Object.assign(s.settings,{initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=[{id:'owner',playerId:'p4',role:'admin',email:''},{id:'member',playerId:'p0',role:'member',email:''},{id:'outsider',playerId:'p5',role:'member',email:''}];
 s.players=Array.from({length:6},(_,i)=>({id:'p'+i,name:'Fictional '+i,ownerId:i===0?'member':i===4?'owner':i===5?'outsider':'unused',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 const e={id:'future-event',creatorId:'owner',title:'Fictional future activity',start:future,end:future+7200000,status:'open',venue:'Fictional venue',address:'',capacity:6,signupDeadline:future,cancelDeadline:future-86400000,note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',schedulingMode:'planned'};
 s.events=[e];s.bookings=[{id:'court',eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:1000}];
 s.registrations=s.players.slice(0,4).map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,status:'confirmed',sequence:i,arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 s.rounds=[0,1,2].map(i=>({id:'round'+i,eventId:e.id,start:e.start+i*900000,duration:15,status:i===2?'draft':'published',eligible:['p0','p1','p2','p3'],rest:[],seed:i+1,pointsSlot:i+1}));
 s.matches=s.rounds.map((r,i)=>({id:'match'+i,eventId:e.id,roundId:r.id,courtId:'court',a:['p0','p1'],b:['p2','p3'],status:r.status,start:null,end:null,scoreA:null,scoreB:null,games:[],locked:false,enteredBy:null,monthly:true,elo:true}));
 await api.save(s,'seed',api.emptyState());await api.loadClubState();
 const payload={matchId:'match0',a:21,b:19,games:[{a:21,b:19}],reason:'Published result entered early'};
 user(null);assert.equal((await post(payload)).status,401);user('outsider');assert.equal((await post({...payload,eventId:e.id,earlyScoreAt:0})).status,403);
 user('member');let before=await api.load();assert.equal((await post({...payload,a:21,b:20,games:[{a:21,b:20}]})).status,400);assert.deepEqual(await api.load(),before);
 assert.equal((await post({...payload,matchId:'match2'})).status,400,'unpublished draft remains protected');assert.deepEqual(await api.load(),before);
 const ctx={data:{...before,me:before.accounts.find(a=>a.id==='member'),social:{matchLevels:{}}},name:id=>id,admin:false};
 assert.ok(renderToStaticMarkup(createElement(MatchCard,{m:before.matches[0],ctx})).includes('录入比分'),'future published match exposes entry to a signed-up member');
 assert.ok(!renderToStaticMarkup(createElement(MatchCard,{m:before.matches[2],ctx})).includes('录入比分'));
 const key=crypto.randomUUID();assert.equal((await post({...payload,earlyScoreAt:1},key)).status,200);assert.equal((await post(payload,key)).status,200);
 let stored=await api.load(),m=stored.matches.find(m=>m.id==='match0');assert.equal(m.status,'complete');assert.equal(m.start,e.start);assert.equal(m.end,e.start+1);assert.ok(m.earlyScoreAt>=now&&m.earlyScoreAt<=Date.now());assert.equal(m.enteredBy,'member');assert.equal(stored.audits.filter(a=>a.action==='score').length,1);
 assert.equal(stored.events[0].start,e.start);assert.equal(stored.bookings[0].start,e.start);assert.equal(stored.events[0].pointsSession,undefined,'entry does not start the activity');
 assert.ok(api.isRatedMatch(m,Date.now()));assert.equal(api.isRatedMatch({...m,earlyScoreAt:undefined},Date.now()),false,'ordinary future data still cannot accrue points');
 assert.equal(api.isRatedMatch({...m,earlyScoreAt:Date.now()+60000},Date.now()),false);
 let ranked=await view();assert.equal(ranked.quarterlyLeaderboard.find(r=>r.playerId==='p0').points,3);assert.equal(ranked.quarterlyLeaderboard.find(r=>r.playerId==='p0').games,1);assert.equal(ranked.quarterlyLeaderboard.find(r=>r.playerId==='p0').pendingGames,1);
 // A second early game adds points; it is not mistaken for a correction of the first.
 assert.equal((await post({...payload,matchId:'match1'})).status,200);ranked=await view();assert.equal(ranked.quarterlyLeaderboard.find(r=>r.playerId==='p0').games,2);assert.ok(ranked.quarterlyLeaderboard.find(r=>r.playerId==='p0').points>3);
 stored=await api.load();const corrected={...payload,a:19,b:21,games:[{a:19,b:21}],end:m.end};assert.equal((await post(corrected)).status,200);stored=await api.load();assert.equal(stored.matches[0].earlyScoreAt,m.earlyScoreAt);assert.equal((await view()).quarterlyLeaderboard.find(r=>r.playerId==='p0').games,2);
 // Reject unknown lineups / cancelled activities and roll back failures in the new path.
 before=await api.load();const draft=structuredClone(before);draft.rounds[2].status='published';draft.matches[2].status='published';await api.save(draft,'publish-last',before);before=await api.load();
 db.injectFailure(query=>query.startsWith('INSERT INTO matches'));assert.equal((await post({...payload,matchId:'match2'})).status,503);db.injectFailure(null);assert.deepEqual(await api.load(),before);
 const cancelled=structuredClone(before);cancelled.events[0].status='cancelled';await api.save(cancelled,'cancel-event',before);before=await api.load();user('owner');assert.equal((await post({...payload,matchId:'match2'})).status,400);assert.deepEqual(await api.load(),before);
 console.log('PASS early score API: future published UI/member permission, immediate live points, preserved schedule, server-only early marker, future-data guard, two games, correction, replay and SQL rollback');
}finally{db.close();delete globalThis.__earlyScoreTest}
