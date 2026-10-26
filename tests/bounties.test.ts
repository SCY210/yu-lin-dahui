import test from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {bountyKinds,bountyOffer,bountyOfferAt,bountyOutcome,bountyPointAdjustments,defaultBountySettings,drawnBounty,type BountyKind} from '../lib/domain/bounties';
import {activateAutomaticCoins,reconcileAutomaticCoins} from '../lib/domain/automatic-coins';
import {realmLedger} from '../lib/domain/realm-rating';
import {quarterlyLeaderboard} from '../lib/domain/ranking';
import {projectClubState} from '../lib/club-view';
import {clubViewValidUntil} from '../lib/club-read-cache';
import {month,type Event,type State} from '../lib/domain/types';
import {coinEpoch as at,coinEvent,coinFixture,coinMatch,coinSignup} from './helpers/automatic-coins-fixture';
import type {ViewBounty} from '../lib/client/bounties';

const minute=60000;
/** An activity id for which p0 draws the given bounty (the draw is a fixed hash of activity and player). */
function eventFor(kind:BountyKind,player='p0'){for(let i=0;;i++)if(drawnBounty('bounty-'+kind+'-'+i,player)===kind)return 'bounty-'+kind+'-'+i}
function setup(kind:BountyKind,fields:Partial<Event>={}){
 const s=coinFixture(),e=coinEvent(s,eventFor(kind),at+120*minute,fields);for(const p of s.players)coinSignup(s,e,p.id);
 return {s,e,owner:s.accounts[0],p0:s.accounts[0]};
}
/** A completed game of p0 (with p1) against p2 and p3, starting `offset` minutes into the activity. */
function game(s:State,e:Event,id:string,offset:number,score:[number,number]){coinMatch(s,e,id,{start:e.start+offset*minute,end:e.start+(offset+12)*minute,games:[{a:score[0],b:score[1]}],scoreA:score[0],scoreB:score[1]})}
const accept=(s:State,e:Event,accept=true,now=bountyOfferAt(e))=>apply(s,s.accounts[0],'bountyRespond',{eventId:e.id,playerId:'p0',accept},now);

test('about 60% of members draw one of the four bounties, always the same one for the same activity',()=>{
 const draws=Array.from({length:2000},(_,i)=>drawnBounty('event-'+i,'player-'+(i%37)));
 const offered=draws.filter(Boolean).length/draws.length;assert.ok(offered>0.55&&offered<0.65,String(offered));
 assert.deepEqual(new Set(draws.filter(Boolean)),new Set(bountyKinds));
 assert.equal(drawnBounty('event-7','player-7'),drawnBounty('event-7','player-7'));
});

test('the offer opens 30 minutes before the start and closes when the member\'s first game starts or the activity ends',()=>{
 const {s,e}=setup('rout'),offerAt=bountyOfferAt(e);assert.equal(offerAt,e.start-30*minute);
 assert.equal(bountyOffer(s,e,'p0',offerAt-1),null);
 assert.deepEqual(bountyOffer(s,e,'p0',offerAt),{eventId:e.id,playerId:'p0',kind:'rout',...defaultBountySettings.rewards.rout,penalty:10});
 assert.ok(bountyOffer(s,e,'p0',e.start+5*minute),'still open after the start until their own first game');
 game(s,e,'first',2,[21,15]);assert.equal(bountyOffer(s,e,'p0',e.start+5*minute),null,'their first game has started');
 for(const fields of [{ranked:false},{matchFormat:'practice'},{tournament:{} as Event['tournament']},{status:'cancelled'},{status:'draft'},{deletedAt:at}] as Partial<Event>[]){const x=setup('rout',fields);assert.equal(bountyOffer(x.s,x.e,'p0',bountyOfferAt(x.e)),null,JSON.stringify(fields))}
 const waitlist=setup('rout');waitlist.s.registrations.find(r=>r.playerId==='p0')!.status='waitlist';assert.equal(bountyOffer(waitlist.s,waitlist.e,'p0',bountyOfferAt(waitlist.e)),null);
});

test('a member answers their own offer once; the reward and penalty are frozen when accepted',async()=>{
 const {s,e}=setup('streak');
 await assert.rejects(()=>apply(s,s.accounts[1],'bountyRespond',{eventId:e.id,playerId:'p0',accept:true},bountyOfferAt(e)),/403/);
 await assert.rejects(()=>accept(s,e,true,bountyOfferAt(e)-1),/失效/);
 await accept(s,e);assert.deepEqual(e.bounties,[{playerId:'p0',kind:'streak',status:'accepted',at:bountyOfferAt(e),coins:30,points:15,penalty:10}]);
 await accept(s,e);assert.equal(e.bounties!.length,1,'repeating the same answer changes nothing');
 await assert.rejects(()=>accept(s,e,false),/不能更改/);
 await apply(s,s.accounts[0],'bountySettings',{rewards:{streak:{coins:1,points:1},rout:{coins:1,points:1},upset:{coins:1,points:1},deuce:{coins:1,points:1}},penalty:50},bountyOfferAt(e));
 assert.equal(e.bounties![0].points,15,'later setting changes do not touch an accepted bounty');assert.equal(e.bounties![0].penalty,10);
 await assert.rejects(()=>apply(s,s.accounts[1],'bountySettings',{rewards:{streak:{coins:1,points:1},rout:{coins:1,points:1},upset:{coins:1,points:1},deuce:{coins:1,points:1}},penalty:5},at),/403/);
 assert.equal(s.audits.filter(x=>x.action==='bountySettings').length,1);
});

test('each challenge is judged on completed games after the scheduled end; a declined bounty has no outcome',async()=>{
 const judge=async(kind:BountyKind,games:[number,number][],ledger=false)=>{
  const {s,e}=setup(kind);await accept(s,e);games.forEach((score,i)=>game(s,e,kind+'-'+i,2+i*13,score));
  assert.equal(bountyOutcome(s,e,e.bounties![0],e.end-1),null,'not before the end');
  return bountyOutcome(s,e,e.bounties![0],e.end,ledger?realmLedger(s,e.end).byPlayer.get('p0'):undefined);
 };
 assert.equal(await judge('streak',[[21,18],[21,19],[21,17],[21,15],[23,21]]),'completed');
 assert.equal(await judge('streak',[[21,18],[21,19],[18,21],[21,17],[21,15],[21,11]]),'failed','a loss breaks the run');
 assert.equal(await judge('rout',[[21,9]]),'completed');assert.equal(await judge('rout',[[21,10],[5,21]]),'failed','a loss to single figures does not count');
 assert.equal(await judge('deuce',[[22,20]]),'completed');assert.equal(await judge('deuce',[[21,19],[20,22]]),'failed');
 // 修为 starts equal for everyone and grows with play, so the averages before the match are given directly.
 const upset=setup('upset');await accept(upset.s,upset.e);game(upset.s,upset.e,'upset',2,[21,19]);
 const rated=(gap:number,won=true)=>[{matchId:'upset',eventId:upset.e.id,gameIndex:0,playerId:'p0',side:'a' as const,won,before:900,after:910,delta:10,k:20,expected:.2,opponent:900+gap,team:900,start:upset.e.start,end:upset.e.end,margin:2,settled:true,reset:false}];
 assert.equal(bountyOutcome(upset.s,upset.e,upset.e.bounties![0],upset.e.end,rated(250)),'completed','opponents at least 250 修为 stronger');
 assert.equal(bountyOutcome(upset.s,upset.e,upset.e.bounties![0],upset.e.end,rated(249)),'failed');
 assert.equal(bountyOutcome(upset.s,upset.e,upset.e.bounties![0],upset.e.end,rated(400,false)),'failed','a loss does not count');
 const declined=setup('rout');await accept(declined.s,declined.e,false);game(declined.s,declined.e,'d',2,[21,3]);assert.equal(bountyOutcome(declined.s,declined.e,declined.e.bounties![0],declined.e.end),null);
});

test('season points add the reward or subtract the penalty on the activity\'s board; coins follow the frozen reward',async()=>{
 const done=setup('rout');await accept(done.s,done.e);game(done.s,done.e,'big',2,[21,4]);
 const failed=setup('deuce');await accept(failed.s,failed.e);game(failed.s,failed.e,'plain',2,[21,15]);
 const gamesOf=(s:State,now:number)=>(id:string)=>realmLedger(s,now).byPlayer.get(id)??[];
 assert.deepEqual(bountyPointAdjustments(done.s,done.e.end,gamesOf(done.s,done.e.end)),[{playerId:'p0',eventId:done.e.id,period:month(done.e.start),format:'doubles',delta:8}]);
 assert.deepEqual(bountyPointAdjustments(failed.s,failed.e.end,gamesOf(failed.s,failed.e.end)).map(g=>g.delta),[-10]);
 const quarter=`${new Date(done.e.start).getUTCFullYear()}-Q${Math.floor(new Date(done.e.start).getUTCMonth()/3)+1}`;
 const before=quarterlyLeaderboard(done.s,quarter,done.e.end-1).find(r=>r.playerId==='p0')!,after=quarterlyLeaderboard(done.s,quarter,done.e.end).find(r=>r.playerId==='p0')!;
 assert.equal(after.bountyPoints,8);assert.equal(after.points-before.points,8);
 activateAutomaticCoins(done.s,at);reconcileAutomaticCoins(done.s,done.e.end);
 assert.deepEqual(done.s.treasureRewardClaims.filter(r=>r.source==='bounty').map(r=>[r.playerId,r.amount]),[['p0',15]]);
});

test('members see only their own bounty and its result; the result appears at the end without a write',async()=>{
 const {s,e}=setup('rout'),other=eventFor('rout','p1');
 e.bounties=[{playerId:'p0',kind:'rout',status:'accepted',at:bountyOfferAt(e),coins:15,points:8,penalty:10},{playerId:'p1',kind:drawnBounty(e.id,'p1')??'rout',status:'declined',at:bountyOfferAt(e),coins:0,points:0,penalty:0}];assert.ok(other);
 game(s,e,'big',2,[21,4]);
 const member=s.accounts[1],view=(a=member,now=e.end)=>projectClubState(s,a,month(now),new Date(now).getUTCFullYear(),now).events.find(x=>x.id===e.id)!.bounties;
 assert.deepEqual(view()!.map(b=>b.playerId),['p1']);
 assert.deepEqual(view(s.accounts[0])!.map(b=>[b.playerId,(b as ViewBounty).outcome??null]),[['p0','completed'],['p1',null]],'administrators see all, with results');
 assert.equal((view(s.accounts[0],e.end-1)!.find(b=>b.playerId==='p0') as ViewBounty).outcome,null);
 assert.ok(clubViewValidUntil(s,s.accounts[0],e.end-minute)<=e.end,'the cached view expires at the end, when bounties settle');
});
