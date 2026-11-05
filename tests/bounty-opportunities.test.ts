import test from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {bountyOfferAt,bountyOffer,bountyOutcome,bountyPointAdjustments,drawnBounty,type BountyRecord} from '../lib/domain/bounties';
import {upsetOfferEligible} from '../lib/domain/bounty-opportunities';
import {realmLedger} from '../lib/domain/realm-rating';
import {projectClubState} from '../lib/club-view';
import {pendingBountyOffers} from '../lib/client/bounties';
import {bountyReminders} from '../lib/bounty-reminders';
import {clubViewValidUntil} from '../lib/club-read-cache';
import {reconcileAutomaticCoins,activateAutomaticCoins} from '../lib/domain/automatic-coins';
import {month} from '../lib/domain/types';
import {coinEpoch,coinFixture,coinEvent,coinSignup,coinMatch} from './helpers/automatic-coins-fixture';

function setup(gap=250,singles=false){
 const s=coinFixture();let id='';for(let i=0;;i++)if(drawnBounty('eligible-'+i,'p0')==='upset'){id='eligible-'+i;break}
 const e=coinEvent(s,id,coinEpoch+3600000,{matchFormat:singles?'singles':'doubles'}),now=bountyOfferAt(e);
 for(const p of s.players)coinSignup(s,e,p.id);
 s.audits.push({id:'strength',actor:'owner',at:now-1000,action:'grantPoints',reason:'Fictional strength',changes:{playerId:'p2',period:month(now),points:0,rating:gap,reason:'Fictional strength'}});
 const m=coinMatch(s,e,'planned',{a:singles?['p0']:['p0','p1'],b:singles?['p2']:['p2','p3'],status:'published',start:null,end:null,games:[],scoreA:null,scoreB:null});
 const r=s.rounds.find(r=>r.id===m.roundId)!;r.status='published';
 const eligible=()=>upsetOfferEligible(s,e,'p0',now,realmLedger(s,now).snapshot);
 return {s,e,m,r,now,eligible};
}

test('upset offers require a real eligible published lineup; exact 250 works for singles and doubles',()=>{
 for(const singles of [false,true]){const x=setup(250,singles);assert.equal(x.eligible(),true);assert.equal(bountyOffer(x.s,x.e,'p0',x.now,x.eligible)?.kind,'upset');assert.equal(setup(249,singles).eligible(),false)}
 const edits=[(x:ReturnType<typeof setup>)=>{x.s.matches=[]},(x:ReturnType<typeof setup>)=>{x.m.status='draft'},(x:ReturnType<typeof setup>)=>{x.r.status='cancelled'},(x:ReturnType<typeof setup>)=>{x.m.b=['p4','p5']},(x:ReturnType<typeof setup>)=>{x.s.players[2].enabled=false},(x:ReturnType<typeof setup>)=>{x.s.registrations[2].status='waitlist'},(x:ReturnType<typeof setup>)=>{x.s.registrations[2].arrival=x.r.start+1},(x:ReturnType<typeof setup>)=>{x.s.registrations[2].departure=x.r.start},(x:ReturnType<typeof setup>)=>{x.s.bookings[0].end=x.r.start},(x:ReturnType<typeof setup>)=>{x.e.pointsSession={attendance:[{playerId:'p2',late:true,available:false,at:x.now}],waiting:[]}},(x:ReturnType<typeof setup>)=>{x.m.handicap={side:'a',points:5,applied:true}},(x:ReturnType<typeof setup>)=>{x.m.elo=false},(x:ReturnType<typeof setup>)=>{x.m.eventId='other'},(x:ReturnType<typeof setup>)=>{x.m.b=['p1','p2']}];
 for(const edit of edits){const x=setup();edit(x);assert.equal(x.eligible(),false,String(edit));assert.equal(bountyOffer(x.s,x.e,'p0',x.now,x.eligible),null)}
});

test('server, home card and reminders agree; stale/forged acceptance cannot bypass changed lineup',async()=>{
 const x=setup(),{s,e,now}=x,view=()=>projectClubState(s,s.accounts[0],month(now),new Date(now).getUTCFullYear(),now);
 assert.equal(pendingBountyOffers(view(),now)[0]?.kind,'upset');assert.ok(bountyReminders(s,now).some(n=>n.playerId==='p0'));
 x.m.b=['p4','p5'];assert.deepEqual(pendingBountyOffers(view(),now),[]);assert.ok(!bountyReminders(s,now).some(n=>n.playerId==='p0'));
 await assert.rejects(()=>apply(s,s.accounts[0],'bountyRespond',{eventId:e.id,playerId:'p0',accept:true},now),/挑战机会/);assert.equal(e.bounties?.length??0,0);
 await assert.rejects(()=>apply(s,s.accounts[0],'bountyRespond',{eventId:e.id,playerId:'p0',accept:true,bountyUpsetEligible:true},now));
 x.m.b=['p2','p3'];await apply(s,s.accounts[0],'bountyRespond',{eventId:e.id,playerId:'p0',accept:true},now);assert.equal(e.bounties?.[0].kind,'upset');
 await apply(s,s.accounts[0],'bountyRespond',{eventId:e.id,playerId:'p0',accept:true},now);assert.equal(e.bounties?.length,1);
});

test('no actual opportunity voids old accepted bounties and removes only their penalty; genuine losses still fail',()=>{
 for(const gap of [249,250])for(const won of [false,true]){
  const {s,e,m}=setup(gap),b:BountyRecord={playerId:'p0',kind:'upset',status:'accepted',at:bountyOfferAt(e),coins:20,points:10,penalty:10};e.bounties=[b];
  Object.assign(m,{status:'complete',start:e.start+60000,end:e.start+900000,scoreA:won?21:10,scoreB:won?10:21,games:[{a:won?21:10,b:won?10:21}]});
  const ledger=realmLedger(s,e.end),gamesOf=(id:string)=>ledger.byPlayer.get(id)??[],result=bountyOutcome(s,e,b,e.end,gamesOf);
  assert.equal(result,gap<250?'void':won?'completed':'failed');assert.equal(bountyPointAdjustments(s,e.end,gamesOf)[0]?.delta??0,gap<250?0:won?10:-10);
  activateAutomaticCoins(s,coinEpoch-86400000);reconcileAutomaticCoins(s,e.end);assert.equal(s.treasureRewardClaims.filter(r=>r.source==='bounty').length,gap>=250&&won?1:0);
  m.status='forfeit';m.noShow=['p0'];assert.equal(bountyOutcome(s,e,b,e.end,id=>realmLedger(s,e.end).byPlayer.get(id)??[]),'void','forfeit is not an actual challenge opportunity');
 }
});

test('an enabled guest can supply the high opponent rating without their own rated game row',()=>{
 const {s,e,m}=setup(0);s.audits=[];s.accounts=s.accounts.filter(a=>a.playerId!=='p2');s.players[2].ownerId='owner';s.players[2].guestEventId=e.id;s.players[2].guestLevels=[{at:bountyOfferAt(e)-1000,level:1300}];
 assert.equal(upsetOfferEligible(s,e,'p0',bountyOfferAt(e),realmLedger(s,bountyOfferAt(e)).snapshot),true);
 Object.assign(m,{status:'complete',start:e.start+60000,end:e.start+900000,scoreA:21,scoreB:10,games:[{a:21,b:10}]});
 const ledger=realmLedger(s,e.end),b:BountyRecord={playerId:'p0',kind:'upset',status:'accepted',at:bountyOfferAt(e),coins:20,points:10,penalty:10};
 assert.equal(ledger.byPlayer.has('p2'),false);assert.equal(bountyOutcome(s,e,b,e.end,id=>ledger.byPlayer.get(id)??[]),'completed');
});

test('conditional reads expire when an eligible bounty opens and when a published opportunity passes',()=>{
 const {s,now,r}=setup();assert.equal(clubViewValidUntil(s,s.accounts[0],now-1),now);
 assert.equal(clubViewValidUntil(s,s.accounts[0],r.start-1),r.start);
 assert.equal(projectClubState(s,s.accounts[0],month(now),2035,now-1).events[0].bountyUpsetEligible,undefined);
 assert.equal(projectClubState(s,s.accounts[0],month(now),2035,now).events[0].bountyUpsetEligible,true);
});
