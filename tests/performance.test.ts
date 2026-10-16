import {test} from 'node:test';
import assert from 'node:assert/strict';
import {month,type State} from '../lib/domain/types';
import {projectClubState} from '../lib/club-view';
import {clearSharedClubValues,refreshStrength,sharedClubValue,sharedRealmLedger,sharedViewValidUntil} from '../lib/club-view-shared';
import {mergeStrengthRating} from '../lib/domain/ranking';
import {realmLedger} from '../lib/domain/realm-rating';
import {activateAutomaticCoins,reconcileAutomaticCoins} from '../lib/domain/automatic-coins';

// Cloudflare's free Workers plan allows 10ms of CPU per request; see docs/PERFORMANCE_BUDGET.md. Other test files
// run in parallel and steal CPU at random moments, so every timing is the fastest of several runs (contention only
// ever adds time) with generous budgets. A return to per-player or per-event full scans (the 169ms projection this
// file was written against) still fails.
const hour=3600000,day=24*hour,base=Date.parse('2026-07-01T17:00:00Z');
import {club} from './helpers/performance-fixture';
import {socialHistoryParts,finished,playerStats,funnyStats,annual} from '../lib/domain/social';

/** The fastest of `runs` timed calls of each function after one warm-up call. Calls alternate between the
 * functions so a burst of contention slows all of them alike. */
function fastest(runs:number,...fs:(()=>void)[]){
 for(const f of fs)f();
 const best=fs.map(()=>Infinity);
 for(let i=0;i<runs;i++)fs.forEach((f,j)=>{const t=performance.now();f();best[j]=Math.min(best[j],performance.now()-t)});
 return best;
}
const periodAt=(now:number)=>month(now);

test('indexed social history matches the original per-player scan',()=>{
 const {s,now}=club(20);s.matches.push({...s.matches[0],id:'single',a:[s.players[0].id],b:[s.players[1].id]});
 const period=periodAt(now),year=Number(period.slice(0,4)),realms=realmLedger(s,now).snapshot,all=finished(s);
 const expected={stats:s.players.map(p=>playerStats(s,p.id,realms.get(p.id),all)),funny:funnyStats(s,period,all),annual:s.players.map(p=>({playerId:p.id,...annual(s,p.id,year,all)}))};
 assert.deepEqual(socialHistoryParts(s,period,year,realms),expected);
});

test('month() matches Intl in Madrid for every hour across DST changes and month boundaries',()=>{
 const intl=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'});
 const expected=(t:number)=>{const p=intl.formatToParts(t);return p.find(x=>x.type==='year')!.value+'-'+p.find(x=>x.type==='month')!.value};
 const from=Date.parse('2026-01-01T00:00:00Z')/hour,to=Date.parse('2028-01-01T00:00:00Z')/hour;
 for(let h=from;h<to;h++)for(const t of [h*hour,h*hour+hour-1])assert.equal(month(t),expected(t),new Date(t).toISOString());
});

test('the shared club view is identical to a per-request projection for every kind of viewer',()=>{
 const {s,now}=club(20),admin=s.accounts[0],member=s.accounts[1],draftCreator=s.accounts[5];
 // Also during a live activity, when the shared results expire with every match boundary.
 const live=s.events[s.events.length-1],liveAt=live.start+70*60000;
 for(const at of [now,liveAt,now+90*day])for(const viewer of [admin,member,draftCreator,member]){
  const period=periodAt(at),year=Number(period.slice(0,4));
  const plain=projectClubState(s,viewer,period,year,at);
  assert.deepEqual(projectClubState(s,viewer,period,year,at,{revision:s.revision}),plain,viewer.id+' at '+new Date(at).toISOString());
   assert.deepEqual(projectClubState(structuredClone(s),viewer,period,year,at,{revision:s.revision,consumeState:true}),plain,'owned request snapshot is identical for '+viewer.id);
 }
 clearSharedClubValues();
});

test('shared results are reused only inside their validity window and the cache stays bounded',()=>{
 clearSharedClubValues();
 let computed=0;const value=(now:number,until=1000)=>sharedClubValue('k',now,()=>until,()=>++computed);
 assert.equal(value(0),1);assert.equal(value(999),1);
 assert.equal(value(1000),2,'expired at the boundary');
 assert.equal(value(500,5000),3,'a request from before the computed moment never reuses a later result');
 for(let i=0;i<20;i++)sharedClubValue('other'+i,0,()=>1000,()=>i);
 assert.equal(value(600,5000),4,'old keys are evicted');
 const {s,now}=club(4);const m=s.matches[0];m.end=now+5000;
 assert.equal(sharedViewValidUntil(s,now),now+5000,'a match ending soon bounds the window');
 assert.ok(sharedViewValidUntil(club(4).s,now)<=now+15000,'never longer than 15 seconds');
 clearSharedClubValues();
});

test('maintenance shares the 修为 refresh and coin ledger without changing the result',()=>{
 clearSharedClubValues();
 const {s,now}=club(20),plain=structuredClone(s),coinsFrom=base-day;
 // Ledger rows carry random request ids; everything else must match exactly.
 const comparable=(state:State)=>({...state,treasureLedger:state.treasureLedger.map(row=>({...row,id:'',requestId:''}))});
 mergeStrengthRating(plain,now);activateAutomaticCoins(plain,coinsFrom);reconcileAutomaticCoins(plain,now);
 for(let i=0;i<3;i++){
  const shared=structuredClone(s);
  assert.equal(refreshStrength(shared,now),null);activateAutomaticCoins(shared,coinsFrom);reconcileAutomaticCoins(shared,now,sharedRealmLedger(shared,now));
  assert.deepEqual(comparable(shared),comparable(plain));
  // A caller changing its copy must not leak into the next request's shared result.
  shared.ratingChanges[0].delta=999;shared.players[0].rating=1;
 }
 assert.ok(plain.treasureRewardClaims.length>0,'the comparison covers real coin claims');
 assert.deepEqual(sharedRealmLedger(s,now),realmLedger(s,now));
 clearSharedClubValues();
});

// Budgets are counted in copies of the whole club state (structuredClone, about 2ms on a laptop) timed alongside, so
// they hold on any machine and under any load. The 10ms Workers limit is about five copies on a laptop.
test('a club-sized view stays far below the old cost, and shared viewers are cheaper still',()=>{
 const {s,now}=club(30),period=periodAt(now),year=Number(period.slice(0,4)),viewers=s.accounts.slice(0,10);
 clearSharedClubValues();projectClubState(s,viewers[0],period,year,now,{revision:s.revision});
 let i=0;const [copy,plain,shared]=fastest(9,()=>{structuredClone(s)},()=>{projectClubState(s,viewers[1],period,year,now)},()=>{projectClubState(s,viewers[++i%10],period,year,now,{revision:s.revision})});
 clearSharedClubValues();
 const copies=(ms:number)=>(ms/copy).toFixed(1)+' state copies';
 // Measured 11 copies per request and 2.4 per shared viewer; the code this file replaced took 78.
 assert.ok(plain<35*copy,`per-request projection took ${copies(plain)} (budget 35)`);
 assert.ok(shared<8*copy,`shared projection took ${copies(shared)} per viewer (budget 8)`);
 assert.ok(shared<plain,`sharing must be cheaper (${copies(shared)} vs ${copies(plain)})`);
});

test('maintenance of an unchanged revision is cheap once shared',()=>{
 const {s,now}=club(30);clearSharedClubValues();
 // Rewards of the past activities are already settled, as on every load after an activity ends.
 mergeStrengthRating(s,now);activateAutomaticCoins(s,base-day);reconcileAutomaticCoins(s,now);
 const run=()=>{const state=structuredClone(s);refreshStrength(state,now);activateAutomaticCoins(state,base-day);reconcileAutomaticCoins(state,now,sharedRealmLedger(state,now))};
 const [copy,whole]=fastest(9,()=>{structuredClone(s)},run),work=whole-copy;
 clearSharedClubValues();
 // Measured about one copy; the unshared 修为 replay and coin ledger took about four.
 assert.ok(work<3*copy,`shared maintenance took ${(work/copy).toFixed(1)} state copies (budget 3)`);
});

test('projection cost grows linearly with the size of the club',()=>{
 const view=(weeks:number,members:number)=>{const {s,now}=club(weeks,members),period=periodAt(now);return ()=>{projectClubState(s,s.accounts[1],period,Number(period.slice(0,4)),now)}};
 const [small,large]=fastest(7,view(16,22),view(48,66)),ratio=large/small;
 // Three times the members and activities measured 3.4x here. Scanning the whole history once per player or per
 // activity makes it about nine times (7.7x measured on the code this file replaced).
 assert.ok(ratio<5.5,`tripling members and activities multiplied the projection time by ${ratio.toFixed(2)}`);
});
