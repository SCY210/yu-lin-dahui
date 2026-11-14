import test from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {funBetGraceMinutes,funBetMaxStake,funBetPointAdjustments,funBetState} from '../lib/domain/fun-bets';
import {quarterlyLeaderboard} from '../lib/domain/ranking';
import {remindersForChange} from '../lib/reminder-contract';
import {pointsBreakdown} from '../lib/client/ranking-breakdown';
import type {Account,Match,State} from '../lib/domain/types';
import {coinEpoch as at,coinEvent,coinFixture,coinMatch,coinSignup} from './helpers/automatic-coins-fixture';

const minute=60000;
/** A points match of eight fictional members with one doubles game not started yet: p0+p1 against p2+p3. */
function setup(fields:Partial<Match>={}){
 const s=coinFixture(),e=coinEvent(s,'fun',at+120*minute);for(const p of s.players)coinSignup(s,e,p.id);
 const m=coinMatch(s,e,'game',{status:'published',start:null,end:null,scoreA:null,scoreB:null,games:[],enteredBy:null,...fields});
 const acc=(id:string)=>s.accounts.find(a=>a.playerId===id)!;
 return {s,e,m,acc,now:e.start+minute};
}
const create=(s:State,a:Account,stake:number,now:number,matchId='game')=>apply(s,a,'funBetCreate',{eventId:'fun',matchId,stake},now);
const respond=(s:State,a:Account,betId:string,accept:boolean,now:number)=>apply(s,a,'funBetRespond',{eventId:'fun',betId,accept},now);
function score(s:State,m:Match,a:number,b:number,now:number){Object.assign(m,{status:'complete',start:m.start??now-15*minute,end:now,scoreA:a,scoreB:b,games:[{a,b}]});}

test('any of the four proposes; it holds once all four accept, and the score moves the stake from each loser to each winner',async()=>{
 const {s,e,m,acc,now}=setup();
 await assert.rejects(()=>create(s,acc('p4'),10,now),/403/,'only the four of the game');
 await assert.rejects(()=>create(s,acc('p0'),funBetMaxStake+1,now),'over the cap');
 const before=structuredClone(s);await create(s,acc('p0'),10,now);const bet=e.funBets![0];
 assert.deepEqual([bet.by,bet.stake,bet.accepted],['p0',10,['p0']]);assert.equal(funBetState(bet,m,now),'pending');
 const notices=remindersForChange(s,before,'owner','fun',now).filter(n=>n.title==='趣味赛邀约');
 assert.deepEqual(notices[0].accountIds.sort(),['member1','member2','member3'],'the other three are asked');assert.match(notices[0].body,/10 积分/);
 await assert.rejects(()=>create(s,acc('p1'),5,now),/已经有趣味赛/,'one at a time per game');
 await assert.rejects(()=>apply(s,acc('p1'),'funBetCreate',{eventId:'fun',matchId:'game',stake:5,reason:'发起趣味赛'},now),/已经有趣味赛/,'the form\u2019s reason is accepted');
 await assert.rejects(()=>respond(s,acc('p4'),bet.id,true,now),/403/);
 for(const id of ['p1','p2'])await respond(s,acc(id),bet.id,true,now);
 assert.equal(funBetState(bet,m,now),'pending','three of four is not enough');
 await respond(s,acc('p3'),bet.id,true,now);assert.equal(funBetState(bet,m,now),'locked');
 await assert.rejects(()=>respond(s,acc('p3'),bet.id,false,now),/不能再更改/,'no backing out once it holds');
 score(s,m,21,15,e.start+20*minute);assert.equal(funBetState(bet,m,e.end),'won-a');
 assert.deepEqual(funBetPointAdjustments(s,e.end).map(g=>[g.playerId,g.delta]),[['p0',10],['p1',10],['p2',-10],['p3',-10]]);
 const board=quarterlyLeaderboard(s,'2035-Q1',e.end),row=(id:string)=>board.find(r=>r.playerId===id)!;
 assert.equal(row('p0').funBetWonPoints,10);assert.equal(row('p2').funBetLostPoints,-10);
 const without=quarterlyLeaderboard({...s,events:s.events.map(x=>({...x,funBets:[]}))},'2035-Q1',e.end);
 assert.equal(row('p0').points-without.find(r=>r.playerId==='p0')!.points,10);assert.equal(row('p3').points-without.find(r=>r.playerId==='p3')!.points,-10);
 assert.ok(pointsBreakdown(row('p0')).some(l=>l.label==='趣味赛赢分'&&l.points===10));assert.ok(pointsBreakdown(row('p2')).some(l=>l.label==='趣味赛输分'&&l.points===-10));
});

test('a refusal, a withdrawal, a missing answer when play starts, or a changed, cancelled or forfeited game moves no points',async()=>{
 {const {s,e,m,acc,now}=setup();await create(s,acc('p0'),5,now);const bet=e.funBets![0];
  await assert.rejects(()=>apply(s,acc('p1'),'funBetWithdraw',{eventId:'fun',betId:bet.id},now),/403/,'only the proposer withdraws');
  await respond(s,acc('p2'),bet.id,false,now);assert.equal(funBetState(bet,m,now),'declined');
  await create(s,acc('p1'),5,now);assert.equal(e.funBets!.length,2,'a new proposal after a refusal');
  await apply(s,acc('p1'),'funBetWithdraw',{eventId:'fun',betId:e.funBets![1].id},now);assert.equal(funBetState(e.funBets![1],m,now),'withdrawn');
  score(s,m,21,10,now+20*minute);assert.deepEqual(funBetPointAdjustments(s,e.end),[]);}
 {const {s,e,m,acc,now}=setup();await create(s,acc('p0'),5,now);const bet=e.funBets![0];
  Object.assign(m,{status:'playing',start:now});await respond(s,acc('p1'),bet.id,true,now+minute);
  await assert.rejects(()=>respond(s,acc('p2'),bet.id,true,now+funBetGraceMinutes*minute),/不能再更改/,'answers close five minutes into the game');
  assert.equal(funBetState(bet,m,now+funBetGraceMinutes*minute),'expired');score(s,m,21,10,now+20*minute);assert.deepEqual(funBetPointAdjustments(s,e.end),[]);}
 for(const change of ['swap','cancelled','forfeit','noShow'] as const){
  const {s,e,m,acc,now}=setup();await create(s,acc('p0'),5,now);const bet=e.funBets![0];
  for(const id of ['p1','p2','p3'])await respond(s,acc(id),bet.id,true,now);
  if(change==='swap')m.b=['p2','p4'];else if(change==='noShow')m.noShow=['p3'];else m.status=change;
  if(change==='swap')score(s,m,21,10,now+20*minute);
  assert.equal(funBetState(bet,m,e.end),'void',change);assert.deepEqual(funBetPointAdjustments(s,e.end),[],change);
 }
});

test('only doubles games of a points match between four members, before play starts',async()=>{
 {const {s,e,acc,now}=setup();e.ranked=false;await assert.rejects(()=>create(s,acc('p0'),5,now),/积分赛/,'not in an ordinary activity');}
 {const {s,acc,now}=setup();s.players.push({id:'friend',name:'Fictional friend',ownerId:'member1',guestEventId:'fun',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
  coinMatch(s,s.events[0],'with-friend',{a:['p4','friend'],b:['p5','p6'],status:'published',start:null,end:null,scoreA:null,scoreB:null,games:[]});
  await assert.rejects(()=>create(s,acc('p4'),5,now,'with-friend'),/正式成员/,'a friend has no points to stake');}
 {const {s,acc,now}=setup({status:'complete',start:at,end:at+minute,scoreA:21,scoreB:10,games:[{a:21,b:10}]});await assert.rejects(()=>create(s,acc('p0'),5,now),/已经开打/);}
 {const {s,m,acc,now}=setup({status:'playing'});m.start=now;await create(s,acc('p0'),5,now+minute);assert.equal(s.events[0].funBets!.length,1,'live play: a game just started is still open');}
});
