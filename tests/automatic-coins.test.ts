import test from 'node:test';
import assert from 'node:assert/strict';
import {activateAutomaticCoins,reconcileAutomaticCoins,pendingAutomaticCorrection} from '../lib/domain/automatic-coins';
import {treasureBalance,treasureGrant,treasureProduct,treasureRedeem,treasureOrder,treasureShopView} from '../lib/domain/treasure-shop';
import {realmLedger} from '../lib/domain/realm-rating';
import {gamePoints} from '../lib/domain/season-points';
import {privateEventState} from '../lib/domain/event-privacy';
import {month,type State} from '../lib/domain/types';
import {coinEpoch as at,coinEvent,coinFixture,coinMatch,coinSignup} from './helpers/automatic-coins-fixture';

const balance=(s:State,id='p0')=>treasureBalance(s,id);
const claims=(s:State,id='p0')=>s.treasureRewardClaims.filter(r=>r.playerId===id&&r.amount>0);
function setup(){const s=coinFixture(),e=coinEvent(s,'eligible');for(const p of s.players)coinSignup(s,e,p.id);activateAutomaticCoins(s,at);return {s,e,done:e.end+1}}

test('automatic coins require explicit activation, freeze old events, and wait for scheduled end',()=>{
 const s=coinFixture(),old=coinEvent(s,'old',at-1),equal=coinEvent(s,'boundary',at),future=coinEvent(s,'future');
 for(const e of [old,equal,future]){coinSignup(s,e,'p0');coinMatch(s,e,e.id+'-game')}
 assert.equal(reconcileAutomaticCoins(s,at+999999),false);assert.equal(balance(s),0);
 assert.equal(activateAutomaticCoins(s,at),true);const setting=structuredClone(s.settings.automaticCoins);
 assert.equal(activateAutomaticCoins(s,at+10),false);assert.deepEqual(s.settings.automaticCoins,setting);
 old.end=at+1;equal.end=at+1;future.status='ended';
 reconcileAutomaticCoins(s,future.end-1);assert.equal(balance(s),0,'manual ended status cannot accelerate a scheduled reward');
 reconcileAutomaticCoins(s,future.end);assert.equal(balance(s),10,'Two historical wins establish a streak but only the new third win earns five coins');assert.ok(claims(s).every(r=>r.eventId==='future'));
 const once=structuredClone(s);assert.equal(reconcileAutomaticCoins(s,future.end+1),false);assert.deepEqual(s,once);
});

test('activation freezes manually ended history but restored future cancellations can qualify',()=>{
 const s=coinFixture(),finished=coinEvent(s,'manually-finished',at+60000,{status:'ended'}),cancelled=coinEvent(s,'cancelled-before-rollout',at+70000,{status:'cancelled'});
 for(const e of [finished,cancelled])coinSignup(s,e,'p0');activateAutomaticCoins(s,at);finished.status='open';cancelled.status='open';
 reconcileAutomaticCoins(s,at+80000);assert.equal(balance(s),5);assert.ok(claims(s).every(r=>r.eventId===cancelled.id));
});

test('multiple venues and signup intervals award participation once, even with no rated results',()=>{
 const {s,e,done}=setup(),r=s.registrations.find(r=>r.playerId==='p0')!;
 s.bookings.push({id:'second-court',eventId:e.id,name:'Court2',start:e.start,end:e.end,pricing:'total',cents:0});
 r.bookingSignups=[e.id+'-court','second-court'].map((bookingId,i)=>({bookingId,status:'confirmed',sequence:i+1,arrival:e.start,departure:e.end,note:'',cancelRequested:false,registeredAt:e.start,joinedAsWaitlist:false}));
 reconcileAutomaticCoins(s,done);assert.equal(balance(s),5);assert.equal(claims(s).filter(c=>c.source==='participation').length,1);
});

test('each won game earns its positive sporting points while losses never subtract coins',()=>{
 const {s,e,done}=setup();coinMatch(s,e,'three-games',{games:[{a:21,b:19},{a:18,b:21},{a:21,b:17}],scoreA:2,scoreB:1});
 reconcileAutomaticCoins(s,done);assert.equal(balance(s,'p0'),11);assert.equal(balance(s,'p1'),11);assert.equal(balance(s,'p2'),8);assert.equal(balance(s,'p3'),8);assert.equal(balance(s,'p4'),5);
 assert.equal(claims(s).filter(r=>r.source==='participation').length,1);assert.equal(claims(s).filter(r=>r.source==='match_win').length,2);
 const sports=structuredClone({players:s.players,matches:s.matches,ratingChanges:s.ratingChanges});reconcileAutomaticCoins(s,done+1);assert.deepEqual({players:s.players,matches:s.matches,ratingChanges:s.ratingChanges},sports);
});

test('consecutive wins earn exactly their ranking points, and correcting an earlier game recalculates later streak rewards',()=>{
 const {s,e,done}=setup();
 const matches=Array.from({length:4},(_,i)=>coinMatch(s,e,'streak-'+i,{start:e.start+i*600000,end:e.start+i*600000+300000}));
 reconcileAutomaticCoins(s,done);assert.equal(balance(s),23);assert.deepEqual(claims(s).filter(r=>r.source==='match_win').map(r=>r.amount),[3,4,5,6]);
 const before=structuredClone(s.treasureLedger);matches[0].games=[{a:19,b:21}];matches[0].scoreA=19;matches[0].scoreB=21;
 reconcileAutomaticCoins(s,done+1);assert.equal(balance(s),17);assert.deepEqual(claims(s).filter(r=>r.source==='match_win').map(r=>r.amount),[3,4,5]);assert.deepEqual(s.treasureLedger.slice(0,before.length),before);
 const corrected=structuredClone(s);assert.equal(reconcileAutomaticCoins(s,done+2),false);assert.deepEqual(s,corrected);
});

test('excluded pre-rollout results establish or break new-activity streaks without receiving historical coins',()=>{
 const s=coinFixture(),history=coinEvent(s,'history',at-1),future=coinEvent(s,'future');
 const oldResult=coinMatch(s,history,'old-win');coinSignup(s,history,'p0');coinSignup(s,future,'p0');coinMatch(s,future,'new-win');
 activateAutomaticCoins(s,at);reconcileAutomaticCoins(s,future.end+1);assert.equal(balance(s),9);assert.equal(claims(s).find(r=>r.matchId==='new-win')?.amount,4);assert.ok(claims(s).every(r=>r.eventId===future.id));
 oldResult.games=[{a:19,b:21}];oldResult.scoreA=19;oldResult.scoreB=21;reconcileAutomaticCoins(s,future.end+2);
 assert.equal(balance(s),8);assert.equal(claims(s).find(r=>r.matchId==='new-win')?.amount,3);assert.ok(claims(s).every(r=>r.eventId===future.id));
});

test('singles and doubles streaks remain independent for automatic currency',()=>{
 const {s,e,done}=setup();
 const fixtures=[{id:'double-first',a:['p0','p1'],b:['p2','p3'],won:true},{id:'single-loss',a:['p0'],b:['p6'],won:false},{id:'double-second',a:['p0','p1'],b:['p2','p3'],won:true},{id:'single-first',a:['p0'],b:['p6'],won:true},{id:'double-third',a:['p0','p1'],b:['p2','p3'],won:true},{id:'single-second',a:['p0'],b:['p6'],won:true}];
 for(const [i,m]of fixtures.entries())coinMatch(s,e,m.id,{a:m.a,b:m.b,start:e.start+i*500000,end:e.start+i*500000+300000,games:[m.won?{a:21,b:19}:{a:19,b:21}],scoreA:m.won?21:19,scoreB:m.won?19:21});
 reconcileAutomaticCoins(s,done);const earned=claims(s).filter(r=>r.source==='match_win');
 assert.deepEqual(earned.map(r=>[r.matchId,r.amount]),[['double-first',3],['double-second',4],['single-first',3],['double-third',5],['single-second',4]]);assert.equal(balance(s),24);
});

test('a winning streak from the previous quarter does not increase new-quarter currency',()=>{
 const s=coinFixture(),prior=coinEvent(s,'previous-quarter',at-3*86400000),current=coinEvent(s,'current-quarter');
 coinMatch(s,prior,'quarter-old-win');coinMatch(s,current,'quarter-new-win');coinSignup(s,current,'p0');activateAutomaticCoins(s,at);reconcileAutomaticCoins(s,current.end+1);
 assert.equal(balance(s),8);assert.equal(claims(s).find(r=>r.matchId==='quarter-new-win')?.amount,3);assert.ok(claims(s).every(r=>r.eventId===current.id));
});

test('upset rewards follow game-by-game ranking points; owner and notification bonuses are excluded',()=>{
 const {s,e,done}=setup();
 s.audits.push({id:'rating-adjustment',at:e.start-1000,actor:'owner',action:'grantPoints',reason:'Fictional',changes:{playerId:'p2',period:month(at),points:800,rating:300,reason:'Fictional'}},{id:'rating-adjustment-2',at:e.start-1000,actor:'owner',action:'grantPoints',reason:'Fictional',changes:{playerId:'p3',period:month(at),points:800,rating:300,reason:'Fictional'}},{id:'phone-bonus',at:e.start,actor:'owner',action:'notificationPoints',reason:'Fictional',changes:{playerId:'p0',period:month(at),points:30,kind:'enable',policy:'notification-v1'}});
 coinMatch(s,e,'upset');const won=realmLedger(s,done).games.find(g=>g.playerId==='p0')!;assert.equal(gamePoints(won),5);
 reconcileAutomaticCoins(s,done);assert.equal(balance(s),10);assert.equal(balance(s,'p2'),5);assert.equal(claims(s).find(r=>r.source==='match_win')?.amount,5);
});

test('score correction and void reconcile once without double paying and retain append-only ledger',()=>{
 const {s,e,done}=setup(),m=coinMatch(s,e,'correctable');reconcileAutomaticCoins(s,done);assert.equal(balance(s),8);
 const awarded=structuredClone(s.treasureLedger);m.games=[{a:19,b:21}];m.scoreA=19;m.scoreB=21;reconcileAutomaticCoins(s,done+1);
 assert.equal(balance(s),5);assert.equal(balance(s,'p2'),8);assert.deepEqual(s.treasureLedger.slice(0,awarded.length),awarded);
 const corrected=structuredClone(s);assert.equal(reconcileAutomaticCoins(s,done+2),false);assert.deepEqual(s,corrected);
 m.status='cancelled';reconcileAutomaticCoins(s,done+3);assert.equal(balance(s,'p2'),5);assert.equal(balance(s),5);
 m.status='complete';m.games=[{a:21,b:19}];m.scoreA=21;m.scoreB=19;reconcileAutomaticCoins(s,done+4);assert.equal(balance(s),8);assert.equal(balance(s,'p2'),5);
});

test('spent rewards create pending correction; refunds and future earnings settle it without a negative wallet',()=>{
 const {s,e,done}=setup(),m=coinMatch(s,e,'spent');reconcileAutomaticCoins(s,done);
 const owner=s.accounts[0],member=s.accounts[0],p=treasureProduct(s,owner,{name:'Fictional gift',description:'',price:8,stock:1,kind:'physical',active:true},done);
 const order=treasureRedeem(s,member,{productId:p.id,expectedPrice:8,quantity:1,requestId:crypto.randomUUID()},done);assert.equal(balance(s),0);
 m.games=[{a:19,b:21}];m.scoreA=19;m.scoreB=21;reconcileAutomaticCoins(s,done+1);assert.equal(balance(s),0);assert.equal(pendingAutomaticCorrection(s,'p0'),3);assert.equal(order.status,'pending');
 const untouched=structuredClone(s);assert.equal(reconcileAutomaticCoins(s,done+2),false);assert.deepEqual(s,untouched);
 treasureOrder(s,owner,{id:order.id,status:'cancelled'},done+3);reconcileAutomaticCoins(s,done+3);assert.equal(balance(s),8);assert.equal(pendingAutomaticCorrection(s,'p0'),3,'A refund must not be drained to pay existing automatic-reward debt');
 const next=coinEvent(s,'next',done+1000);coinSignup(s,next,'p0');reconcileAutomaticCoins(s,next.end);assert.equal(balance(s),10);
});

test('future automatic earnings offset correction debt, while manual grants do not manufacture rewards',()=>{
 const {s,e,done}=setup();coinMatch(s,e,'win');reconcileAutomaticCoins(s,done);
 const owner=s.accounts[0],p=treasureProduct(s,owner,{name:'Fictional gift',description:'',price:8,stock:1,kind:'physical',active:true},done);treasureRedeem(s,owner,{productId:p.id,expectedPrice:8,requestId:crypto.randomUUID()},done);
 e.status='cancelled';reconcileAutomaticCoins(s,done+1);assert.equal(balance(s),0);assert.equal(pendingAutomaticCorrection(s,'p0'),8);
 treasureGrant(s,owner,{playerId:'p0',amount:20,reason:'Manual independent grant',requestId:crypto.randomUUID()},done+2);reconcileAutomaticCoins(s,done+2);assert.equal(balance(s),20);assert.equal(pendingAutomaticCorrection(s,'p0'),8);
 const next=coinEvent(s,'future',done+100);coinSignup(s,next,'p0');reconcileAutomaticCoins(s,next.end);assert.equal(balance(s),20);assert.equal(pendingAutomaticCorrection(s,'p0'),3);
 const third=coinEvent(s,'third',done+200);coinSignup(s,third,'p0');reconcileAutomaticCoins(s,third.end);assert.equal(balance(s),22);assert.equal(pendingAutomaticCorrection(s,'p0'),0);
});

test('revoking an entitlement used only to offset earlier debt restores debt and preserves manual funds',()=>{
 const {s,e,done}=setup();coinMatch(s,e,'original-win');reconcileAutomaticCoins(s,done);
 const owner=s.accounts[0],product=treasureProduct(s,owner,{name:'Fictional gift',description:'',price:8,stock:1,kind:'physical',active:true},done);
 treasureRedeem(s,owner,{productId:product.id,expectedPrice:8,requestId:crypto.randomUUID()},done);
 e.status='cancelled';reconcileAutomaticCoins(s,done+1);assert.equal(pendingAutomaticCorrection(s,'p0'),8);
 treasureGrant(s,owner,{playerId:'p0',amount:20,reason:'Independent manual funds',requestId:crypto.randomUUID()},done+2);reconcileAutomaticCoins(s,done+2);
 const offset=coinEvent(s,'offset-only',done+100);coinSignup(s,offset,'p0');reconcileAutomaticCoins(s,offset.end);
 assert.equal(balance(s),20);assert.equal(pendingAutomaticCorrection(s,'p0'),3);
 offset.status='cancelled';reconcileAutomaticCoins(s,offset.end+1);
 assert.equal(balance(s),20,'No currency was actually credited for the offset-only claim, so revoking it must not debit independent funds');assert.equal(pendingAutomaticCorrection(s,'p0'),8);
});

test('after debt clears, reversing an earlier offset recovers only automatic cash still available',()=>{
 const {s,e,done}=setup();coinMatch(s,e,'original-win');reconcileAutomaticCoins(s,done);
 const owner=s.accounts[0],product=treasureProduct(s,owner,{name:'Fictional gift',description:'',price:8,stock:1,kind:'physical',active:true},done);
 treasureRedeem(s,owner,{productId:product.id,expectedPrice:8,requestId:crypto.randomUUID()},done);e.status='cancelled';reconcileAutomaticCoins(s,done+1);
 treasureGrant(s,owner,{playerId:'p0',amount:20,reason:'Independent manual funds',requestId:crypto.randomUUID()},done+2);reconcileAutomaticCoins(s,done+2);
 const first=coinEvent(s,'first-offset',done+100),second=coinEvent(s,'clears-debt',done+200);coinSignup(s,first,'p0');coinSignup(s,second,'p0');
 reconcileAutomaticCoins(s,first.end);assert.equal(balance(s),20);assert.equal(pendingAutomaticCorrection(s,'p0'),3);
 reconcileAutomaticCoins(s,second.end);assert.equal(balance(s),22);assert.equal(pendingAutomaticCorrection(s,'p0'),0);
 s.treasureLedger.reverse(); // Persistence is allowed to return rows in another physical order.
 first.status='cancelled';reconcileAutomaticCoins(s,second.end+1);assert.equal(balance(s),20,'Only the two automatic coins still spendable can be recovered');assert.equal(pendingAutomaticCorrection(s,'p0'),3);
});

test('cancel, reopen and time extension reconcile entitlement safely',()=>{
 for(const field of ['cancelled','extended'] as const){const {s,e,done}=setup();coinMatch(s,e,'game');reconcileAutomaticCoins(s,done);assert.equal(balance(s),8);
  if(field==='cancelled')e.status='cancelled';else e.end=done+1000;
  reconcileAutomaticCoins(s,done+1);assert.equal(balance(s),0,field);assert.equal(pendingAutomaticCorrection(s,'p0'),0);
  e.status='open';delete e.deletedAt;reconcileAutomaticCoins(s,e.end+1);assert.equal(balance(s),8,field+' requalifies exactly once');
 }
});

test('archiving preserves earned history but cannot create new sources in the deleted activity',()=>{
 const {s,e,done}=setup();coinMatch(s,e,'before-archive');reconcileAutomaticCoins(s,done);e.deletedAt=done+1;
 const once=structuredClone(s.treasureLedger);reconcileAutomaticCoins(s,done+1);assert.equal(balance(s),8);assert.deepEqual(s.treasureLedger,once);
 coinMatch(s,e,'after-archive',{start:e.start+1200000,end:e.start+1500000});reconcileAutomaticCoins(s,done+2);assert.equal(balance(s),8);assert.ok(!s.treasureRewardClaims.some(r=>r.matchId==='after-archive'));
 const archived=coinEvent(s,'never-awarded',done+100);coinSignup(s,archived,'p0');archived.deletedAt=done+50;reconcileAutomaticCoins(s,archived.end+1);assert.equal(balance(s),8);
});

test('participation eligibility distinguishes formal attendance, waitlist, withdrawal, no-show, guests and practice',()=>{
 const s=coinFixture(),e=coinEvent(s,'attendance',at+60000,{ranked:false});
 coinSignup(s,e,'p0');coinSignup(s,e,'p1',{status:'waitlist'});coinSignup(s,e,'p2',{status:'cancelled'});coinSignup(s,e,'p3');coinSignup(s,e,'p4',{status:'cancelled'});coinSignup(s,e,'p5');coinSignup(s,e,'p6');
 e.noShowHold=['p3'];e.pointsSession={attendance:[{playerId:'p5',late:true,available:false,at:e.start}],waiting:[]};
 s.attendance.push({id:'left-after-arrival',eventId:e.id,playerId:'p4',start:e.start,end:e.start+1000,state:'left',source:'automatic'});
 s.players[6].enabled=false;
 s.players.push({id:'guest',name:'Fictional guest',ownerId:'owner',guestEventId:e.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});coinSignup(s,e,'guest');
 coinMatch(s,e,'unranked-game',{a:['p0'],b:['p4']});activateAutomaticCoins(s,at);reconcileAutomaticCoins(s,e.end+1);
 assert.equal(balance(s,'p0'),5);assert.equal(balance(s,'p4'),5);assert.equal(balance(s,'p6'),5,'Disabling an account does not erase its genuine activity participation');for(const id of ['p1','p2','p3','p5','guest'])assert.equal(balance(s,id),0,id);
 assert.ok(s.treasureRewardClaims.every(r=>r.source==='participation'));
});

test('draft, unscored, forfeit and applied handicap do not produce winning currency',()=>{
 const {s,e,done}=setup();
 coinMatch(s,e,'draft-result',{status:'draft'});coinMatch(s,e,'unscored',{status:'published',games:[],scoreA:null,scoreB:null});
 coinMatch(s,e,'forfeit',{status:'forfeit',noShow:['p2']});coinMatch(s,e,'handicap',{handicap:{side:'a',points:4,applied:true}});
 reconcileAutomaticCoins(s,done);assert.equal(balance(s),5);assert.ok(claims(s).every(r=>r.source==='participation'));
 const after=structuredClone(s);assert.equal(reconcileAutomaticCoins(s,done+1),false);assert.deepEqual(s,after);
});

test('a valid result recorded after the event ended earns once and can be revised later',()=>{
 const {s,e,done}=setup();reconcileAutomaticCoins(s,done);assert.equal(balance(s),5);coinMatch(s,e,'late-entry');
 reconcileAutomaticCoins(s,done+60000);assert.equal(balance(s),8);const once=structuredClone(s);assert.equal(reconcileAutomaticCoins(s,done+60001),false);assert.deepEqual(s,once);
});

test('actual completed play can prove attendance without issuing guest currency or a waitlist-only reward',()=>{
 const s=coinFixture(),e=coinEvent(s,'played');for(const id of ['p0','p1','p2','p3'])coinSignup(s,e,id,{status:id==='p0'?'waitlist':id==='p1'?'cancelled':'confirmed'});e.noShowHold=['p2'];
 coinMatch(s,e,'played');activateAutomaticCoins(s,at);reconcileAutomaticCoins(s,e.end+1);assert.equal(balance(s,'p0'),8);assert.equal(balance(s,'p1'),8);assert.equal(balance(s,'p2'),5);
});

test('disabled accounts retain already-earned history and members cannot see another member claims',()=>{
 const {s,e,done}=setup();coinMatch(s,e,'game');reconcileAutomaticCoins(s,done);s.players[0].enabled=false;reconcileAutomaticCoins(s,done+1);assert.equal(balance(s),8);
 const ordinary=treasureShopView(s,s.accounts[1]);assert.ok(ordinary.ledger.every(r=>r.playerId==='p1'));assert.deepEqual(ordinary.wallets,[]);assert.equal('treasureRewardClaims' in ordinary,false);
});

test('ordinary administrator exports conceal archived source claims without changing authoritative evidence',()=>{
 const {s,e,done}=setup();coinMatch(s,e,'archived-result');reconcileAutomaticCoins(s,done);e.deletedAt=done+1;s.settings.automaticCoins!.excludedEventIds.push('private-history-id');
 const before=structuredClone(s),exported=privateEventState(s,{...s.accounts[1],role:'admin'});
 assert.deepEqual(exported.settings.automaticCoins!.excludedEventIds,[]);assert.ok(!exported.events.some(row=>row.id===e.id));assert.ok(!exported.treasureRewardClaims.some(row=>row.eventId===e.id));assert.deepEqual(s,before);
});
