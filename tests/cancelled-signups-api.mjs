// Actual cancellation handlers and projection, backed by isolated SQLite only.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__cancelledSignupTest={env:{},user:null};
writeFileSync('.test-output/cancelled-signups-entry.ts',"export {GET,POST} from '../app/api/club/route';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';");
await build({entryPoints:['.test-output/cancelled-signups-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/cancelled-signups-api.mjs',plugins:[{name:'isolated-cancellation-auth',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'cancel-test'}));b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'cancel-test'}));
 b.onLoad({filter:/.*/,namespace:'cancel-test'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__cancelledSignupTest.env;':'export const getAppUser=async()=>globalThis.__cancelledSignupTest.user;export const passwordEnabled=async()=>true;'}));
}}]});
const database=sqliteD1();fixture.env.DB=database.db;
const api=await import(pathToFileURL(resolve('.test-output/cancelled-signups-api.mjs')).href);
try{
 const s=api.emptyState(),now=Date.now(),start=Math.ceil((now+3*86400000)/1800000)*1800000,hour=3600000;
 Object.assign(s.settings,{initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=['owner','host','m2','m3'].map((id,i)=>({id,email:'',playerId:'p'+i,role:i?'member':'admin'}));s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 const event=(id,at)=>({id,creatorId:'host',title:'Fictional '+id,start:at,end:at+2*hour,venue:'Fictional venue',address:'',capacity:4,signupDeadline:at-2*hour,cancelDeadline:at-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'});
 const lateStart=Math.ceil((now+12*hour)/1800000)*1800000;s.events=[event('e',start),event('late',lateStart)];
 s.bookings=[{id:'c1',eventId:'e',name:'First',start,end:start+hour,pricing:'total',cents:1200},{id:'c2',eventId:'e',name:'Second',start:start+hour,end:start+2*hour,pricing:'total',cents:1200},{id:'late-court',eventId:'late',name:'Late',start:lateStart,end:lateStart+2*hour,pricing:'total',cents:1200}];
 await api.save(s,'seed',api.emptyState());const origin='https://club.example',signIn=id=>fixture.user={userId:id,method:'password',displayName:'Fictional '+id};
 const post=async(action,payload,requestId=crypto.randomUUID())=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action,payload,requestId,actor:fixture.user.userId,revision:(await api.load()).revision})}));
 const view=async()=>{const r=await api.GET(new Request(origin+'/api/club'));assert.equal(r.status,200);return r.json()};
 const join=(bookingId,playerId)=>{const b=s.bookings.find(b=>b.id===bookingId);return post('courtRegister',{bookingId,playerId,arrival:b.start,departure:b.end,note:''})};
 const cancel=(bookingId,playerId,reason='取消报名',key)=>post('courtCancel',{bookingId,playerId,reason},key);
 signIn('m2');assert.equal((await join('c1','p2')).status,200);assert.equal((await join('c2','p2')).status,200);
 assert.equal((await cancel('c1','p2','Only the later slot')).status,200);let rows=(await view()).registrations;assert.ok(!('cancellation' in rows.find(r=>r.playerId==='p2')),'partial court cancellation is not a full withdrawal');
 const key=crypto.randomUUID();assert.equal((await cancel('c2','p2','Schedule changed',key)).status,200);const saved=(await api.load()).registrations.find(r=>r.playerId==='p2');assert.equal(saved.cancelledBy,'m2');assert.equal(saved.cancelledAs,'self');
 assert.equal((await cancel('c2','p2','Schedule changed',key)).status,200);assert.equal((await api.load()).registrations.find(r=>r.playerId==='p2').cancelledAt,saved.cancelledAt);
 signIn('m3');let projected=await view(),row=projected.registrations.find(r=>r.playerId==='p2');assert.equal(row.cancellation.reason,'Schedule changed');assert.equal(row.cancellation.by,'self');assert.deepEqual(projected.audits,[]);
 for(const field of ['cancelledAt','cancelledBy','cancelledAs','cancelReason'])assert.ok(!(field in row));
 signIn('m2');assert.equal((await join('c1','p2')).status,200);row=(await view()).registrations.find(r=>r.playerId==='p2');assert.ok(!('cancellation' in row));assert.equal((await api.load()).registrations.find(r=>r.playerId==='p2').cancelledAs,undefined);
 signIn('m3');assert.equal((await join('late-court','p3')).status,200);assert.equal((await cancel('late-court','p3','Request because plans changed')).status,200);row=(await view()).registrations.find(r=>r.playerId==='p3');assert.equal(row.cancelRequested,true);assert.ok(!('cancellation' in row));
 signIn('m2');assert.equal((await cancel('late-court','p3')).status,403);signIn('host');assert.equal((await post('courtCancel',{bookingId:'late-court',playerId:'p3',reason:'Approved by host',cancelledBy:'forged'})).status,200);
 signIn('m2');row=(await view()).registrations.find(r=>r.playerId==='p3');assert.equal(row.cancellation.by,'organizer');assert.equal(row.cancellation.byName,'Fictional host');assert.equal((await api.load()).registrations.find(r=>r.playerId==='p3').cancelledBy,'host');
 assert.equal((await post('friendSignup',{mode:'new',name:'Fictional invited guest',bookingId:'c2',arrival:start+hour,departure:start+2*hour,note:''})).status,200);const guest=(await api.load()).players.find(p=>p.name==='Fictional invited guest');assert.equal((await cancel('c2',guest.id)).status,200);row=(await view()).registrations.find(r=>r.playerId===guest.id);assert.equal(row.cancellation.by,'registrant');assert.ok(!('reason' in row.cancellation),'automatic reasons stay hidden');
 const before=await api.load();database.injectFailure(query=>/INSERT INTO registrations\(/i.test(query));assert.equal((await cancel('c1','p2','Rollback check')).status,503);database.injectFailure(null);assert.deepEqual(await api.load(),before);
 console.log('PASS cancelled signups API: persisted actor snapshot/reason, partial and pending exclusion, host approval, member-safe projection, guest attribution, request replay, re-signup clearing and transaction rollback');
}finally{database.close();delete globalThis.__cancelledSignupTest}
