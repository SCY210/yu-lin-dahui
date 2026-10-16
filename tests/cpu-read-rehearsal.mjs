// Optional local benchmark: node tests/cpu-read-rehearsal.mjs [--baseline] [--three-hours].
// No remote bindings, production records, passwords or tokens are used.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
const baseline=process.argv.includes('--baseline'),ticks=process.argv.includes('--three-hours')?3600:60;
const baseRef='6f014e7';
const originals=new Set(['lib/store.ts','lib/club-view.ts','lib/time-planning.ts','lib/club-view-shared.ts','lib/domain/ranking.ts','lib/domain/social.ts']);
mkdirSync('.test-output',{recursive:true});
const database=sqliteD1(),fixture=globalThis.__cpuRead={env:{DB:database.db},user:null};
const stages={};globalThis.__cpuReadStages=stages;
const syncStages=new Set(['parseStoredObject','projectClubState','refreshStrength','realmLedger','achievementSnapshot','clubViewValidUntil']);
await build({stdin:{contents:`export {GET} from './app/api/club/route';export {save,load} from './lib/store';export {loadClubState} from './lib/club-maintenance';export {clearSharedClubValues} from './lib/club-view-shared';export {club} from './tests/helpers/performance-fixture';export {emptyState,month} from './lib/domain/types';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-output/cpu-read-handler.mjs',plugins:[{name:'cpu-read-fixture',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));
 b.onResolve({filter:/\/auth$/},()=>({path:'auth',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__cpuRead.env;':'export const getAppUser=async()=>globalThis.__cpuRead.user;'}));
 b.onLoad({filter:/\.ts$/},a=>{
  const name=relative(process.cwd(),a.path).replaceAll('\\','/');
  let source=baseline&&originals.has(name)?execFileSync('git',['show',baseRef+':'+name],{encoding:'utf8',windowsHide:true}):readFileSync(a.path,'utf8');
  // Inclusive synchronous stage timings; they are not remote CPU readings and must not be summed.
  for(const fn of syncStages)if(source.includes('export function '+fn+'(')){
   source=source.replace('export function '+fn+'(', 'function '+fn+'Measured(');
   source+=`\nexport function ${fn}(...args:Parameters<typeof ${fn}Measured>){const t=performance.now();try{return ${fn}Measured(...args)}finally{const s=globalThis.__cpuReadStages;const row=s['${fn}']??={calls:0,ms:0};row.calls++;row.ms+=performance.now()-t}}\n`;
  }
  return {loader:'ts',contents:source};
 });
}}]});
const api=await import(pathToFileURL(resolve('.test-output/cpu-read-handler.mjs')).href);
const realNow=Date.now;let now;Date.now=()=>now;
const timings={full:[],activity:[],unchanged:[]},cold=[];
const asUser=a=>({userId:a.id,method:'password',username:a.id,displayName:a.id,email:''});
const read=(scope,token)=>api.GET(new Request('https://club.invalid/api/club?month='+api.month(now)+(scope?'&activity='+scope:''),{headers:token?{'If-None-Match':token}:{}}));
const summarize=list=>{const a=[...list].sort((a,b)=>a-b);return {count:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)}};
try{
 const {s}=api.club(9,22),live=s.events.at(-1);
 for(let i=0;i<600;i++)s.audits.push({id:'audit-'+i,at:i,actor:'p0',action:'fixture',reason:'x'.repeat(450)});
 now=live.start;await api.save(s,'seed',api.emptyState());await api.loadClubState();
 for(const key of ['owner-request:correct-thursday-oct8-date:v1','owner-request:thursday-six-equal-337:v1']){const prior=await api.load();await api.save(structuredClone(prior),key,prior)}
 // Warm infrastructure, then measure expired derived caches on both failing API shapes.
 fixture.user=asUser(s.accounts[0]);await (await read()).text();
 for(const scope of [undefined,live.id])for(let i=0;i<5;i++){
  api.clearSharedClubValues();const t=performance.now();const r=await read(scope);assert.equal(r.status,200);await r.text();cold.push({scope:scope?'activity':'full',ms:performance.now()-t});
 }
 for(const key of Object.keys(stages))delete stages[key];
 const tokens=new Map();let responses=0,scoreChanges=0;
 // 20 readers, 3-second polling; one real committed score correction every 30 seconds.
 for(let tick=0;tick<ticks;tick++){
  now=live.start+tick*3000;
  if(tick&&tick%10===0){const before=await api.load(),next=structuredClone(before),m=next.matches.find(m=>m.eventId===live.id&&m.status==='complete');m.scoreB=m.scoreB===15?16:15;m.games=[{a:m.scoreA,b:m.scoreB}];await api.save(next,'score-'+tick,before);scoreChanges++}
  for(const a of s.accounts.slice(0,20)){
   fixture.user=asUser(a);const scope=a===s.accounts[0]?undefined:live.id,key=a.id,token=tokens.get(key);
   const t=performance.now(),r=await read(scope,token);assert.ok(r.status===200||r.status===304);const body=await r.text();
   timings[r.status===304?'unchanged':scope?'activity':'full'].push(performance.now()-t);
   if(r.headers.has('ETag'))tokens.set(key,r.headers.get('ETag'));
   if(r.status===200){const data=JSON.parse(body);assert.equal(data.me.id,a.id);if(scope)assert.equal(data.activityScope,scope);responses+=Buffer.byteLength(body)}
  }
 }
 const result={baseline,baseRef,fixture:{players:s.players.length,matches:s.matches.length,audits:s.audits.length},simulatedHours:ticks*3/3600,requests:ticks*20,scoreChanges,coldDerivedCache:cold,summary:Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,summarize(v)])),stages,responseBytes:responses,note:'Local Node elapsed milliseconds with real SQLite, mocked authentication, and inclusive synchronous stage timing. Not a Cloudflare CPU measurement or a production load test.'};
 writeFileSync('.test-output/cpu-read-'+(baseline?'baseline':'optimized')+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{Date.now=realNow;database.close();delete globalThis.__cpuRead;delete globalThis.__cpuReadStages}
