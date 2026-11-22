import {test} from 'node:test';
import assert from 'node:assert/strict';
import {balanceCost,compareBalance,compareLiveDoublesPriority,CRUSH_GAP} from '../lib/domain/match-balance';
import {matchHistory} from '../lib/domain/match-history';
import type {Match} from '../lib/domain/types';

// The club's order (November 2026, docs/MATCH_GROUPING.md): fair turns decide who plays; then gender protection, then
// no 实力碾压, then repeats and the same people on one court, then variety, and 萌新 away from the strong last.

test('a gap above 80 is avoided before repeats, blocks and court waits, but after gender protection',()=>{
 assert.equal(CRUSH_GAP,80);
 const crush=balanceCost([120],0),repeat=balanceCost([30],0,0,1,1,0,1,1,1);
 assert.ok(compareBalance(repeat,crush)<0,'a rematch of the same four, a block and a court wait are better than a 120-point gap');
 assert.ok(compareLiveDoublesPriority(repeat,crush)<0,'live play too');
 assert.ok(compareBalance(balanceCost([120],0),balanceCost([30],0,1))<0,'gender protection still comes first');
 assert.equal(balanceCost([80],0).crush,0,'80 is not yet a crush');
 assert.equal(balanceCost([70,95],0).crush,15,'only the part above 80 counts, summed over courts');
 assert.ok(compareBalance(balanceCost([90],0),balanceCost([140],0))<0,'when every line-up crushes, the smaller crush wins');
});

test('two players who keep sharing a court are split up, before variety; keeping 萌新 apart comes last',()=>{
 const often=balanceCost([20],0,0,0,0,0,0,0,0,0,0,0,9),fresh=balanceCost([20],500,0,0,0,0,0,0,0,0,0,0,2);
 assert.ok(compareBalance(fresh,often)<0,'fewer earlier games together wins over partner and opponent variety');
 const newbie=balanceCost([20],0,0,0,0,0,0,0,0,0,0,6),varied=balanceCost([20],100);
 assert.ok(compareBalance(newbie,varied)<0,'variety outranks keeping 萌新 away from the strong');
 assert.ok(compareBalance(balanceCost([20],0),balanceCost([20],0,0,0,0,0,0,0,0,0,0,6))<0,'among equals 萌新 still play the weaker players');
});

test('the history counts every earlier game two players shared, as partners or opponents',()=>{
 const game=(id:string,a:string[],b:string[],start:number):Match=>({id,eventId:'e',roundId:'r'+id,courtId:'c',status:'complete',start,end:start+1,a,b,scoreA:21,scoreB:15,monthly:true,elo:true,locked:false,enteredBy:null,games:[]} as Match);
 const history=matchHistory({matches:[game('1',['p1','p2'],['p3','p4'],1),game('2',['p1','p3'],['p5','p6'],2),game('x',['p1','p2'],['p3','p4'],3)].map((m,i)=>i===2?{...m,status:'cancelled' as const}:m),rounds:[]},'e');
 assert.equal(history.together(['p1','p3']),2,'partners once, opponents once; a cancelled game does not count');
 assert.equal(history.together(['p1','p2','p3','p4']),2+1+1+1+1+1,'all six pairs of a court');
 assert.equal(history.together(['p2','p5']),0);
});
