// Real handlers and transactional SQLite with fictional accounts only; no live requests.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
import {seedAccountNoticeFixture} from './helpers/account-notice.mjs';

mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__automaticCoinsApi={env:{},identity:new AsyncLocalStorage()};
await build({stdin:{contents:`export {GET,POST} from './app/api/club/route';export {load,save} from './lib/store';export {loadClubState} from './lib/club-maintenance';export {emptyState} from './lib/domain/types';export {activateAutomaticCoins,reconcileAutomaticCoins,pendingAutomaticCorrection} from './lib/domain/automatic-coins';export {treasureBalance} from './lib/domain/treasure-shop';export {coinEpoch,coinFixture,coinEvent,coinMatch,coinSignup} from './tests/helpers/automatic-coins-fixture';`,resolveDir:process.cwd(),loader:'ts'},outfile:'.test-output/automatic-coins-api.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'isolated-automatic-coins',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'automatic-coins'}));
 b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'automatic-coins'}));
 b.onLoad({filter:/.*/,namespace:'automatic-coins'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__automaticCoinsApi.env;':'export const getAppUser=async()=>globalThis.__automaticCoinsApi.identity.getStore()??null;export const passwordEnabled=async()=>true;'}));
}}]});
const db=sqliteD1();fixture.env.DB=db.db;
const api=await import(pathToFileURL(resolve('.test-output/automatic-coins-api.mjs')).href);
const originalNow=Date.now;let clock=api.coinEpoch;Date.now=()=>clock;
const identity=id=>({userId:id,method:'password',displayName:'Fictional '+id});
const origin='https://club.example';
const get=async(id,query='')=>fixture.identity.run(identity(id),()=>api.GET(new Request(origin+'/api/club'+query)));
const post=async(id,action,payload,requestId=crypto.randomUUID())=>{
 const revision=(await api.load()).revision;
 return fixture.identity.run(identity(id),()=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action,payload,requestId,revision,actor:id})})));
};
const saveChange=async(change)=>{const previous=await api.load(),next=structuredClone(previous);change(next);await api.save(next,'fictional-change:'+crypto.randomUUID(),previous)};
try{
 const s=api.coinFixture(),e=api.coinEvent(s,'ended-after-rollout'),old=api.coinEvent(s,'historical',clock-1);
 for(const event of [e,old]){for(const p of s.players)api.coinSignup(s,event,p.id);api.coinMatch(s,event,event.id+'-match',event===old?{a:['p4','p5'],b:['p6','p7']}:{})}
 api.activateAutomaticCoins(s,clock);await seedAccountNoticeFixture(s);await api.save(s,'fictional-seed',api.emptyState());
 // Before the end, a read may do other ordinary maintenance, but cannot award coins.
 await api.loadClubState();assert.equal(api.treasureBalance(await api.load(),'p0'),0);
 clock=e.end+1;
 // Four simultaneous authoritative loads must settle the same event exactly once.
 const results=await Promise.all(Array.from({length:4},()=>api.loadClubState()));assert.ok(results.every(r=>api.treasureBalance(r,'p0')===8));
 let stored=await api.load();assert.equal(api.treasureBalance(stored,'p0'),8);assert.equal(api.treasureBalance(stored,'p2'),5);assert.ok(stored.treasureRewardClaims.every(r=>r.eventId===e.id));
 const claimsCount=stored.treasureRewardClaims.length,ledgerCount=stored.treasureLedger.length,settledRevision=stored.revision;
 assert.ok(db.sql.prepare('SELECT COUNT(*) AS n FROM treasureRewardClaims').get().n>0,'Reward claims persist as real SQLite rows');
 for(let i=0;i<3;i++)await api.loadClubState();stored=await api.load();assert.equal(stored.revision,settledRevision);assert.equal(stored.treasureRewardClaims.length,claimsCount);assert.equal(stored.treasureLedger.length,ledgerCount);
 const ordinary=await get('member1');assert.equal(ordinary.status,200);const data=await ordinary.json();assert.equal(data.treasureShop.balance,8);assert.ok(data.treasureShop.ledger.every(r=>r.playerId==='p1'));assert.equal(data.treasureRewardClaims,undefined);assert.equal(data.treasureShop.rewardPolicy.activatedAt,api.coinEpoch);
 const owner=await (await get('owner')).json();assert.ok(owner.treasureShop.wallets.some(w=>w.playerId==='p0'&&w.balance===8));
 // Users cannot impersonate settlement or add untrusted automatic fields to a manual grant.
 const beforeForbidden=await api.load();const forbidden=await post('member1','treasureGrant',{playerId:'p1',amount:500,reason:'Forged award'});assert.equal(forbidden.status,403);assert.deepEqual(await api.load(),beforeForbidden);
 const forged=await post('owner','treasureGrant',{playerId:'p0',amount:500,reason:'Forged award',kind:'automatic_reward',eventId:e.id});assert.equal(forged.status,400);assert.deepEqual(await api.load(),beforeForbidden);
 // Manual ranking changes do not mint automatic currency. The round rewards are independent.
 const manual=await post('owner','grantPoints',{playerId:'p0',period:'2035-01',points:100,reason:'Fictional manual points'});assert.equal(manual.status,200,await manual.clone().text());assert.equal(api.treasureBalance(await api.load(),'p0'),8);
 await saveChange(next=>{const m=next.matches.find(m=>m.eventId===e.id);m.games=[{a:19,b:21}];m.scoreA=19;m.scoreB=21});
 const beforeCorrection=await api.load();
 db.injectFailure(query=>/INSERT INTO treasureLedger\(/i.test(query));
 await assert.rejects(()=>api.loadClubState(),/Injected database failure/);assert.deepEqual(await api.load(),beforeCorrection,'Reward claims and wallet corrections roll back together');db.injectFailure(null);
 await Promise.all(Array.from({length:3},()=>api.loadClubState()));stored=await api.load();assert.equal(api.treasureBalance(stored,'p0'),5);assert.equal(api.treasureBalance(stored,'p2'),8);assert.equal(api.pendingAutomaticCorrection(stored,'p0'),0);
 const correctionRevision=stored.revision;await api.loadClubState();assert.equal((await api.load()).revision,correctionRevision);
 // A normal score correction and its automatic coins must commit or roll back together.
 const target=stored.matches.find(m=>m.eventId===e.id),scorePayload={matchId:target.id,expectedA:target.a,expectedB:target.b,expectedGames:target.games,a:21,b:19,games:[{a:21,b:19}],reason:'Fictional recorded score correction'},scoreId=crypto.randomUUID();
 db.injectFailure(query=>/INSERT INTO treasureLedger\(/i.test(query));const failedScore=await post('owner','score',scorePayload,scoreId);assert.equal(failedScore.status,503);db.injectFailure(null);assert.deepEqual(await api.load(),stored,'Score and reward correction cannot split across transactions');
 const savedScore=await post('owner','score',scorePayload,scoreId);assert.equal(savedScore.status,200,await savedScore.clone().text());stored=await api.load();assert.equal(api.treasureBalance(stored,'p0'),8);assert.equal(api.treasureBalance(stored,'p2'),5);
 const replayedScore=await post('owner','score',scorePayload,scoreId);assert.equal(replayedScore.status,200);assert.deepEqual(await api.load(),stored,'Replaying a saved score cannot award currency twice');
 // The store optimistic revision gate also blocks lost updates from separately loaded workers.
 await saveChange(next=>{const m=next.matches.find(m=>m.eventId===e.id);m.status='cancelled'});
 const snapshots=await Promise.all([api.load(),api.load()]),writes=snapshots.map((previous,i)=>{const next=structuredClone(previous);api.reconcileAutomaticCoins(next,clock);return api.save(next,'fictional-competing-worker:'+i,previous)});
 const competing=await Promise.allSettled(writes);assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);assert.equal(competing.filter(r=>r.status==='rejected').length,1);
 stored=await api.load();assert.equal(api.treasureBalance(stored,'p0'),5);assert.equal(api.treasureBalance(stored,'p2'),5);
 assert.equal(await api.reconcileAutomaticCoins(stored,clock),false);
 const memberExport=await get('member1','?export=1');assert.equal(memberExport.status,403);
 await saveChange(next=>{next.accounts.find(a=>a.id==='member2').role='admin'});
 const adminExport=await get('member2','?export=1');assert.equal(adminExport.status,200);const exported=await adminExport.json();assert.ok((exported.treasureRewardClaims??[]).every(r=>r.playerId==='p2'),'Non-owner export must not disclose others reward claims');
 assert.deepEqual(exported.settings.automaticCoins.excludedEventIds,[],'Non-owner exports must not reveal private historical activity IDs');assert.ok((await api.load()).settings.automaticCoins.excludedEventIds.includes(old.id),'Filtering an export must not mutate authoritative rollout exclusions');
 // Reloaded debt must survive a genuine redemption and independent manual funding.
 await saveChange(next=>{const m=next.matches.find(m=>m.eventId===e.id);m.status='complete';m.games=[{a:21,b:19}];m.scoreA=21;m.scoreB=19});await api.loadClubState();
 const productResponse=await post('owner','treasureProduct',{name:'Fictional debt gift',description:'',price:8,stock:1,kind:'physical',active:true});assert.equal(productResponse.status,200);
 const product=(await api.load()).treasureProducts.find(p=>p.name==='Fictional debt gift');assert.ok(product);
 const redemption=await post('owner','treasureRedeem',{productId:product.id,expectedPrice:8,quantity:1});assert.equal(redemption.status,200,await redemption.clone().text());assert.equal(api.treasureBalance(await api.load(),'p0'),0);
 await saveChange(next=>{next.events.find(event=>event.id===e.id).status='cancelled'});await api.loadClubState();stored=await api.load();assert.equal(api.pendingAutomaticCorrection(stored,'p0'),8);
 const manualCoins=await post('owner','treasureGrant',{playerId:'p0',amount:20,reason:'Fictional independent manual coins'});assert.equal(manualCoins.status,200);await api.loadClubState();stored=await api.load();assert.equal(api.treasureBalance(stored,'p0'),20);assert.equal(api.pendingAutomaticCorrection(stored,'p0'),8);
 await saveChange(next=>{const future=api.coinEvent(next,'debt-offset-first',clock+100);api.coinSignup(next,future,'p0')});clock+=101;await api.loadClubState();stored=await api.load();assert.equal(api.treasureBalance(stored,'p0'),20);assert.equal(api.pendingAutomaticCorrection(stored,'p0'),3);
 await saveChange(next=>{const future=api.coinEvent(next,'debt-offset-second',clock+100);api.coinSignup(next,future,'p0')});clock+=101;await api.loadClubState();stored=await api.load();assert.equal(api.treasureBalance(stored,'p0'),22);assert.equal(api.pendingAutomaticCorrection(stored,'p0'),0);
 await saveChange(next=>{next.events.find(event=>event.id==='debt-offset-first').status='cancelled'});await api.loadClubState();stored=await api.load();assert.equal(api.treasureBalance(stored,'p0'),20,'Revoking an earlier debt offset cannot consume later independent manual funds');assert.equal(api.pendingAutomaticCorrection(stored,'p0'),3);
 // A genuinely missing rollout policy initializes exactly once under racing first reads.
 const firstVisitDb=sqliteD1();fixture.env.DB=firstVisitDb.db;
 try{
  const firstVisit=api.coinFixture(),historical=api.coinEvent(firstVisit,'pre-feature-history',clock-1),future=api.coinEvent(firstVisit,'post-feature-future',clock+3600000,{start:clock+1000});
  api.coinSignup(firstVisit,historical,'p0');api.coinMatch(firstVisit,historical,'historical-result');api.coinSignup(firstVisit,future,'p0');
  await seedAccountNoticeFixture(firstVisit);await api.save(firstVisit,'fictional-first-visit',api.emptyState());const beforeActivation=await api.load();assert.equal(beforeActivation.settings.automaticCoins,undefined);
  const initialized=await Promise.all(Array.from({length:4},()=>api.loadClubState()));
  const afterActivation=await api.load();assert.equal(afterActivation.revision,beforeActivation.revision+1);assert.equal(afterActivation.settings.automaticCoins.activatedAt,clock);assert.deepEqual(afterActivation.settings.automaticCoins.excludedEventIds,[historical.id]);
  assert.ok(initialized.every(s=>s.revision===afterActivation.revision));assert.equal(api.treasureBalance(afterActivation,'p0'),0);assert.equal(afterActivation.treasureRewardClaims.length,0);assert.equal(afterActivation.treasureLedger.length,0);
  await api.loadClubState();assert.equal((await api.load()).revision,afterActivation.revision,'Repeated first-visit reconciliation must not recreate its activation');
  // Historical wins establish the streak, but only the post-rollout activity receives currency.
  await saveChange(next=>{api.coinMatch(next,next.events.find(event=>event.id===future.id),'future-streak-result')});clock=future.end+1;await api.loadClubState();
  const withStreak=await api.load();assert.equal(api.treasureBalance(withStreak,'p0'),9);assert.equal(withStreak.treasureRewardClaims.find(row=>row.playerId==='p0'&&row.matchId==='future-streak-result').amount,4);assert.ok(withStreak.treasureRewardClaims.every(row=>row.eventId===future.id));
  const oldResult=withStreak.matches.find(match=>match.id==='historical-result'),historicCorrection={matchId:oldResult.id,expectedA:oldResult.a,expectedB:oldResult.b,expectedGames:oldResult.games,a:19,b:21,games:[{a:19,b:21}],reason:'Fictional earlier streak correction'};
  const correctedHistory=await post('owner','score',historicCorrection);assert.equal(correctedHistory.status,200,await correctedHistory.clone().text());
  const recalculated=await api.load();assert.equal(api.treasureBalance(recalculated,'p0'),8);assert.equal(recalculated.treasureRewardClaims.find(row=>row.playerId==='p0'&&row.matchId==='future-streak-result').amount,3);assert.ok(recalculated.treasureRewardClaims.every(row=>row.eventId===future.id));
  await api.loadClubState();assert.equal((await api.load()).revision,recalculated.revision,'Recomputed streak reward is persistent and idempotent');
 }finally{fixture.env.DB=db.db;firstVisitDb.close()}
 console.log('PASS automatic coins API: actual SQLite reward claims and ledgers, after-end settlement, historical cutoff, maintenance races, idempotence, exclusions, privacy, atomic rollback and revision conflict safety');
}finally{db.injectFailure(null);db.close();Date.now=originalNow;delete globalThis.__automaticCoinsApi}
