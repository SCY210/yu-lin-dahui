import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
mkdirSync('.test-output',{recursive:true});
const database=sqliteD1();globalThis.__pointsClock={env:{DB:database.db}};
await build({stdin:{contents:`export {loadClubState} from './lib/club-maintenance';export {createSimulation} from './tests/helpers/scheduling-fixture';export {load,save} from './lib/store';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-output/points-auto-start-api.mjs',plugins:[{name:'isolated-points-clock',setup(builder){builder.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'points-clock'}));builder.onLoad({filter:/.*/,namespace:'points-clock'},()=>({loader:'js',contents:'export const env=globalThis.__pointsClock.env;'}));}}]});
const api=await import(pathToFileURL(resolve('.test-output/points-auto-start-api.mjs')).href);
try{
 const previous=await api.load(),s=api.createSimulation(Date.now()).state;s.events[0].start=Date.now()+3600000;await api.save(s,'clock-fixture',previous);
 await api.loadClubState();const warmed=await api.load();warmed.events[0].start=Date.now()-60000;await api.save(warmed,'clock-due',await api.load());
 const before=await api.load();const reads=await Promise.all([api.loadClubState(),api.loadClubState()]);const saved=await api.load();
 assert.equal(saved.revision,before.revision+1,'exactly one committed server transition');assert.equal(saved.rounds.length,2);assert.equal(saved.matches.length,2);assert.ok(saved.matches.every(m=>m.status==='playing'));assert.equal(saved.audits.filter(a=>a.action==='pointsAutoStart').length,1);assert.equal(new Set(saved.matches.map(m=>m.id)).size,2);
 assert.ok(reads.every(s=>s.revision===saved.revision&&s.matches.length===2),'racing read retries against committed revision');
 const again=await api.loadClubState();assert.equal(again.revision,saved.revision);assert.deepEqual(again.matches,saved.matches);
 const now=Date.now(),phase=api.createSimulation(now).state,e=phase.events[0],cut=now-1000;
 e.start=now-2*3600000;e.end=now+2*3600000;e.schedulingMode='planned';e.pointsPlan={start:e.start,end:e.end,roundMinutes:15};e.pointsSession={startedAt:e.start,attendance:[],waiting:[]};
 phase.bookings.forEach(b=>{b.start=e.start;b.end=e.end});phase.registrations.forEach((r,i)=>{r.arrival=i>=10?cut:e.start;r.departure=i===8||i===9?cut:e.end;r.registeredAt=e.start-86400000});
 const ids=phase.players.map(p=>p.id);
 for(let n=0;n<2;n++){
  const round={id:'phase-round-'+n,eventId:e.id,start:n?cut:e.start,duration:15,status:'published',eligible:ids,rest:[],seed:n+1,pointsSlot:n+1};phase.rounds.push(round);
  for(let c=0;c<2;c++){const selected=c?[ids[2],ids[3],ids[4],ids[5]]:[ids[0],ids[1],ids[n?10:8],ids[n?11:9]];phase.matches.push({id:'phase-match-'+n+c,eventId:e.id,roundId:round.id,courtId:phase.bookings[c].id,a:selected.slice(0,2),b:selected.slice(2),status:'published',start:null,end:null,scoreA:null,scoreB:null,games:[],monthly:true,elo:true,locked:false,enteredBy:null})}
 }
 phase.revision=again.revision;await api.save(phase,'phase-fixture',again);const phaseBefore=await api.load();
 const phaseReads=await Promise.all([api.loadClubState(),api.loadClubState()]),phaseSaved=await api.load();
 assert.equal(phaseSaved.revision,phaseBefore.revision+1);assert.equal(phaseSaved.audits.filter(a=>a.action==='pointsPhaseAdvance').length,1);
 assert.ok(phaseSaved.matches.filter(m=>m.roundId==='phase-round-0').every(m=>m.status==='cancelled'&&m.start===null&&m.scoreA===null));
 assert.ok(phaseSaved.matches.filter(m=>m.roundId==='phase-round-1').every(m=>m.status==='playing'));assert.equal(phaseSaved.matches.length,4);
 assert.ok(phaseReads.every(s=>s.revision===phaseSaved.revision));assert.equal((await api.loadClubState()).revision,phaseSaved.revision);
 const gapFixture=structuredClone(phaseSaved),gapNow=Date.now(),gapCut=gapNow+30*60000,ge=gapFixture.events[0];ge.end=gapNow+90*60000;ge.pointsPlan.end=ge.end;
 gapFixture.bookings.forEach(b=>b.end=ge.end);gapFixture.registrations.forEach((r,i)=>{r.arrival=i>=10?gapCut:ge.start;r.departure=i===8||i===9?gapCut:ge.end});
 gapFixture.rounds[0].status='complete';gapFixture.rounds[1].status='published';gapFixture.rounds[1].start=gapCut;
 gapFixture.matches.forEach(m=>{if(m.roundId==='phase-round-0')Object.assign(m,{status:'complete',start:ge.start,end:gapNow-60000,scoreA:21,scoreB:19,games:[{a:21,b:19}]});else Object.assign(m,{status:'published',start:null,end:null,scoreA:null,scoreB:null,games:[]})});
 const nextPhase=structuredClone(gapFixture.matches.filter(m=>m.roundId==='phase-round-1'));await api.save(gapFixture,'gap-fixture',phaseSaved);const gapBefore=await api.load();
 const gapReads=await Promise.all([api.loadClubState(),api.loadClubState()]),gapSaved=await api.load();
 assert.equal(gapSaved.revision,gapBefore.revision+1);assert.equal(gapSaved.audits.filter(a=>a.action==='pointsGapFill').length,1);assert.equal(gapSaved.matches.length,6);assert.equal(gapSaved.rounds.length,3);
 assert.equal(gapSaved.matches.filter(m=>m.status==='playing').length,2);assert.ok(gapSaved.matches.filter(m=>m.status==='playing').flatMap(m=>[...m.a,...m.b]).every(id=>!ids.slice(10).includes(id)));
 assert.deepEqual(gapSaved.matches.filter(m=>m.roundId==='phase-round-1'),nextPhase);assert.ok(gapReads.every(s=>s.revision===gapSaved.revision));assert.equal((await api.loadClubState()).revision,gapSaved.revision);
 console.log('PASS due points start: concurrent SQLite-backed maintenance reads commit two courts once; retries see authoritative revision and repeated reads are idempotent.');
 console.log('PASS planned phase switch: racing reads atomically retire unstarted expired courts and start the confirmed next phase once without forfeits or duplicate games.');
 console.log('PASS planned gap fill: concurrent maintenance creates two current-player games exactly once and preserves confirmed future lineups.');
}finally{database.close();delete globalThis.__pointsClock}
