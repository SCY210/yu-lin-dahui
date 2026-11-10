import {test} from 'node:test';
import assert from 'node:assert/strict';
import {annualLeaderboard,quarterlyLeaderboard,singlesQuarterlyLeaderboard} from '../lib/domain/ranking';
import {realmLedger} from '../lib/domain/realm-rating';
import {activateAutomaticCoins,reconcileAutomaticCoins,pendingAutomaticCorrection} from '../lib/domain/automatic-coins';
import {treasureBalance,treasureProduct,treasureRedeem,treasureOrder,treasureGrant} from '../lib/domain/treasure-shop';
import {sumCoinAmounts} from '../lib/domain/treasure-ledger';
import {fifteenPointHalfFrom,seasonGamePointsFactor} from '../lib/domain/game-points';
import {rankingQuarter} from '../lib/ranking-quarter';
import {month} from '../lib/domain/types';
import {pointsBreakdown} from '../lib/client/ranking-breakdown';
import {coinEpoch as at,coinFixture,coinEvent,coinMatch,coinSignup} from './helpers/automatic-coins-fixture';

function fixture(){const s=coinFixture(),e=coinEvent(s,'short',at+60000,{gamePoints:15});for(const p of s.players)coinSignup(s,e,p.id);activateAutomaticCoins(s,at);return {s,e,now:e.end+1}}
const wins=(s:ReturnType<typeof coinFixture>,id='p0')=>s.treasureRewardClaims.filter(r=>r.playerId===id&&r.source==='match_win');

test('15 分制胜局及连胜积分和羽币严格减半，负局扣分也减半且修为不变',()=>{
 const {s,e,now}=fixture();for(let i=0;i<4;i++)coinMatch(s,e,'m'+i,{start:e.start+i*600000,end:e.start+i*600000+300000,games:[{a:15,b:12}],scoreA:15,scoreB:12});
 const normal=structuredClone(s);delete normal.events[0].gamePoints;
 const board=quarterlyLeaderboard(s,'2035-Q1',now),full=quarterlyLeaderboard(normal,'2035-Q1',now);
 assert.equal(board.find(r=>r.playerId==='p0')!.points,9);assert.equal(full.find(r=>r.playerId==='p0')!.points,18);
 assert.equal(board.find(r=>r.playerId==='p2')!.points,-2);assert.equal(board.find(r=>r.playerId==='p0')!.games,4);assert.equal(full.find(r=>r.playerId==='p2')!.points,-4);
 assert.equal(annualLeaderboard(s,2035,now).find(r=>r.playerId==='p2')!.points,-2);
 assert.ok(pointsBreakdown(board.find(r=>r.playerId==='p2')!).some(line=>line.label==='15 分制负局 4 × 0.5'&&line.points===-2));
 assert.deepEqual(realmLedger(s,now),realmLedger(normal,now));
 reconcileAutomaticCoins(s,now);assert.deepEqual(wins(s).map(r=>r.amount),[1.5,2,2.5,3]);
 assert.equal(annualLeaderboard(s,2035,now).find(r=>r.playerId==='p0')!.points,9);
 for(const row of board){const breakdown=pointsBreakdown(row);assert.equal(breakdown.reduce((sum,line)=>sum+line.points,0),row.points);assert.ok(!breakdown.some(line=>line.label==='其他调整'))}
 assert.ok(pointsBreakdown(board.find(r=>r.playerId==='p0')!).some(line=>line.label==='15 分制胜局 4 × 1.5'&&line.points===6));
});

test('15 分制强弱加成减半，21 分制与单双打连胜仍按原规则衔接',()=>{
 const {s,e,now}=fixture();for(const playerId of ['p2','p3'])s.audits.push({id:playerId,at:e.start-1,actor:'owner',action:'grantPoints',reason:'测试水平',changes:{playerId,period:'2035-01',points:0,rating:300,reason:'测试水平'}});
 coinMatch(s,e,'upset',{games:[{a:15,b:12}],scoreA:15,scoreB:12});
 const row=quarterlyLeaderboard(s,'2035-Q1',now).find(r=>r.playerId==='p0')!;assert.equal(row.upsetPoints,1);assert.equal(row.points,2.5);
 reconcileAutomaticCoins(s,now);assert.equal(wins(s)[0].amount,2.5);
 const mixed=coinFixture(),short=coinEvent(mixed,'15',at+60000,{gamePoints:15}),full=coinEvent(mixed,'21',at+7200000);
 coinMatch(mixed,short,'short',{games:[{a:15,b:12}],scoreA:15,scoreB:12});coinMatch(mixed,full,'normal');
 const total=quarterlyLeaderboard(mixed,'2035-Q1',full.end+1).find(r=>r.playerId==='p0')!;assert.equal(total.points,5.5);assert.equal(total.streakPoints,1);
 const loser=quarterlyLeaderboard(mixed,'2035-Q1',full.end+1).find(r=>r.playerId==='p2')!;assert.equal(loser.points,-1.5);assert.equal(loser.losses,2);assert.equal(loser.halfRewardLosses,1);
 assert.deepEqual(pointsBreakdown(loser),[{label:'负局 1 × 1',points:-1},{label:'15 分制负局 1 × 0.5',points:-0.5}]);
 const single=fixture();coinMatch(single.s,single.e,'single',{a:['p0'],b:['p2'],games:[{a:15,b:12}],scoreA:15,scoreB:12});
 const singles=singlesQuarterlyLeaderboard(single.s,'2035-Q1',single.now);assert.equal(singles.find(r=>r.playerId==='p0')!.points,1.5);assert.equal(singles.find(r=>r.playerId==='p2')!.points,-0.5);
});

test('生效后的活动改为 15 分制时奖励校正为半额，保留旧流水，已花奖励只形成待校正额且不扣独立发币',()=>{
 const {s,e,now}=fixture();delete e.gamePoints;coinMatch(s,e,'historical');reconcileAutomaticCoins(s,now);
 const oldLedger=structuredClone(s.treasureLedger),before=treasureBalance(s,'p0');
 const p=treasureProduct(s,s.accounts[0],{name:'测试礼品',description:'',price:before,stock:1,kind:'physical',active:true},now);
 treasureRedeem(s,s.accounts[0],{productId:p.id,quantity:1,expectedPrice:before,requestId:crypto.randomUUID()},now);
 e.gamePoints=15;assert.equal(reconcileAutomaticCoins(s,now+1),true);assert.equal(wins(s)[0].amount,1.5);assert.equal(treasureBalance(s,'p0'),0);
 assert.deepEqual(s.treasureLedger.slice(0,oldLedger.length),oldLedger);
 const desired=s.treasureRewardClaims.filter(r=>r.playerId==='p0').reduce((sum,r)=>sum+r.amount,0);assert.equal(pendingAutomaticCorrection(s,'p0'),before-desired);
 treasureGrant(s,s.accounts[0],{playerId:'p0',amount:10,reason:'独立发币',requestId:crypto.randomUUID()},now+2);
 const once=structuredClone(s);assert.equal(reconcileAutomaticCoins(s,now+3),false);assert.deepEqual(s,once);assert.equal(treasureBalance(s,'p0'),10);
});

test('生效时间之前结束的 15 分制活动不回算，积分与羽币保持原额',()=>{
 assert.equal(seasonGamePointsFactor({gamePoints:15,end:fifteenPointHalfFrom-1}),1);assert.equal(seasonGamePointsFactor({gamePoints:15,end:fifteenPointHalfFrom}),0.5);
 assert.equal(seasonGamePointsFactor({gamePoints:15,end:fifteenPointHalfFrom,tournament:{}}),1);assert.equal(seasonGamePointsFactor({gamePoints:15,end:fifteenPointHalfFrom,ranked:false}),1);
 const s=coinFixture(),old=coinEvent(s,'old',fifteenPointHalfFrom-1,{gamePoints:15}),fresh=coinEvent(s,'fresh',fifteenPointHalfFrom+86400000,{gamePoints:15});
 for(const e of [old,fresh]){for(const p of s.players)coinSignup(s,e,p.id);coinMatch(s,e,e.id+'-m',{games:[{a:15,b:12}],scoreA:15,scoreB:12})}
 activateAutomaticCoins(s,old.start-86400000);const now=fresh.end+1;reconcileAutomaticCoins(s,now);
 assert.deepEqual(wins(s).map(r=>[r.eventId,r.amount]),[['old',3],['fresh',2]],'old keeps the full win, the later one is halved (with its streak bonus)');
 const board=quarterlyLeaderboard(s,rankingQuarter(month(old.start)),now);assert.equal(board.find(r=>r.playerId==='p0')!.points,5);
 const loser=board.find(r=>r.playerId==='p2')!;assert.equal(loser.points,-1.5);assert.equal(loser.halfRewardLosses,1);assert.deepEqual(pointsBreakdown(loser),[{label:'负局 1 × 1',points:-1},{label:'15 分制负局 1 × 0.5',points:-0.5}]);
});

test('半个羽币可保留、兑换及退款，非法小数和不安全精度仍被拒绝',()=>{
 assert.equal(sumCoinAmounts([1.5,2,-1,0.5]),3);assert.equal(sumCoinAmounts([Number.MAX_SAFE_INTEGER]),Number.MAX_SAFE_INTEGER);
 for(const values of [[0.25],[NaN],[Infinity],[Number.MAX_SAFE_INTEGER,1],[0.5,Number.MAX_SAFE_INTEGER]])assert.throws(()=>sumCoinAmounts(values));
 const {s,e,now}=fixture();coinMatch(s,e,'half');reconcileAutomaticCoins(s,now);const balance=treasureBalance(s,'p0');
 const price=Math.floor(balance),p=treasureProduct(s,s.accounts[0],{name:'整数价格礼品',description:'',price,stock:1,kind:'physical',active:true},now);
 const order=treasureRedeem(s,s.accounts[0],{productId:p.id,quantity:1,expectedPrice:price,requestId:crypto.randomUUID()},now);assert.equal(treasureBalance(s,'p0'),balance-price);
 treasureOrder(s,s.accounts[0],{id:order.id,status:'cancelled'},now+1);assert.equal(treasureBalance(s,'p0'),balance);
 assert.throws(()=>treasureGrant(s,s.accounts[0],{playerId:'p0',amount:0.5,reason:'不扩大手动输入范围',requestId:crypto.randomUUID()},now));
});
