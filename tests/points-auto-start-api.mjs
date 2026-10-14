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
 console.log('PASS due points start: concurrent SQLite-backed maintenance reads commit two courts once; retries see authoritative revision and repeated reads are idempotent.');
}finally{database.close();delete globalThis.__pointsClock}
