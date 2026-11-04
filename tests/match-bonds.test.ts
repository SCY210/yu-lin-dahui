import {test} from 'node:test';import assert from 'node:assert/strict';
import {emptyState,type Event,type Match} from '../lib/domain/types';
import {bondHistory,bondPairs,matchBondView,bondTierIndex} from '../lib/domain/bonds';
import {projectClubState} from '../lib/club-view';import {clearSharedClubValues} from '../lib/club-view-shared';
const now=Date.parse('2027-01-03T12:00:00Z');
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='a0';
 for(let i=0;i<6;i++){s.accounts.push({id:'a'+i,playerId:'p'+i,email:'',role:i===0?'admin':'member'});s.players.push({id:'p'+i,name:'Fictional '+i,ownerId:'a'+i,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''})}
 const event:Event={id:'visible',creatorId:'a0',title:'Fictional',start:now-3600000,end:now+3600000,venue:'v',address:'',capacity:6,signupDeadline:now,cancelDeadline:now,note:'',status:'open',courtMode:'equal',ballMode:'equal'};
 s.events=[event,{...event,id:'secret',status:'draft'},{...event,id:'deleted',deletedAt:now},{...event,id:'outside'}];
 const m:Match={id:'current',eventId:'visible',roundId:'r',courtId:'c',a:['p0','p1'],b:['p2','p3'],status:'playing',start:now-1000,end:null,scoreA:null,scoreB:null,games:[],monthly:true,elo:true,locked:false,enteredBy:null};
 s.matches=[m,{...m,id:'private',eventId:'secret'},{...m,id:'removed',eventId:'deleted'},{...m,id:'other-live',eventId:'outside'}];
 s.treasureLedger.push({id:'credit',playerId:'p0',delta:30,balance:30,kind:'grant',reason:'fixture',actor:'a0',at:now-6000,requestId:'credit'});
 s.treasureLedger.push({id:'g',playerId:'p0',delta:-30,balance:0,kind:'redeem',reason:'private note',actor:'a0',at:now-5000,requestId:'g',giftTo:'p1',giftValue:30,giftAffinity:15000,message:'private message'});
 return s;
}

test('visible doubles expose only the actual teammate tiers, including zero-affinity first stage',()=>{
 const s=fixture(),before=structuredClone(s),view=matchBondView(s,bondHistory(s));
 assert.deepEqual(view.current,{a:{players:['p0','p1'],tier:4},b:{players:['p2','p3'],tier:0}});
 assert.deepEqual(s,before);assert.equal(view.current.a!.tier,bondTierIndex(bondPairs(s).find(p=>p.a==='p0'&&p.b==='p1')!.score));
 assert.ok(!/score|message|gift|balance|reason/.test(JSON.stringify(view)));
 s.matches[0].a=['p0','p4'];assert.equal(matchBondView(s,bondHistory(s)).current.a!.tier,0,'a new partner never inherits the previous bond');
 s.players[4].guestEventId='visible';assert.equal(matchBondView(s,bondHistory(s)).current.a,null);assert.ok(matchBondView(s,bondHistory(s)).current.b);
 s.matches[0].a=['p0'];s.matches[0].b=['p2'];assert.ok(!matchBondView(s,bondHistory(s)).current);
});

test('projection rechecks workspace visibility on each viewer and scoped read without exposing full bonds',()=>{
 clearSharedClubValues();try{
  const s=fixture();s.revision=900;const member=s.accounts[2],before=structuredClone(s);
  const admin=projectClubState(s,s.accounts[0],'2027-01',2027,now,{revision:900});assert.ok(admin.matchBondTiers.private);
  const full=projectClubState(s,member,'2027-01',2027,now,{revision:900});assert.equal(full.bonds.pairs,undefined);assert.equal(full.bonds.gifts,undefined);assert.ok(!full.matchBondTiers.private);assert.ok(!full.matchBondTiers.removed);assert.equal(full.matchBondTiers.current.a!.tier,4);
  const scoped=projectClubState(s,member,'2027-01',2027,now,{revision:900,activityId:'visible'});assert.deepEqual(Object.keys(scoped.matchBondTiers),['current']);assert.ok(scoped.matches.some(m=>m.id==='other-live'),'other busy players may remain, without unrelated badges');
  scoped.matchBondTiers.current.a!.tier=10;scoped.matchBondTiers.current.a!.players[0]='forged';assert.deepEqual(projectClubState(s,member,'2027-01',2027,now,{revision:900,activityId:'visible'}).matchBondTiers.current.a,{players:['p0','p1'],tier:4});
  s.accounts[0].role='member';assert.ok(projectClubState(s,s.accounts[0],'2027-01',2027,now,{revision:900}).matchBondTiers.private,'creator still sees own draft');
  assert.deepEqual({...s,accounts:before.accounts},before);
 }finally{clearSharedClubValues()}
});

test('new revision refreshes tiers after gifts, cancellations and lineup changes without sticky cache values',()=>{
 clearSharedClubValues();try{
  const s=fixture(),member=s.accounts[2];s.revision=910;
  assert.equal(projectClubState(s,member,'2027-01',2027,now,{revision:910}).matchBondTiers.current.a!.tier,4);
  s.treasureLedger.find(r=>r.id==='g')!.giftAffinity=500000;s.revision++;
  assert.equal(projectClubState(s,member,'2027-01',2027,now,{revision:911}).matchBondTiers.current.a!.tier,10);
  s.matches[0].a=['p0','p4'];s.revision++;
  assert.equal(projectClubState(s,member,'2027-01',2027,now,{revision:912}).matchBondTiers.current.a!.tier,0);
  s.matches[0].a=['p0','p1'];s.treasureLedger.find(r=>r.id==='g')!.orderId='cancelled';s.treasureOrders.push({id:'cancelled',status:'cancelled'} as typeof s.treasureOrders[number]);s.revision++;
  assert.equal(projectClubState(s,member,'2027-01',2027,now,{revision:913}).matchBondTiers.current.a!.tier,0);
 }finally{clearSharedClubValues()}
});
