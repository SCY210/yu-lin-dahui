import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityRecap} from '../lib/domain/activity-recap';
import type {Match} from '../lib/domain/types';

const start=Date.parse('2030-03-01T18:00:00Z');
let n=0;
function game(a:string[],b:string[],scoreA:number,scoreB:number,eventId='e'):Match{
 n++;return {id:'m'+n,eventId,roundId:'r'+n,courtId:'c',a,b,status:'complete',start:start+n*600000,end:start+n*600000+500000,games:[{a:scoreA,b:scoreB}],scoreA,scoreB} as Match;
}

test('the recap of a fictional activity names top winners, streaks, the best pair and the closest and most one-sided games',()=>{
 n=0;
 const matches=[
  game(['p1','p2'],['p3','p4'],21,15),
  game(['p1','p2'],['p5','p6'],21,8),
  game(['p1','p3'],['p2','p4'],23,21),
  game(['p5','p6'],['p1','p2'],21,19),
  game(['p3','p4'],['p5','p6'],21,17),
  game(['x1','x2'],['x3','x4'],21,0,'other'),
  {...game(['p1','p2'],['p3','p4'],0,0),status:'playing',end:null} as Match,
 ];
 const r=activityRecap(matches,'e');
 assert.equal(r.games,5,'only completed games of this activity');assert.equal(r.players,6);
 assert.equal(r.points,21+15+21+8+23+21+21+19+21+17);
 assert.deepEqual(r.topWinners.map(p=>[p.playerId,p.wins,p.losses]),[['p1',3,1]]);
 assert.deepEqual(r.streak,{playerIds:['p1'],length:3});
 assert.deepEqual(r.pair,{playerIds:['p1','p2'],wins:2,games:3});
 assert.equal(r.closest!.matchId,'m3','smallest margin, then most points');
 assert.equal(r.rout!.matchId,'m2');
 assert.deepEqual(r.byPlayer.p4,{playerId:'p4',games:3,wins:1,losses:2});
 assert.equal(r.bestRate,undefined,'nobody beats the top winner\'s rate');
});

test('an activity without scored games has an empty recap; ties share the top and no small streak is shown',()=>{
 n=0;
 assert.equal(activityRecap([],'e').games,0);
 const r=activityRecap([game(['a'],['b'],21,19),game(['c'],['d'],21,10)],'e');
 assert.deepEqual(r.topWinners.map(p=>p.playerId),['a','c']);
 assert.equal(r.streak,undefined);assert.equal(r.pair,undefined,'singles have no pair');assert.equal(r.rout!.matchId,'m2');
});
