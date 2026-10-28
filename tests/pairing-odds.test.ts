import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../lib/admin-simulation';
import {apply} from '../lib/domain/commands';
import {propose} from '../lib/domain/grouping';
import {courtWishes,oddsSplits,type PairingOdds} from '../lib/domain/pairing-odds';
import {projectClubState} from '../lib/club-view';
import {emptyState,type Event,type State} from '../lib/domain/types';

const base=Date.parse('2026-10-14T16:00:00Z');
const partners=(court:{a:string[];b:string[]},x:string,y:string)=>[court.a,court.b].some(t=>t.includes(x)&&t.includes(y));
/** One court of four fictional members, or more players and courts. */
function court(count=4,courts=1){
 const s=createSimulation(base).state,e=s.events[0];delete e.livePlay;
 s.registrations=s.registrations.slice(0,count);s.bookings=s.bookings.slice(0,courts);
 const ids=s.registrations.map(r=>r.playerId);return {s,e,ids,admin:s.accounts[0]};
}
const rate=(s:State,e:Event,x:string,y:string,runs=400)=>{let together=0,shared=0;for(let seed=1;seed<=runs;seed++){const c=propose(s,e,e.start,15,seed).courts.find(c=>[...c.a,...c.b].includes(x)&&[...c.a,...c.b].includes(y));if(!c)continue;shared++;if(partners(c,x,y))together++}return together/shared};

test('the strongest rule decides first and a split always remains',()=>{
 const odds:PairingOdds={eventId:'e',defaults:[{players:['x'],targets:['y','z'],percent:0}],conditions:[{pair:['x','y'],members:['a','b'],one:75,two:100}]};
 assert.deepEqual(courtWishes(odds,['x','y','a','b']),[{x:'x',y:'y',percent:100},],'both condition members: the second chance');
 assert.deepEqual(courtWishes(odds,['x','y','a','q']),[{x:'x',y:'y',percent:75}],'one condition member: the first chance');
 assert.deepEqual(courtWishes(odds,['x','y','z','q']),[{x:'x',y:'y',percent:0},{x:'x',y:'z',percent:0}],'no condition member: the defaults');
 assert.deepEqual(courtWishes(odds,['x','q','r','t']),[],'nobody else of the rules: no odds');
 // x must face both y and z, which cannot happen at once: the first rule wins and a split is still left.
 assert.deepEqual(oddsSplits(odds,['x','y','z','q'],()=>.5),[[['x','q'],['y','z']]]);
 assert.equal(oddsSplits(undefined,['a','b','c','d'],Math.random).length,3);
});

test('a default rule makes two members partners with its chance when they share a court',async()=>{
 const {s,e,ids:[x,y],admin}=court();
 const before=rate(s,e,x,y);
 await apply(s,admin,'pairingOdds',{eventId:e.id,defaults:[{players:[x],targets:[y],percent:80}],conditions:[]},base-3600000);
 const after=rate(s,e,x,y);
 assert.ok(Math.abs(after-.8)<.07,'about 80% partners, got '+after+' (was '+before+')');
 await apply(s,admin,'pairingOdds',{eventId:e.id,defaults:[{players:[x],targets:[y],percent:0}],conditions:[]},base-3600000);
 assert.equal(rate(s,e,x,y,60),0,'0%: always opponents');
 await apply(s,admin,'pairingOdds',{eventId:e.id,defaults:[{players:[x],targets:[y],percent:100}],conditions:[]},base-3600000);
 assert.equal(rate(s,e,x,y,60),1,'100%: always partners');
});

test('a condition takes precedence over the default for the same two',async()=>{
 const {s,e,ids:[x,y,a,b],admin}=court(5);
 await apply(s,admin,'pairingOdds',{eventId:e.id,defaults:[{players:[x],targets:[y],percent:0}],conditions:[{pair:[x,y],members:[a,b],one:75,two:100}]},base-3600000);
 const seen={two:[0,0],one:[0,0],none:[0,0]};
 for(let seed=1;seed<=600;seed++){
  const c=propose(s,e,e.start,15,seed).courts[0],four=[...c.a,...c.b];if(!four.includes(x)||!four.includes(y))continue;
  const count=four.filter(id=>id===a||id===b).length,key=count===2?'two':count===1?'one':'none';
  seen[key][0]++;if(partners(c,x,y))seen[key][1]++;
 }
 assert.ok(seen.two[0]&&seen.one[0],'both cases happen with five players');
 assert.equal(seen.two[1],seen.two[0],'both condition members on court: always partners');
 assert.ok(Math.abs(seen.one[1]/seen.one[0]-.75)<.1,'one condition member: about 75%, got '+seen.one[1]/seen.one[0]);
});

test('the odds never change who plays or who shares a court',async()=>{
 const {s,e,ids,admin}=court(10,2),lineups=(seed:number)=>propose(s,e,e.start,15,seed).courts.map(c=>[...c.a,...c.b].sort().join()).sort().join('/');
 const before=Array.from({length:30},(_,i)=>lineups(i+1));
 await apply(s,admin,'pairingOdds',{eventId:e.id,defaults:[{players:[ids[0],ids[1]],targets:ids.slice(2),percent:100}],conditions:[]},base-3600000);
 assert.deepEqual(Array.from({length:30},(_,i)=>lineups(i+1)),before);
});

test('only the owner and administrators set and receive the odds',async()=>{
 const {s,e,ids:[x,y,a],admin}=court();
 const member=s.accounts.find(account=>account.role==='member')!,at=base-3600000;
 const odds={eventId:e.id,defaults:[{players:[x],targets:[y],percent:90}],conditions:[]};
 await assert.rejects(apply(s,member,'pairingOdds',odds,at),/403/);
 await apply(s,admin,'pairingOdds',odds,at);
 assert.deepEqual(s.settings.pairingOdds,[odds]);
 assert.equal(projectClubState(s,member,'2026-10',2026,at).settings.pairingOdds,undefined,'members never receive them');
 assert.deepEqual(projectClubState(s,admin,'2026-10',2026,at).settings.pairingOdds,[odds]);
 assert.equal(projectClubState(s,admin,'2026-10',2026,e.end+1).settings.pairingOdds,undefined,'gone once the activity is over');
 await assert.rejects(apply(s,admin,'pairingOdds',{eventId:e.id,defaults:[],conditions:[{pair:[x,y],members:[x,a],one:50,two:50}]},at),/条件成员/);
 await assert.rejects(apply(s,admin,'pairingOdds',{...odds,defaults:[{players:['nobody'],targets:[y],percent:50}]},at),/球友不存在/);
 await assert.rejects(apply(s,admin,'pairingOdds',odds,e.end+1),/活动已结束/);
 await apply(s,admin,'pairingOdds',{eventId:e.id,defaults:[],conditions:[]},at);
 assert.equal(s.settings.pairingOdds,undefined,'clearing every rule removes the entry');
});

test('live courts use the odds too',async()=>{
 const now=Date.parse('2026-10-10T15:00:00Z');
 for(const percent of [0,100]){
  const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
  const e:Event={id:'event',creatorId:'owner',title:'虚构实时活动',start:now-3600000,end:now+3*3600000,venue:'球馆',address:'',capacity:4,signupDeadline:now,cancelDeadline:now-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal'};
  s.events.push(e);
  for(let i=0;i<4;i++){
   const id='p'+i,accountId=i?'member'+i:'owner';
   s.players.push({id,name:'Fictional '+i,ownerId:accountId,initialRating:1000+i*200,rating:1000+i*200,ratedGames:0,enabled:true,ratingReason:''});
   s.accounts.push({id:accountId,email:'',role:i?'member':'admin',playerId:id});
   s.registrations.push({id:'reg'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
  }
  s.bookings.push({id:'court',eventId:e.id,name:'场地',start:e.start,end:e.end,pricing:'total',cents:1000});
  // Balance alone pairs the strongest with the weakest (p0+p3 against p1+p2).
  await apply(s,s.accounts[0],'pairingOdds',{eventId:e.id,defaults:[{players:['p0'],targets:['p1'],percent}],conditions:[]},now);
  await apply(s,s.accounts[0],'liveStart',{eventId:e.id},now);
  const m=s.matches.find(m=>m.status==='playing')!;
  assert.equal(partners(m,'p0','p1'),percent===100,percent+'%');
 }
});
