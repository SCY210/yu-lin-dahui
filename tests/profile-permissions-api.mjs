import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {sqliteD1} from './helpers/sqlite-d1.mjs';

mkdirSync('.test-output',{recursive:true});
const db=sqliteD1(),fixture=globalThis.__profilePolicyTest={actor:'restricted',writes:0,deletes:0,reservations:0,env:{DB:db.db,PROFILE_GENDER_ONLY_PLAYER_IDS:'["restricted-player"]'}};
fixture.env.BUCKET={async put(){fixture.writes++},async delete(){fixture.deletes++}};
await build({stdin:{contents:`export {POST as command,GET as read} from './app/api/club/route';export {POST as upload} from './app/api/photos/route';export {POST as remove} from './app/api/photos/[id]/route';export {load,save} from './lib/store';export {emptyState} from './lib/domain/types';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-output/profile-policy-api.mjs',plugins:[{name:'isolated-profile-policy',setup(builder){
 builder.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'profile-test'}));
 builder.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'profile-test'}));
 builder.onResolve({filter:/(?:^|\/)rate-limit$/},()=>({path:'rates',namespace:'profile-test'}));
 builder.onLoad({filter:/.*/,namespace:'profile-test'},({path})=>({loader:'js',contents:path==='env'?'export const env=globalThis.__profilePolicyTest.env;':path==='auth'?'export const getAppUser=async()=>({userId:globalThis.__profilePolicyTest.actor,method:"password",username:"fictional",displayName:"Fictional",email:""});':'export const cleanExpiredRateLimits=async()=>{};export const consumeRateLimit=async()=>{};export const reserveDailyCreation=async()=>{};export const reserveUploadBytes=async()=>{globalThis.__profilePolicyTest.reservations++};export const trustedClientIP=()=>"unavailable";export class RateLimitError extends Error {}'}));
}}]});
const api=await import(pathToFileURL(resolve('.test-output/profile-policy-api.mjs')).href),origin='https://club.example';
const request=(path,body)=>new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
async function command(action,payload){const s=await api.load();return api.command(request('/api/club',{action,payload,revision:s.revision,requestId:crypto.randomUUID()}));}
const read=token=>api.read(new Request(origin+'/api/club?month=2026-10&year=2026',{headers:token?{'If-None-Match':token}:{}}));
async function upload(kind,playerId){const state=await api.load(),form=new FormData();form.set('kind',kind);form.set('playerId',playerId);form.set('rightsConfirmed','true');form.set('revision',String(state.revision));form.set('requestId',crypto.randomUUID());form.set('file',new Blob([readFileSync('tests/fixtures/shuttlecock.png')],{type:'image/png'}),'fictional.png');return api.upload(new Request(origin+'/api/photos',{method:'POST',headers:{origin},body:form}));}
try{
 const s=api.emptyState(),previous=structuredClone(s);s.settings={...s.settings,initialized:true,ownerAccountId:'owner',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',progressionVersion:'weekly-v2'};
 for(const id of ['owner','restricted','other','administrator']){s.accounts.push({id,email:'',role:id==='owner'||id==='administrator'?'admin':'member',playerId:id+'-player'});s.players.push({id:id+'-player',ownerId:id,name:'Fictional '+id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'',profile:{gender:'undisclosed',years:5,hand:'left',preference:'mixed',style:'existing',equipment:'existing',racket:'existing'}})}
 for(const kind of ['avatar','racket'])s.photos.push({id:kind,key:'fixture/'+kind,kind,eventId:null,matchId:null,playerIds:['restricted-player'],ownerId:'restricted',caption:'existing',created:1,type:'image/png',size:1});s.players[1].avatarId='avatar';
 await api.save(s,'fixture-seed',previous);
 const first=await read();assert.equal(first.status,200);const token=first.headers.get('ETag'),view=await first.json();assert.equal(view.players.find(p=>p.id==='restricted-player').profileEditMode,'gender-only');assert.ok(view.photos.every(p=>!p.canDelete));assert.equal((await read(token)).status,304);
 delete fixture.env.PROFILE_GENDER_ONLY_PLAYER_IDS;const changed=await read(token);assert.equal(changed.status,200);assert.equal((await changed.json()).players.find(p=>p.id==='restricted-player').profileEditMode,'full');fixture.env.PROFILE_GENDER_ONLY_PLAYER_IDS='["restricted-player"]';
 const before=await api.load();assert.equal((await command('profileGender',{playerId:'restricted-player',gender:'other',reason:'Routine form audit metadata'})).status,200);let after=await api.load();assert.deepEqual(after.players[1].profile,{...before.players[1].profile,gender:'other'});assert.equal(after.players[1].avatarId,'avatar');
 assert.equal((await command('profileGender',{playerId:'restricted-player',gender:'male',name:'injected'})).status,400);
 for(const actor of ['restricted','administrator']){
  fixture.actor=actor;
  assert.equal((await command('profileDetails',{playerId:'restricted-player',gender:'male',years:9,hand:'right',preference:'all',style:'changed',equipment:'changed',racket:'changed',isOwner:true})).status,403);
  assert.equal((await command('profile',{playerId:'restricted-player',name:'changed'})).status,403);
  for(const kind of ['avatar','racket']){
   assert.equal((await upload(kind,'restricted-player')).status,403);
   const revision=(await api.load()).revision;assert.equal((await api.remove(request('/api/photos/'+kind,{action:'delete',requestId:crypto.randomUUID(),revision}),{params:Promise.resolve({id:kind})})).status,403);
  }
 }
 assert.equal(fixture.writes,0);assert.equal(fixture.deletes,0);assert.equal(fixture.reservations,0);after=await api.load();assert.equal(after.photos.length,2);assert.equal(after.players[1].name,'Fictional restricted');assert.deepEqual(after.players[1].profile,{...before.players[1].profile,gender:'other'});
 assert.equal(db.sql.prepare('SELECT payload FROM players WHERE id=?').get('restricted-player').payload.includes('profileRestrictions'),false);
 fixture.actor='owner';const ownerView=await (await read()).json();assert.equal(ownerView.players.find(p=>p.id==='restricted-player').profileEditMode,'full');assert.ok(ownerView.photos.every(p=>p.canDelete));assert.equal(ownerView.accounts.find(a=>a.id==='restricted').canEditProfileName,true);
 assert.equal((await command('profileDetails',{playerId:'restricted-player',gender:'female',years:7,hand:'right',preference:'all',style:'owner edited',equipment:'owner edited',racket:'owner edited'})).status,200);
 assert.equal((await command('profile',{playerId:'restricted-player',name:'Owner edited name'})).status,200);
 for(const kind of ['avatar','racket']){assert.equal((await upload(kind,'restricted-player')).status,200);const revision=(await api.load()).revision;assert.equal((await api.remove(request('/api/photos/'+kind,{action:'delete',requestId:crypto.randomUUID(),revision}),{params:Promise.resolve({id:kind})})).status,200)}
 assert.equal(fixture.writes,2);assert.equal(fixture.deletes,2);assert.equal(fixture.reservations,2);
 fixture.actor='restricted';assert.equal((await upload('avatar','restricted-player')).status,403);
 fixture.actor='other';assert.equal((await command('profileGender',{playerId:'restricted-player',gender:'male'})).status,403);assert.equal((await upload('avatar','other-player')).status,200);assert.equal(fixture.writes,3);assert.equal(fixture.reservations,3);
 console.log('PASS profile policy API: runtime stable-ID policy, cache invalidation without revision changes, strict gender-only writes, blocked full profile/name/avatar/racket upload and deletion for members/non-owner admins; verified owner edits and media management allowed, no quota/R2 writes on denial, preserved records and unaffected other members.');
}finally{db.close();delete globalThis.__profilePolicyTest}
