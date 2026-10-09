// Actual maintenance/handlers against isolated SQLite; no production requests.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
mkdirSync('.test-output',{recursive:true});
const database=sqliteD1();globalThis.__seasonReview={env:{DB:database.db},user:{userId:'owner',method:'password',displayName:'owner'}};
await build({stdin:{contents:`export {GET,POST} from './app/api/club/route';export {load,save} from './lib/store';export {loadClubState} from './lib/club-maintenance';export {emptyState,month} from './lib/domain/types';export {replayRating} from './lib/domain/ranking';`,resolveDir:process.cwd(),loader:'ts'},outfile:'.test-output/season-review-api.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'isolated-season',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'season-review'}));b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'season-review'}));
 b.onLoad({filter:/.*/,namespace:'season-review'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__seasonReview.env;':'export const getAppUser=async()=>globalThis.__seasonReview.user;export const passwordEnabled=async()=>true;'}));
}}]});
const api=await import(pathToFileURL(resolve('.test-output/season-review-api.mjs')).href);
try{
 const empty=api.emptyState(),s=api.emptyState(),now=Date.now(),old=new Date(now);old.setUTCMonth(old.getUTCMonth()-4);const at=old.getTime();
 s.settings={...s.settings,initialized:true,ownerAccountId:'owner',realmVersion:'elo-v1',progressionVersion:'weekly-v2',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',strengthVersion:'realm-elo-v2'};
 for(let i=0;i<4;i++){const id=i?'member'+i:'owner';s.accounts.push({id,email:'',role:i?'member':'admin',playerId:'p'+i});s.players.push({id:'p'+i,ownerId:id,name:id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''})}
 const oldEvent={id:'old',creatorId:'owner',title:'Old fixture',start:at-3600000,end:at+60000,venue:'Fixture',address:'',capacity:4,signupDeadline:at,cancelDeadline:at-86400000,note:'',status:'ended',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal'};
 const current={...oldEvent,id:'current',title:'Current fixture',start:now-60000,end:now+3600000,status:'open'};s.events=[oldEvent,current];
 for(const e of s.events)s.bookings.push({id:e.id+'-court',eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:0});
 s.rounds.push({id:'old-round',eventId:oldEvent.id,start:at-60000,duration:1,status:'complete',eligible:s.players.map(p=>p.id),rest:[],seed:1});
 s.matches.push({id:'old-match',eventId:oldEvent.id,roundId:'old-round',courtId:'old-court',a:['p0','p1'],b:['p2','p3'],status:'complete',start:at-60000,end:at,scoreA:21,scoreB:19,games:[{a:21,b:19}],monthly:true,elo:true,locked:false,enteredBy:'owner'});
 for(const [i,p]of s.players.entries())s.registrations.push({id:'r'+i,eventId:current.id,playerId:p.id,sequence:i,status:'confirmed',arrival:current.start,departure:current.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 api.replayRating(s,at+1);assert.equal(s.players[0].rating,1016);await api.save(s,'seed',empty);
 const raw=await api.load(),fresh=await api.loadClubState();assert.equal(fresh.revision,raw.revision);assert.ok(fresh.players.every(p=>p.rating===1000&&p.ratedGames===0));assert.deepEqual(fresh.matches,raw.matches);assert.equal((await api.load()).players[0].rating,1016,'Read-only catch-up must not manufacture a maintenance write');
 assert.equal((await api.loadClubState()).revision,raw.revision);assert.deepEqual((await api.load()).audits,raw.audits);
 const origin='https://club.example',read=await api.GET(new Request(origin+'/api/club?month='+api.month(at)+'&year='+new Date(at).getUTCFullYear()));assert.equal(read.status,200);const view=await read.json();assert.ok(Array.isArray(view.leaderboard));assert.ok(view.players.every(p=>p.rating===1000));assert.equal(view.quarterlyLeaderboard.find(p=>p.playerId==='p0').points,3);
 const response=await api.POST(new Request(origin+'/api/club',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'liveStart',payload:{eventId:current.id},revision:fresh.revision,requestId:crypto.randomUUID()})}));assert.equal(response.status,200,await response.clone().text());
 const playing=(await api.loadClubState()).matches.find(m=>m.eventId===current.id);assert.equal(playing.status,'playing');assert.equal(playing.a.length,2);assert.equal(playing.b.length,2);
 const grant={action:'grantPoints',payload:{playerId:'p0',period:api.month(now),points:0,rating:100},revision:(await api.loadClubState()).revision,requestId:crypto.randomUUID()};
 const post=body=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await post(grant)).status,200);assert.equal((await post(grant)).status,200);const granted=await api.load();assert.equal(granted.audits.filter(a=>a.action==='grantPoints').length,1);assert.equal(granted.players.find(p=>p.id==='p0').rating,1100);assert.equal((await api.loadClubState()).players.find(p=>p.id==='p0').rating,1100,'A repeated read must not apply the grant twice');
 const grantView=await (await api.GET(new Request(origin+'/api/club?month='+api.month(at)+'&year='+new Date(at).getUTCFullYear()))).json();assert.equal(grantView.social.stats.find(p=>p.playerId==='p0').realmScore.score,1100);assert.equal(grantView.quarterlyLeaderboard.find(p=>p.playerId==='p0').points,3,'A rating-only grant must not add season points');
 globalThis.__seasonReview.user={userId:'member1',method:'password',displayName:'member1'};assert.equal((await post({...grant,requestId:crypto.randomUUID(),revision:granted.revision,payload:{...grant.payload,isOwner:true}})).status,403);assert.deepEqual(await api.load(),granted);globalThis.__seasonReview.user={userId:'owner',method:'password',displayName:'owner'};
 database.injectFailure(query=>query.startsWith('INSERT INTO audits'));assert.equal((await post({...grant,requestId:crypto.randomUUID(),revision:granted.revision,payload:{...grant.payload,rating:50}})).status,503);database.injectFailure(null);assert.deepEqual(await api.load(),granted,'Rating and audit changes must roll back together');
 const beforeMigration=await api.load(),unmigrated=structuredClone(beforeMigration);delete unmigrated.settings.strengthVersion;await api.save(unmigrated,'fixture-missing-marker',beforeMigration);
 const rawBefore=await api.load(),migrated=await api.loadClubState();assert.equal(migrated.revision,rawBefore.revision+1);assert.equal(migrated.audits.filter(a=>a.action==='mergeStrengthRating').length,1);
 assert.equal((await api.loadClubState()).revision,migrated.revision);assert.deepEqual(migrated.matches,rawBefore.matches,'Migration must retain both historical and currently playing games');
 console.log('PASS season review API: inactivity catch-up, stable revision/history, season isolation, old-tab compatibility, owner-only rating grants, persistence, idempotence and atomic rating/audit rollback');
}finally{database.sql.close();delete globalThis.__seasonReview}
