import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,month,type Event,type Match,type Registration,type State} from '../lib/domain/types';
import {projectClubState} from '../lib/club-view';
import {clearSharedClubValues,refreshStrength,sharedClubValue,sharedRealmLedger,sharedViewValidUntil} from '../lib/club-view-shared';
import {mergeStrengthRating,strengthAlgorithm} from '../lib/domain/ranking';
import {realmLedger} from '../lib/domain/realm-rating';
import {activateAutomaticCoins,reconcileAutomaticCoins} from '../lib/domain/automatic-coins';

// Cloudflare's free Workers plan allows 10ms of CPU per request; see docs/PERFORMANCE_BUDGET.md. Timings here are
// medians with generous budgets so a busy CI runner stays green while a return to per-player or per-event full
// scans (the 169ms projection this file was written against) still fails.
const hour=3600000,day=24*hour,base=Date.parse('2026-07-01T17:00:00Z');

/** A fictional club about the size of the real one: 22 players, two weekly activities of 14 players and 20 matches. */
function club(weeks:number,members=22){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='p0';s.settings.strengthVersion=strengthAlgorithm;
 const ids=Array.from({length:members},(_,i)=>'p'+i);let seed=1;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 for(const id of ids){s.accounts.push({id,email:'',role:id==='p0'?'admin':'member',playerId:id});s.players.push({id,name:'球友'+id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})}
 for(let w=0;w<weeks;w++){
  const pool=[...ids].sort(()=>rnd()-.5).slice(0,14),start=base+w*3.5*day,end=start+3*hour,eventId='e'+w;
  s.events.push({id:eventId,creatorId:w%7===3?'p5':'p0',title:'活动'+w,matchFormat:'doubles',start,end,venue:'v',address:'',capacity:16,signupDeadline:start-2*hour,cancelDeadline:start-day,note:'',status:w%7===3?'draft':'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',ranked:true} as Event);
  s.bookings.push({id:'b'+w,eventId,name:'1号场',start,end,pricing:'total',cents:2000},{id:'c'+w,eventId,name:'2号场',start,end,pricing:'total',cents:2000});
  for(const id of pool)s.registrations.push({id:eventId+id,eventId,playerId:id,sequence:1,status:'confirmed',arrival:start,departure:end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}} as Registration);
  for(let r=0;r<10;r++){
   const roundId=eventId+'r'+r,at=start+r*15*60000;s.rounds.push({id:roundId,eventId,start:at,duration:15,status:'complete',eligible:pool,rest:[],seed:1});
   for(const court of ['b'+w,'c'+w]){
    const pick=[...pool].sort(()=>rnd()-.5).slice(0,4),won=rnd()>.5;
    s.matches.push({id:roundId+court,eventId,roundId,courtId:court,a:pick.slice(0,2),b:pick.slice(2),status:'complete',start:at,end:at+12*60000,scoreA:won?21:15,scoreB:won?15:21,games:[{a:won?21:15,b:won?15:21}],monthly:true,elo:true,locked:false,enteredBy:'p0'} as Match);
   }
  }
 }
 return {s,now:base+weeks*3.5*day};
}
/** The median CPU time of `runs` calls after one warm-up call. */
function median(runs:number,f:()=>void){
 f();const times:number[]=[];
 for(let i=0;i<runs;i++){const t=performance.now();f();times.push(performance.now()-t)}
 return times.sort((a,b)=>a-b)[Math.floor(runs/2)];
}
const periodAt=(now:number)=>month(now);

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

test('a club-sized view stays far below the old cost, and shared viewers are cheaper still',()=>{
 const {s,now}=club(30),period=periodAt(now),year=Number(period.slice(0,4)),viewers=s.accounts.slice(0,10);
 const plain=median(7,()=>projectClubState(s,viewers[1],period,year,now));
 clearSharedClubValues();projectClubState(s,viewers[0],period,year,now,{revision:s.revision});
 let i=0;const shared=median(15,()=>projectClubState(s,viewers[++i%10],period,year,now,{revision:s.revision}));
 clearSharedClubValues();
 assert.ok(plain<100,`per-request projection took ${plain.toFixed(1)}ms (budget 100ms, was 169ms before indexing)`);
 assert.ok(shared<40,`shared projection took ${shared.toFixed(1)}ms per viewer (budget 40ms)`);
 assert.ok(shared<plain,`sharing must be cheaper (${shared.toFixed(1)}ms vs ${plain.toFixed(1)}ms)`);
});

test('maintenance of an unchanged revision is cheap once shared',()=>{
 const {s,now}=club(30);clearSharedClubValues();
 // Rewards of the past activities are already settled, as on every load after an activity ends.
 mergeStrengthRating(s,now);activateAutomaticCoins(s,base-day);reconcileAutomaticCoins(s,now);
 const run=()=>{const state=structuredClone(s);refreshStrength(state,now);activateAutomaticCoins(state,base-day);reconcileAutomaticCoins(state,now,sharedRealmLedger(state,now))};
 const cloned=median(7,()=>structuredClone(s)),shared=median(9,run)-cloned;
 clearSharedClubValues();
 assert.ok(shared<25,`shared maintenance took ${shared.toFixed(1)}ms (budget 25ms)`);
});

test('projection cost grows linearly with the size of the club',()=>{
 const cost=({s,now}:{s:State;now:number})=>{const period=periodAt(now);return median(5,()=>projectClubState(s,s.accounts[1],period,Number(period.slice(0,4)),now))};
 const ratio=cost(club(32,44))/cost(club(16,22));
 // Twice the members and activities may cost at most about twice as much (1.5x measured). Scanning the whole history
 // once per player or per activity makes it about four times (3.1x measured on the code this file replaced).
 assert.ok(ratio<2.4,`doubling members and activities multiplied the projection time by ${ratio.toFixed(2)}`);
});
