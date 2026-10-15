import {seedAccountNoticeFixture} from './helpers/account-notice.mjs';
// Real handlers, transactional SQLite, fictional accounts only. No remote data.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';

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
 Object.assign(s.settings,{initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',rankedEventsVersion:'admins-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=['owner','host','member','other','legacy','late'].map((id,i)=>({id,email:'',role:i?'member':'admin',playerId:'p'+i}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 const event=(id,at=start)=>({id,creatorId:'host',title:'Fictional '+id,start:at,end:at+2*hour,venue:'Fictional venue',address:'',capacity:4,signupDeadline:at-2*hour,cancelDeadline:at-86400000,status:'open',note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'});
 s.events=[event('e'),event('legacy'),event('closed',now+hour),event('ended',now-3*hour)];
 s.bookings=[{id:'c',eventId:'e',name:'Court',start,end,pricing:'total',cents:1200,signupCapacity:1},...s.events.filter(e=>['closed','ended'].includes(e.id)).map(e=>({id:e.id+'-court',eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:1200,signupCapacity:4}))];
 s.registrations=[{id:'legacy-row',eventId:'legacy',playerId:'p4',sequence:1,status:'confirmed',arrival:start,departure:end,note:'Old signup without a confirmation',cancelRequested:false,registeredAt:now-1000,joinedAsWaitlist:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}];
 const historical={id:'historical-confirmation',eventId:'legacy',playerId:'p4',version:'historical-v1',at:1,actorId:'legacy',kind:'self'};s.registrations[0].noticeAcknowledgements=[historical];
 await seedAccountNoticeFixture(s);await api.save(s,'seed',api.emptyState());
 const origin='https://club.example',signIn=id=>fixture.user={userId:id,method:'password',displayName:'Fictional '+id};
 const post=async(action,payload,key=crypto.randomUUID(),revision)=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action,payload,requestId:key,actor:fixture.user.userId,revision:revision??(await api.load()).revision})}));
 const view=async()=>{const response=await api.GET(new Request(origin+'/api/club'));assert.equal(response.status,200);return response.json()};
 const court=(playerId='p2')=>({bookingId:'c',playerId,arrival:start,departure:end,note:''});
 const legacy=(playerId='p2')=>({eventId:'legacy',playerId,arrival:start,departure:end,note:''});
 const guest=()=>({mode:'new',gender:'male',name:'Fictional visitor',bookingId:'c',arrival:start,departure:end,note:''});
 const row=(state,playerId='p2',eventId='e')=>state.registrations.find(r=>r.playerId===playerId&&r.eventId===eventId);
 signIn('member');
 for(const [action,payload] of [['register',legacy()],['courtRegister',court()],['friendSignup',guest()]]){
  const response=await post(action,payload);assert.equal(response.status,200,await response.clone().text());
 }
 let saved=await api.load();assert.equal(row(saved).noticeAcknowledgements,undefined);assert.equal(row(saved,'p2','legacy').noticeAcknowledgements,undefined);
 const visitor=saved.players.find(p=>p.name==='Fictional visitor');assert.ok(visitor);assert.equal(row(saved,visitor.id).noticeAcknowledgements,undefined);
 const key=crypto.randomUUID();assert.equal((await post('courtRegister',{...court(),noticeAccepted:false,noticeVersion:'obsolete',noticeAcknowledgements:[{id:'forged',actorId:'forged',at:0}]},key)).status,200);
 const after=await api.load();assert.equal(row(after).noticeAcknowledgements,undefined,'signup never manufactures a new receipt, even when old/forged fields are sent');
 assert.equal((await post('courtRegister',court(),key)).status,200);assert.deepEqual(await api.load(),after,'lost-response replay is idempotent');
 assert.equal((await post('courtRegister',{...court(),note:'edit without checking'})).status,200);assert.equal(row(await api.load()).noticeAcknowledgements,undefined);
 signIn('other');assert.equal((await post('courtRegister',court('p3'))).status,200);saved=await api.load();assert.equal(row(saved,'p3').status,'waitlist');
 signIn('member');assert.equal((await post('courtCancel',{bookingId:'c',playerId:'p2',reason:'Cancel fixture'})).status,200);saved=await api.load();assert.equal(row(saved,visitor.id).status,'confirmed');assert.equal(row(saved,'p3').status,'waitlist');assert.equal(row(saved,'p3').noticeAcknowledgements,undefined);
 assert.equal((await post('courtRegister',court())).status,200);assert.equal(row(await api.load()).noticeAcknowledgements,undefined);
 assert.equal((await post('friendSignup',{mode:'existing',...court(visitor.id),note:'proxy edit'})).status,200);assert.equal(row(await api.load(),visitor.id).noticeAcknowledgements,undefined);
 // Historical receipts stay factual, private and unchanged after edits/rejoins.
 signIn('legacy');assert.deepEqual(row(await api.load(),'p4','legacy').noticeAcknowledgements,[historical]);assert.equal((await post('register',legacy('p4'))).status,200);
 assert.equal((await post('cancel',{eventId:'legacy',playerId:'p4',reason:'Cancel legacy fixture'})).status,200);assert.equal((await post('register',legacy('p4'))).status,200);assert.deepEqual(row(await api.load(),'p4','legacy').noticeAcknowledgements,[historical]);
 let projected=await view();assert.equal(row(projected,'p4','legacy').noticeAcknowledgements[0].id,historical.id);assert.equal(row(projected,'p4','legacy').noticeAcknowledgements[0].actorIsMe,true);
 signIn('other');projected=await view();assert.ok(!('noticeAcknowledgements' in row(projected,'p4','legacy')),'other members cannot read old private consent');
 signIn('host');projected=await view();assert.equal(row(projected,'p4','legacy').noticeAcknowledgements[0].id,historical.id);
 // Rollback and concurrent retries retain normal signup guarantees without consent writes.
 signIn('member');const stable=await api.load();database.injectFailure(query=>/INSERT INTO registrations\(/i.test(query));assert.equal((await post('friendSignup',{...guest(),name:'Rollback visitor'})).status,503);database.injectFailure(null);assert.deepEqual(await api.load(),stable);
 const raceKey=crypto.randomUUID(),race=await Promise.all([post('courtRegister',{...court(),note:'race edit'},raceKey,stable.revision),post('courtRegister',{...court(),note:'race edit'},raceKey,stable.revision)]);assert.ok(race.every(r=>r.status===200));saved=await api.load();assert.equal(saved.registrations.filter(r=>r.eventId==='e'&&r.playerId==='p2').length,1);assert.equal(row(saved).noticeAcknowledgements,undefined);assert.deepEqual(row(saved,'p4','legacy').noticeAcknowledgements,[historical]);
 // Signup remains subject to capacity, cutoff, ownership and event lifecycle rules.
 signIn('late');for(const id of ['closed','ended']){const b=s.bookings.find(b=>b.id===id+'-court');assert.equal((await post('courtRegister',{bookingId:b.id,playerId:'p5',arrival:b.start,departure:b.end,note:''})).status,400)}
 assert.equal((await post('courtRegister',court())).status,403);
 console.log('PASS checkbox-free signup API: self/legacy/proxy/guest registration and edits; no fabricated consent; retained historical private records; queue promotion, retry, concurrency and rollback; unchanged cutoff and authority.');
}finally{database.close();delete globalThis.__activityNoticeTest}
