import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
import {seedAccountNoticeFixture} from './helpers/account-notice.mjs';

mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__bookingCancelTest={env:{},user:null};
writeFileSync('.test-output/booking-cancel-entry.ts',"export {GET,POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';");
await build({entryPoints:['.test-output/booking-cancel-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/booking-cancel-api.mjs',plugins:[{name:'isolated-booking-cancel',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'booking-cancel-test'}));
 b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'booking-cancel-test'}));
 b.onLoad({filter:/.*/,namespace:'booking-cancel-test'},a=>({contents:a.path==='env'?'export const env=globalThis.__bookingCancelTest.env;':'export const getAppUser=async()=>globalThis.__bookingCancelTest.user;export const passwordEnabled=async()=>true;',loader:'js'}));
}}]});
const database=sqliteD1();fixture.env.DB=database.db;
const api=await import(pathToFileURL(resolve('.test-output/booking-cancel-api.mjs')).href);
try{
 const s=api.emptyState(),now=Date.now(),hour=3600000,start=Math.ceil((now+3*86400000)/1800000)*1800000,middle=start+hour,end=start+2*hour;
 Object.assign(s.settings,{initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',rankedEventsVersion:'admins-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=['owner','creator','outsider'].map((id,i)=>({id,playerId:'p'+i,role:i?'member':'admin',email:''}));
 s.players=s.accounts.map(a=>({id:a.playerId,ownerId:a.id,name:'Fictional '+a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 s.events=[{id:'event',creatorId:'creator',title:'Fictional court cancellation',start,end,venue:'Fictional venue',address:'',capacity:8,status:'open',signupDeadline:start-2*hour,cancelDeadline:start-24*hour,note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'},{id:'owned-other',creatorId:'outsider',title:'Other activity',start,end,venue:'Other venue',address:'',capacity:8,status:'open',signupDeadline:start-2*hour,cancelDeadline:start-24*hour,note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'}];
 s.bookings=['A','B','C'].map(id=>({id,eventId:'event',name:'Court '+id,start,end,signupCapacity:1,pricing:'total',cents:1000}));
 const slot=(bookingId,status,arrival,departure)=>({bookingId,status,sequence:1,arrival,departure,note:'Fictional signup',registeredAt:now,joinedAsWaitlist:status==='waitlist',cancelRequested:false});
 const reg=(playerId,rows)=>({id:'r'+playerId,eventId:'event',playerId,status:rows.some(r=>r.status==='confirmed')?'confirmed':'waitlist',sequence:1,arrival:start,departure:end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''},bookingSignups:rows});
 s.registrations=[reg('p1',[slot('A','confirmed',start,middle),slot('B','confirmed',middle,end)]),reg('p2',[slot('A','waitlist',start,middle)])];
 await seedAccountNoticeFixture(s);await api.save(s,'seed-booking-cancel',api.emptyState());
 const origin='https://club.example',signIn=id=>fixture.user=id?{userId:id,method:'password',displayName:'Fictional '+id}:null;
 const post=async(bookingId,key=crypto.randomUUID(),options={})=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:options.origin??origin,'Content-Type':'application/json'},body:JSON.stringify({action:options.action??'bookingCancel',payload:options.payload??{bookingId,eventId:'owned-other'},requestId:key,actor:fixture.user?.userId,revision:options.revision??(await api.load()).revision})}));
 signIn('owner');assert.equal((await api.GET(new Request(origin+'/api/club'))).status,200);
 signIn(null);assert.equal((await post('A')).status,401);
 signIn('outsider');const untouched=await api.load(),forbidden=await post('A');assert.equal(forbidden.status,403,await forbidden.clone().text());assert.deepEqual(await api.load(),untouched);
 signIn('creator');assert.equal((await post('A',crypto.randomUUID(),{origin:'https://attacker.example'})).status,403);
 database.injectFailure(query=>/DELETE FROM bookings/i.test(query));assert.equal((await post('A')).status,503);database.injectFailure(null);assert.deepEqual(await api.load(),untouched,'booking, signups, audit and revision roll back together');
 const key=crypto.randomUUID(),results=await Promise.all([post('A',key),post('A',key)]);assert.ok(results.every(r=>r.status===200||r.status===409),JSON.stringify(await Promise.all(results.map(async r=>({status:r.status,body:await r.clone().text()})))));assert.ok(results.some(r=>r.status===200));
 let current=await api.load();assert.deepEqual(current.bookings.map(b=>b.id).sort(),['B','C']);
 assert.equal(current.audits.filter(a=>a.action==='bookingCancel').length,1);assert.equal(current.registrations.find(r=>r.playerId==='p2').status,'cancelled');assert.equal(current.registrations.find(r=>r.playerId==='p1').bookingSignups.find(r=>r.bookingId==='B').status,'confirmed');
 const committed=structuredClone(current);assert.equal((await post('A',key)).status,200);assert.deepEqual(await api.load(),committed);
 const openedRevision=current.revision;
 assert.equal((await post('B',crypto.randomUUID(),{action:'courtRegister',payload:{bookingId:'B',playerId:'p1',arrival:middle,departure:end,note:'Changed after confirmation opened'}})).status,200);
 assert.equal((await post('C',crypto.randomUUID(),{revision:openedRevision})).status,409);assert.ok((await api.load()).bookings.some(b=>b.id==='C'));
 assert.equal((await post('C')).status,200);assert.equal((await post('B')).status,200);
 current=await api.load();assert.equal(current.bookings.length,0);assert.equal(current.events.length,2);assert.ok(current.registrations.every(r=>r.status==='cancelled'));
 const view=await (await api.GET(new Request(origin+'/api/club'))).json();assert.equal(view.bookings.length,0);assert.equal(view.drafts.find(x=>x.eventId==='event').total,0);
 console.log('PASS booking cancellation API: stored creator authority, forged event refusal, CSRF, atomic rollback, concurrent replay, stale confirmation, preserved other courts and zero cancelled-court fees');
}finally{database.close();delete globalThis.__bookingCancelTest}
