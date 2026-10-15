import {seedAccountNoticeFixture} from './helpers/account-notice.mjs';
// Real API/store transactions with future published rounds; never production.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__publishedSwapTest={env:{},user:null};
writeFileSync('.test-output/published-swap-entry.ts',"export {GET,POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {loadClubState} from '../lib/club-maintenance';export {emptyState,month} from '../lib/domain/types';export {roundLineupSnapshot,swapRoundPlayers} from '../lib/domain/round-lineup';");
await build({entryPoints:['.test-output/published-swap-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/published-swap-api.mjs',plugins:[{name:'isolated-published-swap',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'swap'}));b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'swap'}));b.onLoad({filter:/.*/,namespace:'swap'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__publishedSwapTest.env;':'export const getAppUser=async()=>globalThis.__publishedSwapTest.user;export const passwordEnabled=async()=>true;'}))}}]});
const db=sqliteD1();fixture.env.DB=db.db;const api=await import(pathToFileURL(resolve('.test-output/published-swap-api.mjs')).href);
await build({entryPoints:['app/event-scheduling.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*'],loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:'.test-output/published-swap-ui.mjs'});
const Scheduling=(await import(pathToFileURL(resolve('.test-output/published-swap-ui.mjs')).href)).default;
const origin='https://club.example',now=Date.now(),start=now+86400000;
const user=id=>fixture.user=id?{userId:id,method:'password',displayName:id}:null;
const post=async(action,payload,{requestId=crypto.randomUUID(),revision}={})=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action,payload,requestId,revision:revision??(await api.load()).revision})}));
const lineup=s=>api.roundLineupSnapshot(s.matches.filter(m=>m.roundId==='round'));
const swap=(s,p1,p2)=>({roundId:'round',p1,p2,expectedLineup:lineup(s)});
const reject=async(action,payload,status=400)=>{const before=await api.load(),r=await post(action,payload);assert.equal(r.status,status,JSON.stringify(await r.json()));assert.deepEqual(await api.load(),before)};
const accept=async(action,payload,options)=>{const r=await post(action,payload,options);assert.equal(r.status,200,JSON.stringify(await r.json()));return api.load()};
try{
 const s=api.emptyState();Object.assign(s.settings,{initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',rankedEventsVersion:'admins-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=Array.from({length:12},(_,i)=>({id:i===0?'owner':'member'+i,playerId:'p'+i,role:i===0?'admin':'member',email:''}));
 s.players=Array.from({length:13},(_,i)=>({id:'p'+i,name:i===12?'Fictional guest':'Player '+i,ownerId:i===12?'owner':s.accounts[i].id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:'',...(i===12?{guestEventId:'event'}:{})}));
 const e={ranked:true,id:'event',creatorId:'member9',title:'Fictional activity',start,end:start+7200000,status:'open',venue:'Venue',address:'',capacity:16,signupDeadline:start,cancelDeadline:start-86400000,note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',schedulingMode:'planned'};
 s.events=[e];s.bookings=[0,1,2].map(i=>({id:'court'+i,eventId:e.id,name:'Court '+i,venue:i===2?'Other venue':'Venue',start:e.start,end:e.end,pricing:'total',cents:1000}));
 s.registrations=s.players.map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,status:i===10?'waitlist':'confirmed',sequence:i,arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''},...(i===11?{bookingSignups:[{bookingId:'court2',status:'confirmed',sequence:1,arrival:e.start,departure:e.end,note:'',cancelRequested:false,registeredAt:now,joinedAsWaitlist:false}]}:{})}));
 s.rounds=[{id:'round',eventId:e.id,start,duration:15,status:'published',eligible:s.players.slice(0,9).map(p=>p.id),rest:['p8'],seed:1,pointsSlot:1},{id:'later-round',eventId:e.id,start:start+900000,duration:15,status:'published',eligible:['p0','p1','p2','p3'],rest:[],seed:2,pointsSlot:2}];
 const match=(id,roundId,courtId,a,b)=>({id,eventId:e.id,roundId,courtId,a,b,status:'published',start:null,end:null,scoreA:null,scoreB:null,games:[],locked:false,enteredBy:null,monthly:true,elo:true});
 s.matches=[match('m0','round','court0',['p0','p1'],['p2','p3']),match('m1','round','court1',['p4','p5'],['p6','p7']),match('later','later-round','court0',['p0','p1'],['p2','p3'])];
 await seedAccountNoticeFixture(s);await api.save(s,'seed',api.emptyState());await api.loadClubState();let stored=await api.load();const later=structuredClone(stored.matches.find(m=>m.id==='later'));
 const ctx={data:{...stored,me:stored.accounts[0],social:{matchLevels:{}}},name:id=>stored.players.find(p=>p.id===id)?.name??id,admin:true,busy:false,open(){},send(){},setDanger(){}};
 const html=renderToStaticMarkup(createElement(Scheduling,{e,ctx}));assert.ok(html.includes('选择交换：Player 0'));assert.ok(html.includes('选择交换：Player 9'),'later signup visible on bench');assert.ok(html.includes('选择交换：Fictional guest'));assert.ok(!html.includes('选择交换：Player 10'));assert.ok(!html.includes('选择交换：Player 11'));
 user(null);await reject('swap',swap(stored,'p0','p9'),401);user('member2');await reject('swap',{...swap(stored,'p0','p9'),eventId:e.id},403);
 user('member9');const requestId=crypto.randomUUID(),first=swap(stored,'p0','p9');stored=await accept('swap',first,{requestId});assert.equal((await post('swap',first,{requestId})).status,200);assert.ok(stored.matches.find(m=>m.id==='m0').a.includes('p9'));assert.equal(stored.rounds[0].status,'published');assert.ok(stored.rounds[0].rest.includes('p0'));assert.ok(stored.rounds[0].eligible.includes('p9'));assert.deepEqual(stored.matches.find(m=>m.id==='later'),later);
 user('member2');await reject('score',{matchId:'m0',a:21,b:19,reason:'Old score dialog',expectedA:['p0','p1'],expectedB:['p2','p3']},409);user('member9');await reject('swap',first,409);await reject('swap',swap(stored,'p1','p10'));await reject('swap',swap(stored,'p1','p11'));await reject('swap',swap(stored,'p8','p12'));
 // Guests can replace a published member without creating a permanent profile.
 stored=await accept('swap',swap(stored,'p9','p12'));assert.ok(stored.matches.find(m=>m.id==='m0').a.includes('p12'));stored=await accept('swap',swap(stored,'p12','p9'));
 await reject('lock',{matchId:'m1',locked:true});await reject('lock',{matchId:'m1',locked:false});
 const legacyPlaying=structuredClone(stored),legacyMatch=legacyPlaying.matches.find(m=>m.id==='m1');legacyMatch.locked=true;legacyMatch.status='playing';legacyMatch.start=start;legacyPlaying.rounds.find(r=>r.id==='round').status='playing';await api.save(legacyPlaying,'legacy-playing-lock-fixture',stored);stored=await api.load();
 stored=await accept('swap',swap(stored,'p1','p5'));assert.ok(stored.matches.find(m=>m.id==='m0').a.includes('p5'));assert.ok(stored.matches.find(m=>m.id==='m1').a.includes('p1'));assert.equal(stored.matches.find(m=>m.id==='m1').locked,false);assert.equal(stored.matches.find(m=>m.id==='m1').status,'playing');
 user('member1');await reject('score',{matchId:'m1',a:21,b:19,expectedA:['p4','p5'],expectedB:['p6','p7'],reason:'Stale playing-score dialog'},409);user('member9');
 // Racing edits use one revision; a stale selection cannot silently move the new lineup.
 const revision=stored.revision,one=swap(stored,'p9','p8'),two=swap(stored,'p9','p12');const race=await Promise.all([post('swap',one,{revision}),post('swap',two,{revision})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);stored=await api.load();
 const replacement=stored.matches.find(m=>m.id==='m0').a.find(id=>id==='p8'||id==='p12');stored=await accept('swap',swap(stored,replacement,'p9'));
 const before=await api.load();db.injectFailure(q=>q.startsWith('INSERT INTO matches'));assert.equal((await post('swap',swap(before,'p9','p8'))).status,503);db.injectFailure(null);assert.deepEqual(await api.load(),before);
 // Rejected direct domain calls are also atomic, not just rolled back by SQLite.
 const work=structuredClone(before);assert.throws(()=>api.swapRoundPlayers(work,work.rounds[0],'p9','p11',now,lineup(work)));assert.deepEqual(work,before);
 user('member2');stored=await accept('score',{matchId:'m0',a:21,b:19,reason:'Actual result after substitution'});const frozen=structuredClone(stored.matches.find(m=>m.id==='m0'));
 user('owner');await reject('swap',swap(stored,'p9','p8'));await reject('lock',{matchId:'m0',locked:true});stored=await accept('swap',swap(stored,'p4','p8'));assert.deepEqual(stored.matches.find(m=>m.id==='m0'),frozen);
 const response=await api.GET(new Request(origin+'/api/club?month='+api.month(start)+'&year='+api.month(start).slice(0,4)));assert.equal(response.status,200);const view=await response.json();assert.equal(view.quarterlyLeaderboard.find(r=>r.playerId==='p9').games,1);assert.equal(view.quarterlyLeaderboard.find(r=>r.playerId==='p0').games,0);assert.equal(view.quarterlyLeaderboard.find(r=>r.playerId==='p9').points,3);
 // Current occupancy must not prevent editing a different unstarted planned round.
 const previous=await api.load(),busy=structuredClone(previous);
 busy.events.push({...e,id:'ongoing',start:now-60000,end:now+3600000,ranked:false});
 busy.bookings.push({...busy.bookings[0],id:'ongoing-court',eventId:'ongoing',start:now-60000,end:now+3600000});
 busy.rounds.push({...busy.rounds[0],id:'ongoing-round',eventId:'ongoing',start:now,status:'playing',pointsSlot:undefined});
 busy.matches.push({...busy.matches[0],id:'busy-now',eventId:'ongoing',roundId:'ongoing-round',courtId:'ongoing-court',a:['p0','p1'],b:['p4','p8'],status:'playing',start:now,end:null,games:[],scoreA:null,scoreB:null,enteredBy:null,monthly:false,elo:false});
 await api.save(busy,'busy-now-fixture',previous);await api.loadClubState();stored=await api.load();
 const unchangedCurrent=structuredClone(stored.matches.find(m=>m.id==='busy-now'));
 stored=await accept('swap',{roundId:'later-round',p1:'p0',p2:'p4',expectedLineup:api.roundLineupSnapshot(stored.matches.filter(m=>m.roundId==='later-round'))});
 assert.ok(stored.matches.find(m=>m.id==='later').a.includes('p4'));assert.deepEqual(stored.matches.find(m=>m.id==='busy-now'),unchangedCurrent);
 assert.deepEqual(stored.matches.find(m=>m.id==='m0'),frozen,'planning a later round cannot alter a recorded result');
 const timed=structuredClone(stored),late=timed.registrations.find(r=>r.playerId==='p9');late.arrival=e.start+3600000;late.departure=e.start+5400000;await api.save(timed,'outside-planned-window-fixture',stored);stored=await api.load();
 const beforeLate=structuredClone(stored.matches.find(m=>m.id==='busy-now'));stored=await accept('swap',{roundId:'later-round',p1:'p4',p2:'p9',expectedLineup:api.roundLineupSnapshot(stored.matches.filter(m=>m.roundId==='later-round'))});
 assert.ok(stored.matches.find(m=>m.id==='later').a.includes('p9'),'planned swap accepts a confirmed player outside the estimated time window');assert.deepEqual(stored.matches.find(m=>m.id==='busy-now'),beforeLate);
 console.log('PASS published swaps: authority, signup windows, currently playing future assignees, guests, retired locks, unscored playing substitutions, stale/racing edits, rollback, unchanged current games and scored lineup protection');
}finally{db.close();delete globalThis.__publishedSwapTest}
