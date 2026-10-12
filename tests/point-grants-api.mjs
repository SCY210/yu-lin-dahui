import {seedAccountNoticeFixture} from './helpers/account-notice.mjs';
// Real API/store against isolated in-memory SQLite; no production grants.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__grantsTest={env:{},user:null};
writeFileSync('.test-output/grants-entry.ts',`export {GET,POST} from '../app/api/club/route';export {load,save,committed} from '../lib/store';export {emptyState} from '../lib/domain/types';`);
await build({entryPoints:['.test-output/grants-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/grants-api-bundle.mjs',plugins:[{name:'isolated-grants',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'grants-fixture'}));b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'grants-fixture'}));b.onLoad({filter:/.*/,namespace:'grants-fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__grantsTest.env;':'export const getAppUser=async()=>globalThis.__grantsTest.user;export const passwordEnabled=async()=>true;',loader:'js'}))}}]});
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function statement(query,parameters=[]){return {query,parameters,bind(...args){return statement(query,args)},async first(){return sql.prepare(query).get(...parameters)??null},async all(){return {results:sql.prepare(query).all(...parameters)}},async run(){const r=sql.prepare(query).run(...parameters);return {meta:{changes:Number(r.changes)},results:[]}}}}
fixture.env.DB={prepare:statement,async batch(list){sql.exec('BEGIN');try{const values=list.map(s=>/^SELECT/i.test(s.query.trim())?{results:sql.prepare(s.query).all(...s.parameters)}:{meta:{changes:Number(sql.prepare(s.query).run(...s.parameters).changes)},results:[]});sql.exec('COMMIT');return values}catch(e){sql.exec('ROLLBACK');throw e}}};
const api=await import(pathToFileURL(resolve('.test-output/grants-api-bundle.mjs')).href);
try{
 const initial=api.emptyState(),s=api.emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';s.settings.progressionVersion='weekly-v2';s.settings.realmVersion='elo-v1';s.settings.rankingVersion='signed-v1';s.settings.scoringPolicy='all-ranked-v1';s.settings.strengthVersion='realm-elo-v2';
 s.accounts=['owner','admin','member'].map((id,i)=>({id,email:'',role:i<2?'admin':'member',playerId:'p'+i}));s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));await seedAccountNoticeFixture(s);await api.save(s,'seed',initial);
 const origin='https://club.example',payload={playerId:'p2',period:'2026-10',points:25,reason:"组织奖励 '); DROP TABLE players; --"};
 const user=id=>fixture.user=id?{userId:id,displayName:id,method:'password'}:null;
 const post=(body,extra={})=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body:JSON.stringify(body)}));
 const command=(revision,requestId=crypto.randomUUID(),values=payload)=>({action:'grantPoints',payload:values,revision,requestId});
 user(null);assert.equal((await post(command(s.revision))).status,401);
 for(const id of ['admin','member']){user(id);assert.equal((await post(command(s.revision,undefined,{...payload,isOwner:true,actor:'owner'}))).status,403)}
 user('owner');assert.equal((await post(command(s.revision),{Origin:'https://attacker.invalid'})).status,403);
 assert.equal((await post(command(s.revision,undefined,{...payload,points:-1001}))).status,400);
 assert.equal((await post(command(s.revision-1))).status,409);
 const body=command(s.revision);assert.equal((await post(body)).status,200);assert.equal((await post(body)).status,200);
 const stored=await api.load();assert.equal(stored.audits.filter(a=>a.action==='grantPoints').length,1);assert.equal(stored.revision,s.revision+1);assert.equal(stored.players.length,3);assert.equal(stored.audits[0].changes.reason,payload.reason);
 assert.equal(await api.committed('owner:'+body.requestId),true);
 const rollback=structuredClone(stored);rollback.audits.push({...stored.audits[0],id:crypto.randomUUID()});await assert.rejects(()=>api.save(rollback,'owner:'+body.requestId,stored),/UNIQUE/);assert.equal((await api.load()).audits.length,1);
 const get=()=>api.GET(new Request(origin+'/api/club?month=2026-10&year=2026'));
 const read=await get(),view=await read.json(),etag=read.headers.get('ETag');assert.equal(view.quarterlyLeaderboard.find(r=>r.playerId==='p2').points,25);assert.equal(view.pointGrants.length,1);
 const concurrent=await Promise.all([post(command(stored.revision)),post(command(stored.revision))]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 assert.equal((await api.load()).audits.length,2);const revalidate=await api.GET(new Request(origin+'/api/club?month=2026-10&year=2026',{headers:{'If-None-Match':etag}}));assert.equal(revalidate.status,200);assert.equal((await revalidate.json()).quarterlyLeaderboard.find(r=>r.playerId==='p2').points,50);
 user('member');const member=await (await get()).json();assert.deepEqual(member.pointGrants,[]);assert.equal(member.quarterlyLeaderboard.find(r=>r.playerId==='p2').manualPoints,50);assert.equal(member.quarterlyLeaderboard.find(r=>r.playerId==='p2').games,0);
 const beforeDeduction=await api.load();for(const id of ['admin','member']){user(id);assert.equal((await post(command(beforeDeduction.revision,undefined,{...payload,points:-75}))).status,403)}
 user('owner');const deduction=command(beforeDeduction.revision,undefined,{...payload,points:-75,reason:'纠正积分'});assert.equal((await post(deduction)).status,200);assert.equal((await post(deduction)).status,200);
 const deducted=await api.load();assert.equal(deducted.audits.length,3);assert.equal(deducted.audits.at(-1).changes.points,-75);assert.equal(deducted.audits.at(-1).actor,'owner');const deductionView=await (await get()).json();for(const rows of [deductionView.quarterlyLeaderboard,deductionView.annualLeaderboard])assert.equal(rows.find(r=>r.playerId==='p2').points,-25);assert.equal(deductionView.pointGrants.length,3);
 const rollbackDeduction=structuredClone(deducted);rollbackDeduction.audits.push({...deducted.audits.at(-1),id:crypto.randomUUID()});await assert.rejects(()=>api.save(rollbackDeduction,'owner:'+deduction.requestId,deducted),/UNIQUE/);assert.equal((await api.load()).audits.length,3);

 user('member');const ownBonuses=(await (await get()).json()).me.bonusNotices;assert.equal(ownBonuses.length,2);const beforeBonus=await api.load(),ack={action:'bonusSeen',payload:{ids:ownBonuses.map(n=>n.id)},revision:beforeBonus.revision,requestId:crypto.randomUUID()};assert.equal((await post(ack)).status,200);assert.equal((await post(ack)).status,200);const afterBonus=await api.load();assert.deepEqual(afterBonus.accounts.find(a=>a.id==='member').bonusSeen,ownBonuses.map(n=>n.id));assert.deepEqual(afterBonus.accounts.find(a=>a.id==='owner'),beforeBonus.accounts.find(a=>a.id==='owner'));assert.deepEqual(afterBonus.audits,beforeBonus.audits);assert.deepEqual((await (await get()).json()).me.bonusNotices,[]);

 const ratingBody=command(deducted.revision,undefined,{playerId:'p2',period:'2026-10',points:0,rating:125,reason:'Owner manual rating increase'});
 assert.equal((await post(ratingBody)).status,200);assert.equal((await post(ratingBody)).status,200);
 const raised=await api.load();assert.equal(raised.audits.length,4);assert.equal(raised.players.find(p=>p.id==='p2').rating,1125);assert.deepEqual(raised.matches,deducted.matches);
 const raisedView=await (await get()).json();assert.equal(raisedView.social.stats.find(p=>p.playerId==='p2').realmScore.score,1125);assert.equal(raisedView.social.stats.find(p=>p.playerId==='p2').realmScore.ratedGames,0);
 assert.equal(raisedView.quarterlyLeaderboard.find(p=>p.playerId==='p2').points,-25);assert.equal(raisedView.pointGrants.at(-1).points,0);
 user('member');const memberRating=await (await get()).json();assert.equal(memberRating.social.stats.find(p=>p.playerId==='p2').realmScore.score,1125);assert.deepEqual(memberRating.pointGrants,[]);
 for(const id of ['admin','member']){user(id);assert.equal((await post(command(raised.revision,undefined,{...ratingBody.payload,isOwner:true}))).status,403)}
 user('owner');const rollbackRating=command(raised.revision,undefined,{...ratingBody.payload,rating:50}),batch=fixture.env.DB.batch;fixture.env.DB.batch=async()=>{throw new Error('Injected rating failure')};
 assert.equal((await post(rollbackRating)).status,503);fixture.env.DB.batch=batch;assert.deepEqual(await api.load(),raised);assert.equal((await post(rollbackRating)).status,200);
 assert.equal((await api.load()).players.find(p=>p.id==='p2').rating,1175);
 console.log('PASS grants API: stored-owner authorization, rating-only persistence and visible score, unchanged points/games, deduplication, rollback, SQL binding and private ledger');

}finally{sql.close();delete globalThis.__grantsTest}
