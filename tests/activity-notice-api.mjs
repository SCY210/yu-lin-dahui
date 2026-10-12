// Real handlers, transactional SQLite, fictional accounts only. No remote data.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
import {acceptedActivityNotice as accepted} from './helpers/activity-notice.mjs';

mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__activityNoticeTest={env:{},user:null};
writeFileSync('.test-output/activity-notice-entry.ts',"export {GET,POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';");
await build({entryPoints:['.test-output/activity-notice-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/activity-notice-api.mjs',plugins:[{name:'isolated-notice-auth',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'notice-test'}));
 b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'notice-test'}));
 b.onLoad({filter:/.*/,namespace:'notice-test'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__activityNoticeTest.env;':'export const getAppUser=async()=>globalThis.__activityNoticeTest.user;export const passwordEnabled=async()=>true;'}));
}}]});
const database=sqliteD1();fixture.env.DB=database.db;
const api=await import(pathToFileURL(resolve('.test-output/activity-notice-api.mjs')).href);
try{
 const s=api.emptyState(),now=Date.now(),hour=3600000,start=Math.ceil((now+3*86400000)/1800000)*1800000,end=start+2*hour;
 Object.assign(s.settings,{initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=['owner','host','member','other','legacy','late'].map((id,i)=>({id,email:'',role:i?'member':'admin',playerId:'p'+i}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 const event=(id,at=start)=>({id,creatorId:'host',title:'Fictional '+id,start:at,end:at+2*hour,venue:'Fictional venue',address:'',capacity:4,signupDeadline:at-2*hour,cancelDeadline:at-86400000,status:'open',note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'});
 s.events=[event('e'),event('legacy'),event('closed',now+hour),event('ended',now-3*hour)];
 s.bookings=[{id:'c',eventId:'e',name:'Court',start,end,pricing:'total',cents:1200,signupCapacity:1},...s.events.filter(e=>['closed','ended'].includes(e.id)).map(e=>({id:e.id+'-court',eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:1200,signupCapacity:4}))];
 s.registrations=[{id:'legacy-row',eventId:'legacy',playerId:'p4',sequence:1,status:'confirmed',arrival:start,departure:end,note:'Old signup without a confirmation',cancelRequested:false,registeredAt:now-1000,joinedAsWaitlist:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}];
 await api.save(s,'seed',api.emptyState());
 const origin='https://club.example',signIn=id=>fixture.user={userId:id,method:'password',displayName:'Fictional '+id};
 const post=async(action,payload,key=crypto.randomUUID(),revision)=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action,payload,requestId:key,actor:fixture.user.userId,revision:revision??(await api.load()).revision})}));
 const view=async()=>{const response=await api.GET(new Request(origin+'/api/club'));assert.equal(response.status,200);return response.json()};
 const court=(playerId='p2')=>({bookingId:'c',playerId,arrival:start,departure:end,note:''});
 const legacy=(playerId='p2')=>({eventId:'legacy',playerId,arrival:start,departure:end,note:''});
 const guest=()=>({mode:'new',name:'Fictional visitor',bookingId:'c',arrival:start,departure:end,note:''});
 const row=(state,playerId='p2',eventId='e')=>state.registrations.find(r=>r.playerId===playerId&&r.eventId===eventId);
 signIn('member');
 for(const [action,payload] of [['register',legacy()],['courtRegister',court()],['friendSignup',guest()]]){
  for(const input of [{},{noticeAccepted:false,noticeVersion:accepted.noticeVersion},{noticeAccepted:'true',noticeVersion:accepted.noticeVersion},{noticeAccepted:true,noticeVersion:'obsolete-version'}]){
   const before=await api.load(),response=await post(action,{...payload,...input});
   assert.equal(response.status,input.noticeAccepted===true?409:400,await response.clone().text());
   assert.deepEqual(await api.load(),before,'a refused signup creates neither consent nor a guest/registration');
  }
 }
 const key=crypto.randomUUID(),beforeAt=Date.now();
 assert.equal((await post('courtRegister',{...court(),...accepted,at:0,actorId:'forged',noticeAcknowledgements:[{at:0,actorId:'forged',kind:'self'}]},key)).status,200);
 let saved=await api.load(),first=row(saved).noticeAcknowledgements[0];
 assert.equal(first.actorId,'member');assert.equal(first.kind,'self');assert.equal(first.version,accepted.noticeVersion);assert.equal(first.eventId,'e');assert.equal(first.bookingId,'c');assert.equal(first.playerId,'p2');assert.ok(first.at>=beforeAt&&first.at<=Date.now());
 assert.equal((await post('courtRegister',{...court(),...accepted},key)).status,200);
 assert.deepEqual(row(await api.load()).noticeAcknowledgements,[first],'lost-response retry never duplicates confirmation');
 const prior=await api.load();assert.equal((await post('courtRegister',{...court(),note:'edit without checking'})).status,400);assert.deepEqual(await api.load(),prior);
 assert.equal((await post('courtRegister',{...court(),...accepted,note:'confirmed edit'})).status,200);saved=await api.load();assert.equal(row(saved).noticeAcknowledgements.length,2);assert.deepEqual(row(saved).noticeAcknowledgements[0],first);
 // Queue promotion and cancellation are automatic status changes, not fresh consent.
 signIn('other');assert.equal((await post('courtRegister',{...court('p3'),...accepted})).status,200);saved=await api.load();assert.equal(row(saved,'p3').status,'waitlist');const waitingHistory=structuredClone(row(saved,'p3').noticeAcknowledgements);
 signIn('member');assert.equal((await post('courtCancel',{bookingId:'c',playerId:'p2',reason:'Cancel fixture'})).status,200);saved=await api.load();assert.equal(row(saved,'p3').status,'confirmed');assert.deepEqual(row(saved,'p3').noticeAcknowledgements,waitingHistory);
 assert.equal(row(saved).noticeAcknowledgements.length,2);assert.equal((await post('courtRegister',{...court(),...accepted})).status,200);saved=await api.load();assert.equal(row(saved).noticeAcknowledgements.length,3);assert.deepEqual(row(saved).noticeAcknowledgements[0],first);
 // Proxy records name the authenticated registrant, never claim a friend signed.
 assert.equal((await post('friendSignup',{...guest(),...accepted})).status,200);saved=await api.load();const visitor=saved.players.find(p=>p.name==='Fictional visitor');assert.equal(visitor.profile,undefined);const proxy=row(saved,visitor.id).noticeAcknowledgements[0];assert.equal(proxy.actorId,'member');assert.equal(proxy.kind,'proxy');
 for(const consent of [{},{noticeAccepted:false,noticeVersion:accepted.noticeVersion},{noticeAccepted:true,noticeVersion:'obsolete-version'}]){const unchanged=await api.load();assert.equal((await post('friendSignup',{mode:'existing',...court(visitor.id),...consent})).status,consent.noticeAccepted===true?409:400);assert.deepEqual(await api.load(),unchanged)}
 assert.equal((await post('friendSignup',{mode:'existing',playerId:visitor.id,...court(visitor.id),...accepted,note:'proxy edit'})).status,200);assert.equal(row(await api.load(),visitor.id).noticeAcknowledgements.length,2);
 let projected=await view();assert.equal(row(projected).noticeAcknowledgements.length,3);assert.equal(row(projected,visitor.id).noticeAcknowledgements.length,2);assert.ok(!('noticeAcknowledgements' in row(projected,'p3')));
 signIn('other');projected=await view();assert.ok(!('noticeAcknowledgements' in row(projected)));assert.ok(!('noticeAcknowledgements' in row(projected,visitor.id)));assert.equal(row(projected,'p3').noticeAcknowledgements[0].id,waitingHistory[0].id);assert.equal(row(projected,'p3').noticeAcknowledgements[0].actorIsMe,true);assert.equal(row(projected,'p3').noticeAcknowledgements[0].actorId,'');
 signIn('host');projected=await view();assert.equal(row(projected).noticeAcknowledgements.length,3);assert.equal(row(projected,visitor.id).noticeAcknowledgements.length,2);
 signIn('owner');assert.equal(row(await view()).noticeAcknowledgements.length,3);
 // No historical backfill; the next manual change needs its own confirmation.
 signIn('legacy');assert.ok(!('noticeAcknowledgements' in row(await api.load(),'p4','legacy')));assert.equal((await post('register',legacy('p4'))).status,400);assert.equal((await post('register',{...legacy('p4'),...accepted})).status,200);const oldHistory=row(await api.load(),'p4','legacy').noticeAcknowledgements;assert.equal(oldHistory.length,1);
 assert.equal((await post('cancel',{eventId:'legacy',playerId:'p4',reason:'Cancel legacy fixture'})).status,200);assert.equal((await post('register',{...legacy('p4'),...accepted})).status,200);assert.deepEqual(row(await api.load(),'p4','legacy').noticeAcknowledgements[0],oldHistory[0]);assert.equal(row(await api.load(),'p4','legacy').noticeAcknowledgements.length,2);
 // A failed SQLite transaction rolls back signup, guest and acknowledgement together.
 signIn('member');const stable=await api.load();database.injectFailure(query=>/INSERT INTO registrations\(/i.test(query));assert.equal((await post('friendSignup',{...guest(),name:'Rollback visitor',...accepted})).status,503);database.injectFailure(null);assert.deepEqual(await api.load(),stable);
 const staleRevision=stable.revision-1;assert.equal((await post('courtRegister',{...court(),...accepted},crypto.randomUUID(),staleRevision)).status,200);const afterStale=await api.load();assert.equal(row(afterStale).noticeAcknowledgements.length,row(stable).noticeAcknowledgements.length+1,'signup retries safely use fresh state');
 const raceKey=crypto.randomUUID();const race=await Promise.all([post('courtRegister',{...court(),...accepted,note:'race edit'},raceKey,afterStale.revision),post('courtRegister',{...court(),...accepted,note:'race edit'},raceKey,afterStale.revision)]);assert.ok(race.every(r=>r.status===200));assert.equal(row(await api.load()).noticeAcknowledgements.length,row(afterStale).noticeAcknowledgements.length+1,'concurrent retries commit one confirmation');
 // Consent must not grant an exception to cutoff, ownership or ended-event checks.
 signIn('late');for(const id of ['closed','ended']){const b=s.bookings.find(b=>b.id===id+'-court');assert.equal((await post('courtRegister',{bookingId:b.id,playerId:'p5',arrival:b.start,departure:b.end,note:'',...accepted})).status,400)}
 assert.equal((await post('courtRegister',{...court(),...accepted})).status,403);
 console.log('PASS activity notice API: all signup paths/edits enforce current explicit confirmation; server identity/time; private append-only self/proxy history; legacy, promotion, rejoin, retry, concurrency and rollback; existing signup rules');
}finally{database.close();delete globalThis.__activityNoticeTest}
