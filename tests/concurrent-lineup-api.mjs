// Two authenticated administrators, real handlers and isolated transactional SQLite.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
import {seedAccountNoticeFixture} from './helpers/account-notice.mjs';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__concurrentLineup={env:{},actor:new AsyncLocalStorage()};
writeFileSync('.test-output/concurrent-lineup-entry.ts',"export {GET,POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {loadClubState} from '../lib/club-maintenance';export {emptyState,month} from '../lib/domain/types';");
await build({entryPoints:['.test-output/concurrent-lineup-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/concurrent-lineup-api.mjs',plugins:[{name:'lineup-fixture',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'lineup'}));
 b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'lineup'}));
 b.onLoad({filter:/.*/,namespace:'lineup'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__concurrentLineup.env;':'export const getAppUser=async()=>globalThis.__concurrentLineup.actor.getStore()??null;export const passwordEnabled=async()=>true;'}));
}}]});
const db=sqliteD1();fixture.env.DB=db.db;const api=await import(pathToFileURL(resolve('.test-output/concurrent-lineup-api.mjs')).href);
const origin='https://club.example';
const as=(id,task)=>fixture.actor.run({userId:id,displayName:id,method:'password',username:id},task);
const post=(id,action,payload,revision,requestId=crypto.randomUUID())=>as(id,()=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action,payload,revision,requestId,actor:id})})));
const edit=m=>({matchId:m.id,expectedA:[...m.a],expectedB:[...m.b],a:[...m.b],b:[...m.a]});
const teams=state=>state.matches.map(m=>({id:m.id,a:m.a,b:m.b})).sort((a,b)=>a.id.localeCompare(b.id));
try{
 const s=api.emptyState(),now=Date.now();Object.assign(s.settings,{initialized:true,ownerAccountId:'admin-a',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',rankedEventsVersion:'admins-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=Array.from({length:12},(_,i)=>({id:i===0?'admin-a':i===1?'admin-b':'member'+i,email:'',role:i<2?'admin':'member',playerId:'p'+i}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 const e={id:'event',creatorId:'admin-a',title:'Fictional two-court activity',start:now-3600000,end:now+3600000,venue:'Venue',address:'',capacity:12,signupDeadline:now,cancelDeadline:now-86400000,note:'',status:'open',courtMode:'equal',ballMode:'equal',attendanceMode:'automatic'};
 s.events=[e];s.bookings=[0,1].map(i=>({id:'court'+i,eventId:e.id,name:'Court '+i,venue:e.venue,start:e.start,end:e.end,pricing:'total',cents:1000}));
 s.registrations=s.players.map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 await seedAccountNoticeFixture(s);await api.save(s,'seed',api.emptyState());let stored=await api.loadClubState();assert.equal((await post('admin-a','liveStart',{eventId:e.id},stored.revision)).status,200);
 stored=await api.loadClubState();const active=stored.matches.filter(m=>m.status==='playing');assert.equal(active.length,2);
 const revision=stored.revision,one=edit(active[0]),two=edit(active[1]);
 const independent=await Promise.all([post('admin-a','liveLineup',one,revision),post('admin-b','liveLineup',two,revision)]);
 assert.deepEqual(independent.map(r=>r.status),[200,200],'independent courts merge after revalidating the displayed teams');
 stored=await api.load();for(const p of [one,two]){const m=stored.matches.find(m=>m.id===p.matchId);assert.deepEqual(m.a,p.a);assert.deepEqual(m.b,p.b);}
 assert.equal(stored.audits.filter(a=>a.action==='liveLineup'&&a.actor==='admin-a').length,1);assert.equal(stored.audits.filter(a=>a.action==='liveLineup'&&a.actor==='admin-b').length,1);
 const get=id=>as(id,()=>api.GET(new Request(origin+'/api/club?month='+api.month(now)+'&year='+api.month(now).slice(0,4))));
 const views=await Promise.all(['admin-a','admin-b'].map(async id=>{const r=await get(id);assert.equal(r.status,200);return r.json()}));
 assert.deepEqual(teams(views[0]),teams(views[1]),'both administrators read the same persisted lineup');assert.equal(views[0].revision,views[1].revision);
 const latest=stored.matches.find(m=>m.id===one.matchId),same=edit(latest),alternative={...same,a:[...latest.a].reverse(),b:[...latest.b]};
 const racing=await Promise.all([post('admin-a','liveLineup',same,stored.revision),post('admin-b','liveLineup',alternative,stored.revision)]);
 assert.deepEqual(racing.map(r=>r.status).sort(),[200,409],'one conflicting edit wins; the other cannot overwrite it');
 const after=await api.load();assert.equal(after.audits.filter(a=>a.action==='liveLineup').length,3);
 const stale=await post('admin-b','liveLineup',same,after.revision);assert.equal(stale.status,409,'even a fresh global revision cannot bypass stale expected teams');assert.deepEqual(await api.load(),after);
 const denied=await post('member2','liveLineup',edit(after.matches.find(m=>m.status==='playing')),after.revision);assert.equal(denied.status,403);assert.deepEqual(await api.load(),after);
 const running=after.matches.filter(m=>m.status==='playing'),busy=new Set(running.flatMap(m=>[...m.a,...m.b]));const replacement=after.players.find(p=>!busy.has(p.id)).id;
 const competing=running.map(m=>({...edit(m),a:[replacement,m.a[1]],b:[...m.b]}));
 const claimed=await Promise.all([post('admin-a','liveLineup',competing[0],after.revision),post('admin-b','liveLineup',competing[1],after.revision)]);
 assert.deepEqual(claimed.map(r=>r.status).sort(),[200,409],'the same bench player cannot be claimed by two courts');
 const final=await api.load();assert.equal(final.matches.filter(m=>m.status==='playing'&&[...m.a,...m.b].includes(replacement)).length,1);
 console.log('PASS concurrent lineup API: distinct authenticated admins, independent courts merge, identical persisted views, same-court conflict, stale teams and permission preservation');
}finally{db.close();delete globalThis.__concurrentLineup}
