// Actual account route and store on isolated transactional SQLite; fictional club only.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {sqliteD1} from './helpers/sqlite-d1.mjs';

mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__friendToMemberTest={env:{},user:null};
writeFileSync('.test-output/friend-to-member-entry.ts',`export {POST} from '../app/api/auth/route';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';`);
await build({entryPoints:['.test-output/friend-to-member-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/friend-to-member-api.mjs',plugins:[{name:'isolated-account-auth',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'friend-member'}));
 b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'friend-member'}));
 b.onResolve({filter:/(?:^|\/)lib\/auth$/},()=>({path:'auth',namespace:'friend-member'}));
 b.onLoad({filter:/.*/,namespace:'friend-member'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__friendToMemberTest.env;'
  :a.path==='headers'?'export async function cookies(){return {get(){},set(){},delete(){}}}export async function headers(){return new Headers()}'
  :"export const sessionCookie='yulin_session';export async function hashToken(t){return t}export const getAppUser=async()=>globalThis.__friendToMemberTest.user;export const passwordEnabled=async()=>false;"}));
}}]});
const database=sqliteD1();fixture.env.DB=database.db;
const api=await import(pathToFileURL(resolve('.test-output/friend-to-member-api.mjs')).href);
const origin='https://club.example',password='fictional-member-password-123';
const post=body=>api.POST(new Request(origin+'/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','cf-connecting-ip':'203.0.113.81'},body:JSON.stringify(body)}));
try{
 const empty=api.emptyState(),s=api.emptyState(),week=7*86400000,start=Date.now()-3*week;
 Object.assign(s.settings,{initialized:true,ownerAccountId:'owner'});
 s.accounts=[{id:'owner',email:'',role:'admin',playerId:'p0'},{id:'host',email:'',role:'member',playerId:'p1'},{id:'m2',email:'',role:'member',playerId:'p2'},{id:'m3',email:'',role:'member',playerId:'p3'}];
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 const event=(id,at)=>({id,creatorId:'owner',title:'Fictional '+id,start:at,end:at+7200000,venue:'Fictional venue',address:'',capacity:8,signupDeadline:at,cancelDeadline:at-86400000,status:'ended',note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'});
 s.events=[event('one',start),event('two',start+week)];
 // The same fictional friend, brought twice by one member: a guest record per activity.
 for(const [i,e] of s.events.entries()){
  s.bookings.push({id:'court-'+i,eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:1200});
  s.players.push({id:'friend-'+i,name:'aq',ownerId:'host',guestEventId:e.id,guestGender:'female',guestLevels:[{at:e.start-86400000,level:1150}],initialRating:1150,rating:1150,ratedGames:0,enabled:true,ratingReason:''});
  s.registrations.push({id:'reg-'+i,eventId:e.id,playerId:'friend-'+i,sequence:1,status:'confirmed',arrival:e.start,departure:e.end,registeredAt:e.start-86400000,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 s.rounds.push({id:'round',eventId:'one',start:start+600000,duration:15,status:'complete',eligible:['friend-0','p1','p2','p3'],rest:[],seed:1});
 s.matches.push({id:'game',eventId:'one',roundId:'round',courtId:'court-0',a:['friend-0','p1'],b:['p2','p3'],status:'complete',start:start+600000,end:start+1500000,scoreA:21,scoreB:15,games:[{a:21,b:15}],locked:false,monthly:true,elo:true});
 await api.save(s,'seed',empty);
 const create=(requestId,extra={})=>post({action:'createAccount',name:'Aqing',username:'aqing',password,requestId,playerId:'friend-1',...extra});
 fixture.user={userId:'host',method:'password',displayName:'Fictional host'};
 {const denied=await create(crypto.randomUUID());assert.equal(denied.status,403,await denied.clone().text());}
 fixture.user={userId:'owner',method:'password',displayName:'Fictional owner'};
 const requestId=crypto.randomUUID(),r=await create(requestId);assert.equal(r.status,200,await r.clone().text());
 const {accountId}=await r.json(),after=await api.load();
 assert.deepEqual(after.accounts.find(a=>a.id===accountId),{id:accountId,email:'',role:'member',playerId:'friend-1'});
 assert.equal(after.players.some(p=>p.id==='friend-0'),false,'the older record is merged into the member');
 const member=after.players.find(p=>p.id==='friend-1');assert.equal(member.name,'Aqing');assert.equal(member.ownerId,accountId);assert.equal(member.guestEventId,undefined);assert.equal(member.initialRating,1150);
 assert.deepEqual(after.registrations.map(r=>r.playerId),['friend-1','friend-1']);assert.deepEqual(after.matches[0].a,['friend-1','p1']);
 assert.ok(after.ratingChanges.some(c=>c.playerId==='friend-1'),'the past game is rated for the member');
 const audit=after.audits.find(a=>a.action==='createLoginAccount');assert.equal(audit.reason,'临时来宾转为正式道友');assert.deepEqual(audit.changes.mergedPlayerIds,['friend-0']);
 assert.ok(database.db.prepare('SELECT id FROM password_credentials WHERE username=?').bind('aqing').first(),'the login exists');
 const again=await create(requestId);assert.equal(again.status,200);assert.equal((await again.json()).duplicate,true,'a retry creates nothing more');
 assert.equal((await api.load()).accounts.length,after.accounts.length);
 const twice=await post({action:'createAccount',name:'Aqing',username:'aqing2',password,requestId:crypto.randomUUID(),playerId:'friend-1'});assert.equal(twice.status,409,'the member cannot be claimed twice');
 console.log('PASS friend to member API: administrator only, one member from every record of the friend, rated history, audit, login, retry and second claim refused');
}finally{database.close?.()}
