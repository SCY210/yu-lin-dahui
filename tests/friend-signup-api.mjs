import {acceptedActivityNotice} from './helpers/activity-notice.mjs';
// Actual club handler and store, using isolated transactional SQLite only.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {sqliteD1} from './helpers/sqlite-d1.mjs';

mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__friendSignupTest={env:{},user:null};
writeFileSync('.test-output/friend-signup-entry.ts',`export {GET,POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';export {rateLimitId,uploadDayWindow} from '../lib/rate-limit';`);
await build({entryPoints:['.test-output/friend-signup-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/friend-signup-api.mjs',plugins:[{name:'isolated-friend-auth',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'friend-test'}));
 b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'friend-test'}));
 b.onLoad({filter:/.*/,namespace:'friend-test'},a=>({contents:a.path==='env'?'export const env=globalThis.__friendSignupTest.env;':'export const getAppUser=async()=>globalThis.__friendSignupTest.user;export const passwordEnabled=async()=>true;',loader:'js'}));
}}]});
const database=sqliteD1();fixture.env.DB=database.db;
const api=await import(pathToFileURL(resolve('.test-output/friend-signup-api.mjs')).href);
try{
 const empty=api.emptyState(),s=api.emptyState(),now=Date.now(),start=Math.ceil((now+86400000)/1800000)*1800000,end=start+7200000;
 Object.assign(s.settings,{initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=['owner','member','other'].map((id,i)=>({id,email:'',role:i?'member':'admin',playerId:'p'+i}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 s.events=[{id:'event',creatorId:'owner',title:'Fictional guest signup',start,end,venue:'Fictional venue',address:'',capacity:1,signupDeadline:end,cancelDeadline:start-86400000,status:'open',note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'}];
 s.bookings=[{id:'court',eventId:'event',name:'Court',start,end,pricing:'total',cents:1200,signupCapacity:1}];
 await api.save(s,'seed',empty);
 const origin='https://club.example',signIn=id=>fixture.user=id?{userId:id,method:'password',displayName:'Fictional '+id}:null;
 const post=async(payload,requestId=crypto.randomUUID(),options={})=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:options.origin??origin,'Content-Type':'application/json'},body:JSON.stringify({action:options.action??'friendSignup',payload,requestId,actor:options.actor??fixture.user?.userId,revision:options.revision??(await api.load()).revision})}));
 const fresh=name=>({...acceptedActivityNotice,mode:'new',name,bookingId:'court',arrival:start,departure:end,note:''});
 signIn(null);assert.equal((await post(fresh('No login'))).status,401);
 signIn('member');assert.equal((await post(fresh('Wrong origin'),crypto.randomUUID(),{origin:'https://attacker.example'})).status,403);
 assert.equal((await post(fresh('Wrong actor'),crypto.randomUUID(),{actor:'other'})).status,409);
 const requestId=crypto.randomUUID();assert.equal((await post({...fresh('Fictional guest'),ownerId:'forged'},requestId)).status,200);
 const state=await api.load(),friend=state.players.find(p=>p.name==='Fictional guest');assert.ok(friend);assert.equal(friend.ownerId,'member');assert.equal(friend.guestEventId,'event');assert.equal(friend.profile,undefined);
 const projected=await (await api.GET(new Request(origin+'/api/club?month=2026-11&year=2026'))).json();assert.ok(!projected.social.stats.some(p=>p.playerId===friend.id));
 signIn('owner');assert.equal((await post({playerId:friend.id,name:'Forbidden profile'},crypto.randomUUID(),{action:'profile'})).status,403);signIn('member');
 const levelKey=crypto.randomUUID();assert.equal((await post({playerId:friend.id,level:1300},levelKey,{action:'guestLevel'})).status,200);assert.equal((await post({playerId:friend.id,level:1300},levelKey,{action:'guestLevel'})).status,200);
 let levelState=await api.load();assert.equal(levelState.players.find(p=>p.id===friend.id).guestLevels.at(-1).level,1300);assert.equal(levelState.audits.filter(a=>a.action==='guestLevel').length,1);
 signIn('other');assert.equal((await post({playerId:friend.id,level:850},crypto.randomUUID(),{action:'guestLevel'})).status,403);signIn('member');
 assert.equal((await post({playerId:friend.id,level:999},crypto.randomUUID(),{action:'guestLevel'})).status,400);
 database.injectFailure(query=>/INSERT INTO players\(/i.test(query));assert.equal((await post({playerId:friend.id,level:1150},crypto.randomUUID(),{action:'guestLevel'})).status,503);database.injectFailure(null);
 assert.deepEqual((await api.load()).players,levelState.players);assert.deepEqual((await api.load()).audits,levelState.audits);
 const levelView=await (await api.GET(new Request(origin+'/api/club?month=2026-11&year=2026'))).json(),guestView=levelView.players.find(p=>p.id===friend.id);assert.equal(guestView.guest,true);assert.equal(guestView.guestLevel,1300);assert.equal(guestView.guestHost,'Fictional member');
 assert.equal(state.registrations.length,1);assert.equal(state.registrations[0].playerId,friend.id);assert.equal(state.registrations[0].bookingSignups[0].status,'confirmed');
 assert.equal((await post(fresh('Fictional guest'),requestId)).status,200);assert.equal((await api.load()).players.length,4);assert.equal((await api.load()).registrations.length,1);
 const quotaId=await api.rateLimitId('creation-daily:friend:member:'+api.uploadDayWindow().day);
 assert.equal(database.sql.prepare('SELECT count FROM auth_rate_limits WHERE id=?').get(quotaId).count,1);
 assert.equal((await post({...acceptedActivityNotice,mode:'existing',playerId:friend.id,bookingId:'court',arrival:start,departure:end,note:'Reuse'})).status,200);
 assert.equal((await api.load()).players.length,4);assert.equal(database.sql.prepare('SELECT count FROM auth_rate_limits WHERE id=?').get(quotaId).count,1,'existing friend does not debit creation quota');
 assert.equal((await post(fresh('Fictional waiting guest'))).status,200);let loaded=await api.load();const waiting=loaded.players.find(p=>p.name==='Fictional waiting guest');assert.equal(loaded.registrations.find(r=>r.playerId===waiting.id).bookingSignups[0].status,'waitlist');
 const before=await api.load();assert.equal((await post({...fresh('Invalid interval'),arrival:start-1800000})).status,400);assert.equal((await post({...acceptedActivityNotice,mode:'existing',playerId:'p2',bookingId:'court',arrival:start,departure:end,note:''})).status,403);
 assert.deepEqual((await api.load()).players,before.players);assert.deepEqual((await api.load()).registrations,before.registrations);
 database.injectFailure(query=>/INSERT INTO registrations\(/i.test(query));
 const rollback=await post(fresh('Rollback guest'));assert.equal(rollback.status,503);database.injectFailure(null);
 loaded=await api.load();assert.deepEqual(loaded.players,before.players);assert.deepEqual(loaded.registrations,before.registrations);assert.equal(loaded.revision,before.revision,'database failure rolls back the new activity participant and signup together');
 console.log('PASS friend signup API: one-step persistence, authenticated ownership, CSRF/actor checks, full-court waitlist, replay deduplication, existing-profile reuse, quota and atomic rollback');
}finally{database.close();delete globalThis.__friendSignupTest}
