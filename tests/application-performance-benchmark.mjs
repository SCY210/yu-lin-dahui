// Optional paired local benchmark: node tests/application-performance-benchmark.mjs
// Requires the baseline Git commit below; all data is fictional and no service is contacted.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {posix,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const baseline='b2624dea039d5cc740f82232c209cd7c23fd9eaa';
const root=process.cwd(),output=resolve('.test-output/application-performance');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
const tracked=new Set(git('ls-tree','-r','--name-only','-z',baseline).split('\0').filter(Boolean));
const originalSources=new Map();
mkdirSync(output,{recursive:true});

// Resolve every baseline project import inside the immutable Git tree, including transitive imports.
// npm dependencies use this checkout's installation; its lockfile must match the baseline exactly.
assert.equal(git('diff',baseline,'--','package-lock.json'),'','Install the baseline dependencies before comparing different lockfiles.');
const sourcePlugin={name:'immutable-performance-baseline',setup(b){
 const sourcePath=name=>{
  const file=[name,name+'.ts',name+'.tsx',name+'.mts',name+'.js',name+'.mjs',name+'.json',name+'/index.ts'].find(file=>tracked.has(file));
  assert.ok(file,'Baseline source does not exist: '+name);return {path:file,namespace:'git-baseline'};
 };
 b.onResolve({filter:/^baseline:/},a=>sourcePath(a.path.slice('baseline:'.length)));
 b.onResolve({filter:/.*/,namespace:'git-baseline'},a=>{
  if(a.path.startsWith('.'))return sourcePath(posix.normalize(posix.join(posix.dirname(a.importer),a.path)));
  if(a.path.startsWith('@/'))return sourcePath(a.path.slice(2));
  return b.resolve(a.path,{resolveDir:root,kind:a.kind});
 });
 b.onLoad({filter:/.*/,namespace:'git-baseline'},a=>{
  if(!originalSources.has(a.path))originalSources.set(a.path,git('show',baseline+':'+a.path));
  return {contents:originalSources.get(a.path),loader:a.path.endsWith('.json')?'json':a.path.endsWith('.tsx')?'tsx':'ts',resolveDir:root};
 });
}};

async function bundle(name,prefix){
 const entry=path=>prefix+path;
 const outfile=resolve(output,name+'.mjs');
 await build({stdin:{contents:`
 export {projectClubState} from '${entry('lib/club-view')}';
 export {clearSharedClubValues} from '${entry('lib/club-view-shared')}';
 export {bondView,bondRows,bondPairs} from '${entry('lib/domain/bonds')}';
 export {month} from '${entry('lib/domain/types')}';
 export {club} from '${entry('tests/helpers/performance-fixture')}';
 export {fmt,hm,euro} from '${entry('app/form-fields')}';
 `,loader:'ts',resolveDir:root},bundle:true,platform:'node',format:'esm',outfile,plugins:prefix==='baseline:'?[sourcePlugin]:[]});
 return import(pathToFileURL(outfile).href);
}
const before=await bundle('before','baseline:'),after=await bundle('after','./');

function fixture(activities,members){
 const {s,now}=before.club(activities,members);
 // Cover valid best-of-three results, a deleted activity, private drafts, guests and disabled members.
 s.matches[0].games=[{a:21,b:15},{a:18,b:21},{a:21,b:19}];s.matches[0].scoreA=21;s.matches[0].scoreB=19;
 s.events[2].deletedAt=s.events[2].end+1000;
 s.players.at(-1).enabled=false;
 s.players.push({...s.players[1],id:'fictional-guest',name:'Fictional Guest',ownerId:s.accounts[1].id,guestEventId:s.events[0].id});
 s.matches[1].a[1]='fictional-guest';
 // Social projection coverage: manual arrival ordering, automatic arrivals, promotion, per-court signups,
 // and both special court modes. Include a later booking on the same physical court name.
 for(const index of [0,1,3]){
  const event=s.events[index],registrations=s.registrations.filter(r=>r.eventId===event.id),booking=s.bookings.find(b=>b.eventId===event.id);
  event.playMode=index===1?'koc':'arena';event.arenaCourtId=booking.id;event.attendanceMode='manual';
  for(const match of s.matches.filter(m=>m.eventId===event.id))match.playMode=event.playMode;
  const r=registrations[0];r.registeredAt=event.start-86400000;r.joinedAsWaitlist=true;r.promotedAt=event.start-1000;
  const other=registrations[1];other.registeredAt=event.start-86400000;
  other.bookingSignups=[{bookingId:booking.id,status:'confirmed',sequence:1,arrival:event.start,departure:event.end,note:'',cancelRequested:false,registeredAt:other.registeredAt,joinedAsWaitlist:true,promotedAt:event.start-1000}];
  s.attendance.push({id:'late-'+index,eventId:event.id,playerId:r.playerId,start:event.start+60000,end:event.end,state:'left'},
   {id:'early-'+index,eventId:event.id,playerId:r.playerId,start:event.start-60000,end:event.start,state:'left'},
   {id:'automatic-'+index,eventId:event.id,playerId:other.playerId,start:event.start,end:event.end,state:'left',source:'automatic'});
 }
 const firstBooking=s.bookings[0];s.bookings.push({...firstBooking,id:'same-court-later',start:firstBooking.end,end:firstBooking.end+3600000});
 // Include legacy coin gifts, shop gifts and cancelled gifts interleaved with games, including ties.
 s.treasureLedger.push({id:'fixture-opening-balance',playerId:'p1',delta:2000,balance:2000,kind:'grant',reason:'Fictional opening balance',actor:'p0',at:s.events[0].start-1,requestId:'fixture-opening-balance'});
 let giverBalance=2000;
 for(const [index,value,cancelled]of [[0,31,false],[1,250,false],[2,1000,true]]){
  const at=s.matches[index].end,requestId='fixture-gift-'+index,orderId='fixture-order-'+index;
  s.treasureOrders.push({id:orderId,playerId:'p1',accountId:'p1',productId:'fixture-product',productName:'Fictional item',kind:'physical',price:value,quantity:1,total:value,status:cancelled?'cancelled':'fulfilled',created:at,updated:at,requestId,giftTo:'p2'});
  const common={reason:'Fictional gift',actor:'p1',at,giftValue:value,...(index?{orderId,giftItem:'Fictional item'}:{})};
  giverBalance-=value;
  s.treasureLedger.push({id:requestId+'-sent',playerId:'p1',delta:-value,balance:giverBalance,kind:'gift_sent',requestId,giftTo:'p2',...common},
   {id:requestId+'-received',playerId:'p2',delta:index?0:value,balance:31,kind:'gift_received',requestId:'gift:'+requestId,giftFrom:'p1',message:'Fictional thanks',...common});
  if(cancelled){giverBalance+=value;s.treasureLedger.push({id:requestId+'-refund',playerId:'p1',delta:value,balance:giverBalance,kind:'refund',reason:'Fictional cancellation',actor:'p0',at:at+1,requestId:requestId+'-refund',orderId})}
 }
 return {s,now};
}

let equivalenceChecks=0;
function assertEquivalent(s,at,viewer,activityId){
 const period=before.month(at),year=Number(period.slice(0,4));
 for(const api of [before,after])api.clearSharedClubValues();
 const expected=before.projectClubState(s,viewer,period,year,at,activityId?{revision:s.revision,activityId}:undefined);
 for(const shared of activityId?[{revision:s.revision,activityId}]:[undefined,{revision:s.revision}]){
  for(let repeat=0;repeat<2;repeat++){
   const actual=after.projectClubState(s,viewer,period,year,at,shared);
   assert.deepEqual(actual,expected,`${viewer.id}, ${activityId??'full'}, ${new Date(at).toISOString()}`);
   equivalenceChecks++;
  }
 }
 const owned=structuredClone(s);
 assert.deepEqual(after.projectClubState(owned,viewer,period,year,at,{revision:s.revision,activityId,consumeState:true}),expected,'The read handler-owned snapshot has identical output.');
 equivalenceChecks++;
}

const summaries=[];
function paired(name,prepare,runs=9){
 const apis=[before,after],samples=[[],[]];
 for(const api of apis)prepare(api)();
 for(let i=0;i<runs;i++)for(const side of i%2?[1,0]:[0,1]){
  const run=prepare(apis[side]); // Clone fixture / clear caches outside the measured section.
  const start=performance.now();run();samples[side].push(performance.now()-start);
 }
 const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {minMs:sorted[0],medianMs:sorted[Math.floor(sorted.length/2)],samples:values.length}};
 const old=stats(samples[0]),current=stats(samples[1]);
 const row={name,before:old,after:current,medianSpeedup:old.medianMs/current.medianMs};summaries.push(row);
 console.log(`${name}: ${old.medianMs.toFixed(3)} -> ${current.medianMs.toFixed(3)} ms (${row.medianSpeedup.toFixed(2)}x)`);
}

for(const [activities,members]of [[30,22],[90,66]]){
 const {s,now}=fixture(activities,members),live=s.events.at(-1),viewers=[s.accounts[0],s.accounts[1],s.accounts[5]];
 for(const at of [now,live.start+70*60000])for(const viewer of viewers)for(const scope of [undefined,live.id])assertEquivalent(s,at,viewer,scope);
 for(const viewer of viewers)assert.deepEqual(after.bondView(s,viewer),before.bondView(s,viewer));
 for(const viewer of [s.accounts[0],s.accounts[1]]){
  const role=viewer.role==='admin'?'owner':'member',label=`${activities} activities / ${members} members / ${role}`;
  paired(label+' / bonds',api=>()=>api.bondView(s,viewer));
  for(const scope of [undefined,live.id])for(const cache of ['cold','shared']){
   const at=live.start+70*60000,period=before.month(at),year=Number(period.slice(0,4)),options={revision:s.revision,activityId:scope,consumeState:true};
   // Warm both modules before shared measurement; every cold sample explicitly evicts derived values.
   for(const api of [before,after]){api.clearSharedClubValues();api.projectClubState(structuredClone(s),viewer,period,year,at,options)}
   paired(label+` / ${scope?'activity':'full'} / ${cache}`,api=>{
    const state=structuredClone(s);if(cache==='cold')api.clearSharedClubValues();
    return ()=>api.projectClubState(state,viewer,period,year,at,options);
   },7);
  }
 }
}

// Exactly the same dates/currency values and formatter options as the history rows.
const date=Date.parse('2026-10-25T00:30:00Z');
const formatted=api=>Array.from({length:500},(_,i)=>{
 const at=date+i*86400000;
 return [api.fmt(at),api.hm(at),api.hm(at+3*3600000),api.euro(1200+i),api.fmt(at-86400000)];
});
assert.deepEqual(formatted(after),formatted(before));equivalenceChecks++;
paired('500 history rows / 2,500 date and currency formats',api=>()=>formatted(api));

const report={baseline,node:process.version,equivalenceChecks,measurements:summaries,note:'Local Node elapsed time for synchronous projection, bonds and formatting only. Fixture cloning and cache clearing are outside timed sections. No network, authentication, database, JSON serialization or Worker CPU measurement; no production performance guarantee.'};
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(`PASS ${equivalenceChecks} complete response/format equivalence comparisons; report: .test-output/application-performance/report.json`);
