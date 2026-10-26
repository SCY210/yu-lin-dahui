import test from 'node:test';
import assert from 'node:assert/strict';
import {activateAutomaticCoins,reconcileAutomaticCoins,attendanceStreakLength,defaultAttendanceStreakCoins} from '../lib/domain/automatic-coins';
import {treasureShopView,treasureStreakReward} from '../lib/domain/treasure-shop';
import type {Event,State} from '../lib/domain/types';
import {coinEpoch as at,coinEvent,coinFixture,coinSignup} from './helpers/automatic-coins-fixture';

const day=86400000;
const streaks=(s:State,id='p0')=>s.treasureRewardClaims.filter(r=>r.playerId===id&&r.source==='attendance_streak'&&r.amount>0);
/** Points matches on consecutive days after the rollout, everyone signed up. */
function series(count:number,fields:(i:number)=>Partial<Event>=()=>({})){
 const s=coinFixture();activateAutomaticCoins(s,at);
 const events=Array.from({length:count},(_,i)=>{const e=coinEvent(s,'points-'+i,at+(i+1)*day,fields(i));for(const p of s.players)coinSignup(s,e,p.id);return e});
 return {s,events,done:events.at(-1)!.end+1};
}

test('every four points matches in a row on time earn the streak coins on the fourth, then the count starts again',()=>{
 assert.equal(attendanceStreakLength,4);assert.equal(defaultAttendanceStreakCoins,20);
 const {s,events,done}=series(9);reconcileAutomaticCoins(s,done);
 assert.deepEqual(streaks(s).map(r=>[r.eventId,r.amount]),[['points-3',20],['points-7',20]],'the fourth and eighth; the ninth starts a new run');
 const before=structuredClone(s);assert.equal(reconcileAutomaticCoins(s,done+1),false,'replays award nothing new');assert.deepEqual(s,before);
 assert.equal(s.treasureRewardClaims.filter(r=>r.playerId==='p0'&&r.source==='participation').length,events.length,'participation coins are unchanged');
});

test('missing a points match or being reported late starts the count again; a cleared late mark does not',()=>{
 const {s,events,done}=series(6);
 s.registrations=s.registrations.filter(r=>!(r.eventId==='points-1'&&r.playerId==='p1'));
 events[2].pointsSession={attendance:[{playerId:'p2',late:true,available:true,at:events[2].start}],waiting:[]};
 events[1].pointsSession={attendance:[{playerId:'p3',late:false,available:true,at:events[1].start}],waiting:[]};
 s.registrations.find(r=>r.eventId==='points-2'&&r.playerId==='p4')!.status='waitlist';
 events[0].noShowHold=['p5'];
 reconcileAutomaticCoins(s,done);
 assert.deepEqual(streaks(s,'p0').map(r=>r.eventId),['points-3']);
 assert.deepEqual(streaks(s,'p3').map(r=>r.eventId),['points-3'],'a mistaken late mark that was cleared keeps the run');
 assert.deepEqual(streaks(s,'p1').map(r=>r.eventId),['points-5'],'not signing up breaks the run: points-2 to points-5');
 assert.deepEqual(streaks(s,'p2'),[],'late at points-2: only points-3 to points-5 remain');
 assert.deepEqual(streaks(s,'p4'),[],'waitlist only at points-2');
 assert.deepEqual(streaks(s,'p5').map(r=>r.eventId),['points-4'],'a no-show at points-0');
});

test('only points matches count: ordinary, practice, tournament, cancelled and deleted activities neither count nor break a run',()=>{
 const skipped:Partial<Event>[]=[{ranked:false},{matchFormat:'practice'},{tournament:{} as Event['tournament']},{status:'cancelled'},{deletedAt:at}];
 const {s,events,done}=series(4+skipped.length,i=>i>=1&&i<=skipped.length?skipped[i-1]:{});
 for(const e of events.slice(1,1+skipped.length))s.registrations=s.registrations.filter(r=>!(r.eventId===e.id&&r.playerId==='p0'));
 reconcileAutomaticCoins(s,done);
 assert.deepEqual(streaks(s).map(r=>r.eventId),[events.at(-1)!.id]);
});

test('matches before the rollout establish a run but earn nothing; the reward waits for the scheduled end',()=>{
 const s=coinFixture();
 const early=[0,1,2].map(i=>{const e=coinEvent(s,'early-'+i,at-(3-i)*day);for(const p of s.players)coinSignup(s,e,p.id);return e});
 activateAutomaticCoins(s,at);
 const fourth=coinEvent(s,'after',at+day);for(const p of s.players)coinSignup(s,fourth,p.id);
 reconcileAutomaticCoins(s,fourth.end-1);assert.deepEqual(streaks(s),[]);
 reconcileAutomaticCoins(s,fourth.end);assert.deepEqual(streaks(s).map(r=>r.eventId),['after']);
 assert.ok(early.every(e=>!s.treasureRewardClaims.some(r=>r.eventId===e.id)),'no coins for activities ended before the rollout');
});

test('the owner and administrators set the amount; an awarded run keeps its amount and 0 turns new rewards off',()=>{
 const {s,events}=series(12),owner=s.accounts[0],member=s.accounts[1];
 assert.throws(()=>treasureStreakReward(s,member,{coins:50},at),/403/);
 assert.equal(treasureShopView(s,member).streakReward.canEdit,false);
 reconcileAutomaticCoins(s,events[3].end);assert.deepEqual(streaks(s).map(r=>r.amount),[20]);
 const admin={...member,role:'admin' as const};treasureStreakReward(s,admin,{coins:35},at);
 assert.equal(s.audits.at(-1)?.action,'treasureStreakReward');assert.equal(treasureShopView(s,admin).streakReward.coins,35);
 reconcileAutomaticCoins(s,events[7].end);assert.deepEqual(streaks(s).map(r=>r.amount),[20,35],'the first run keeps 20');
 treasureStreakReward(s,owner,{coins:0},at);reconcileAutomaticCoins(s,events[11].end);
 assert.deepEqual(streaks(s).map(r=>r.amount),[20,35],'0 stops new runs only');
 assert.throws(()=>treasureStreakReward(s,owner,{coins:-1},at));assert.throws(()=>treasureStreakReward(s,owner,{coins:1001},at));
});
