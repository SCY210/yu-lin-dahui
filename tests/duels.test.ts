import test from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {duelFour,duelMaxStake,duelPointAdjustments,duelState,pendingDuels} from '../lib/domain/duels';
import {propose} from '../lib/domain/grouping';
import {fillLiveCourts} from '../lib/domain/live-play';
import {quarterlyLeaderboard} from '../lib/domain/ranking';
import {remindersForChange} from '../lib/reminder-contract';
import {pointsBreakdown} from '../lib/client/ranking-breakdown';
import {duelAlertMinutes,startedDuels} from '../lib/client/duels';
import {emptyState,type Account,type Event,type Match,type Player,type State} from '../lib/domain/types';
import {coinEpoch as at,coinEvent,coinFixture,coinMatch,coinSignup} from './helpers/automatic-coins-fixture';

const minute=60000;
/** A doubles points match of eight fictional members that starts in an hour. */
function setup(){
 const s=coinFixture(),e=coinEvent(s,'duel',at+180*minute);for(const p of s.players)coinSignup(s,e,p.id);
 return {s,e,acc:(id:string)=>s.accounts.find(a=>a.playerId===id)!,before:e.start-60*minute};
}
const send=(s:State,a:Account,partner:string,opponents:[string,string],stake:number,now:number)=>apply(s,a,'duelCreate',{eventId:'duel',partner,opponents,stake,reason:'下天机战帖'},now);
const respond=(s:State,a:Account,duelId:string,accept:boolean,now:number)=>apply(s,a,'duelRespond',{eventId:'duel',duelId,accept},now);
async function accepted(){
 const x=setup();await send(x.s,x.acc('p0'),'p1',['p2','p3'],10,x.before);const d=x.e.duels![0];
 for(const id of ['p1','p2','p3'])await respond(x.s,x.acc(id),d.id,true,x.before);
 return {...x,d};
}

test('a member sends a challenge naming both teams before the start; it holds once all four accept',async()=>{
 const {s,e,acc,before}=setup();
 const prior=structuredClone(s);await send(s,acc('p0'),'p1',['p2','p3'],10,before);const d=e.duels![0];
 assert.deepEqual([d.a,d.b,d.stake,d.accepted],[['p0','p1'],['p2','p3'],10,['p0']]);assert.equal(duelState(d,e,s.matches,before),'pending');
 const asked=remindersForChange(s,prior,'owner','duel',before).filter(n=>n.title==='天机战帖');
 assert.deepEqual(asked[0].accountIds.sort(),['member1','member2','member3']);assert.match(asked[0].body,/每人以 10 积分为注/);
 await assert.rejects(()=>respond(s,acc('p4'),d.id,true,before),/403/,'only the four named');
 await assert.rejects(()=>send(s,acc('p1'),'p4',['p5','p6'],5,before),/未了结/,'one open challenge per player');
 for(const id of ['p1','p2'])await respond(s,acc(id),d.id,true,before);
 const almost=structuredClone(s);await respond(s,acc('p3'),d.id,true,before);
 assert.equal(duelState(d,e,s.matches,before),'locked');
 assert.deepEqual(remindersForChange(s,almost,'member3','on',before).filter(n=>n.title==='天机战帖已成').flatMap(n=>n.accountIds).sort(),['member1','member2','member3','owner']);
 await assert.rejects(()=>respond(s,acc('p3'),d.id,false,before),/不能再更改/,'no backing out once it holds');
});

test('only before the start, between four confirmed members, within the stake cap and agreeing with 锁组',async()=>{
 const {s,e,acc,before}=setup();
 await assert.rejects(()=>send(s,acc('p0'),'p1',['p2','p3'],10,e.start),/开始前/,'not once the activity started');
 await assert.rejects(()=>send(s,acc('p0'),'p1',['p1','p3'],10,before),/四位不同/);
 await assert.rejects(()=>send(s,acc('p0'),'p1',['p2','p3'],duelMaxStake+1,before));
 s.registrations.find(r=>r.playerId==='p3')!.status='waitlist';await assert.rejects(()=>send(s,acc('p0'),'p1',['p2','p3'],10,before),/正式接龙/);
 s.registrations.find(r=>r.playerId==='p3')!.status='confirmed';
 e.lockedPairs=[['p0','p4']];await assert.rejects(()=>send(s,acc('p0'),'p1',['p2','p3'],10,before),/锁组/);
 e.lockedPairs=[['p0','p1']];await send(s,acc('p0'),'p1',['p2','p3'],10,before);
 e.ranked=false;await assert.rejects(()=>send(s,acc('p4'),'p5',['p6','p7'],10,before),/积分赛/);
});

test('missing answers at the start, a refusal or a withdrawal end it; the first game between the teams settles it',async()=>{
 {const {s,e,acc,before}=setup();await send(s,acc('p0'),'p1',['p2','p3'],10,before);const d=e.duels![0];await respond(s,acc('p1'),d.id,true,before);
  assert.equal(duelState(d,e,s.matches,e.start),'expired');assert.deepEqual(pendingDuels(s,e),[]);
  await assert.rejects(()=>respond(s,acc('p2'),d.id,true,e.start),/开始前/);}
 {const {s,e,acc,before}=setup();await send(s,acc('p0'),'p1',['p2','p3'],10,before);const d=e.duels![0];
  await assert.rejects(()=>apply(s,acc('p1'),'duelWithdraw',{eventId:'duel',duelId:d.id},before),/403/);
  await respond(s,acc('p3'),d.id,false,before);assert.equal(duelState(d,e,s.matches,before),'declined');
  await send(s,acc('p0'),'p1',['p2','p3'],5,before);await apply(s,acc('p0'),'duelWithdraw',{eventId:'duel',duelId:e.duels![1].id},before);assert.equal(duelState(e.duels![1],e,s.matches,before),'withdrawn');}
 // Settled on the first game between the teams, whichever side each team was on.
 const {s,e,d}=await accepted();
 coinMatch(s,e,'other',{a:['p0','p2'],b:['p1','p3'],start:e.start+minute,end:e.start+10*minute,scoreA:21,scoreB:5,games:[{a:21,b:5}]});
 assert.equal(duelState(d,e,s.matches,e.start+11*minute),'locked','teams mixed up do not count');
 coinMatch(s,e,'duel-game',{a:['p3','p2'],b:['p1','p0'],start:e.start+20*minute,end:e.start+35*minute,scoreA:21,scoreB:18,games:[{a:21,b:18}]});
 assert.equal(duelState(d,e,s.matches,e.end),'won-b','p2 and p3 won from side a: the duel’s team b');
 assert.deepEqual(duelPointAdjustments(s,e.end).map(g=>[g.playerId,g.delta]),[['p2',10],['p3',10],['p0',-10],['p1',-10]]);
 const board=quarterlyLeaderboard(s,'2035-Q1',e.end),row=(id:string)=>board.find(r=>r.playerId===id)!;
 const without=quarterlyLeaderboard({...s,events:s.events.map(x=>({...x,duels:[]}))},'2035-Q1',e.end);
 assert.equal(row('p2').points-without.find(r=>r.playerId==='p2')!.points,10);assert.equal(row('p0').points-without.find(r=>r.playerId==='p0')!.points,-10);
 assert.ok(pointsBreakdown(row('p3')).some(l=>l.label==='天机战帖赢分'&&l.points===10));assert.ok(pointsBreakdown(row('p1')).some(l=>l.label==='天机战帖输分'&&l.points===-10));
});

test('a forfeited game, or no game between the teams by the end, moves no points',async()=>{
 {const {s,e,d}=await accepted();assert.equal(duelState(d,e,s.matches,e.end),'void');assert.deepEqual(duelPointAdjustments(s,e.end),[]);}
 {const {s,e,d}=await accepted();coinMatch(s,e,'g',{a:['p0','p1'],b:['p2','p3'],status:'forfeit',noShow:['p3'],start:e.start+minute,end:e.start+2*minute});
  assert.equal(duelState(d,e,s.matches,e.end),'void');assert.deepEqual(duelPointAdjustments(s,e.end),[]);}
});

// Scheduling: an eight-player doubles evening on two courts (as tests/locked-pairs.test.ts).
const start=Date.parse('2026-10-07T12:00:00Z');
const profile:NonNullable<Player['profile']>={years:2,hand:'right',preference:'doubles',style:'',equipment:''};
function evening(count=8){
 const s=emptyState();
 const e:Event={id:'event',title:'天机战帖排场',start,end:start+3*3600000,venue:'测试球馆',address:'',capacity:16,signupDeadline:start,cancelDeadline:start,note:'',status:'live',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events.push(e);s.accounts.push({id:'admin',email:'',playerId:'A',role:'admin'});
 for(let i=0;i<count;i++){
  const id=String.fromCharCode(65+i),rating=1600-i*60;
  s.players.push({id,name:id,ownerId:'admin',rating,initialRating:rating,ratedGames:20,enabled:true,ratingReason:'现场评估',profile:{...profile}});
  s.registrations.push({id:'reg-'+id,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 for(let i=0;i<Math.floor(count/4);i++)s.bookings.push({id:'court-'+i,eventId:e.id,name:String(i),start,end:e.end,pricing:'hourly',cents:1000});
 // The strongest with the weakest against the next two: a lineup balance alone would never choose.
 e.duels=[{id:'d',a:['A','H'],b:['B','G'],stake:10,by:'A',accepted:['A','H','B','G'],at:start-3600000}];
 return {s,e};
}
const sides=(m:{a:string[];b:string[]})=>[[...m.a].sort().join(''),[...m.b].sort().join('')].sort().join(' 对 ');

test('the planned schedule puts an accepted duel’s four on one court, as its two teams, once',()=>{
 const {s,e}=evening();
 const first=propose(s,e,start,15,7);
 assert.ok(first.courts.some(c=>sides(c)==='AH 对 BG'),JSON.stringify(first.courts));
 // Once the game is on the schedule, later rounds pair everyone as usual.
 const c=first.courts.find(c=>sides(c)==='AH 对 BG')!;
 s.rounds.push({id:'r1',eventId:e.id,start,duration:15,status:'draft',eligible:first.eligible,rest:[],seed:7});
 s.matches.push({id:'m1',eventId:e.id,roundId:'r1',courtId:c.courtId,a:c.a,b:c.b,status:'draft',start:null,end:null,scoreA:null,scoreB:null,games:[],monthly:true,elo:true,locked:false,enteredBy:null} as Match);
 assert.deepEqual(pendingDuels(s,e),[]);
});

test('planning a whole evening places the duel exactly once',async()=>{
 const {s,e}=evening();e.ranked=true;
 await apply(s,s.accounts[0],'planPoints',{eventId:e.id,at:start,pointsMinutes:90,roundMinutes:15,seed:3,pairing:'rotate'},start-minute);
 const games=s.matches.filter(m=>m.eventId===e.id&&m.status!=='cancelled');
 assert.ok(games.length>=8,String(games.length));
 assert.equal(games.filter(m=>sides(m)==='AH 对 BG').length,1,games.map(sides).join(', '));
});

test('live play starts an accepted duel when its players come up, as its two teams',()=>{
 const {s,e}=evening();e.schedulingMode='live';e.livePlay={enabled:true,paused:false,preferences:[],completions:[],rest:[]};
 const started=fillLiveCourts(s,e,start+minute,{allowSame:true});
 assert.ok(started.some(m=>sides(m)==='AH 对 BG'),JSON.stringify(started.map(sides)));
});

test('the queue decides: a duel is formed only from players as due as the ones they replace',()=>{
 const duel={id:'d',a:['A','H'] as [string,string],b:['B','G'] as [string,string],stake:5,by:'A',accepted:['A','H','B','G'],at:0};
 const order=['A','C','D','E','B','G','H','F'];
 assert.deepEqual(duelFour(order,order.slice(0,4),[duel],()=>true),['A','H','B','G']);
 assert.equal(duelFour(order,order.slice(0,4),[duel],()=>false),undefined,'not when the others are not as due');
 assert.equal(duelFour(order.filter(id=>id!=='G'),order.slice(0,4),[duel],()=>true),undefined,'not when one of the four is unavailable');
 assert.equal(duelFour(order,['C','D','E','F'],[duel],()=>true),undefined,'not when none of them is due');
});

test('a started duel game is announced for 15 minutes to everyone signed up, and the four are called by a reminder',async()=>{
 const {s,e,d}=await accepted();
 const prior=structuredClone(s);
 const m=coinMatch(s,e,'duel-game',{a:['p0','p1'],b:['p2','p3'],status:'playing',start:e.start+5*minute,end:null,scoreA:null,scoreB:null,games:[]});
 const view=(playerId:string)=>({events:s.events,matches:s.matches,registrations:s.registrations,bookings:s.bookings,me:{playerId}});
 const now=m.start!+minute;
 assert.deepEqual(startedDuels(view('p0'),now).map(x=>[x.duel.id,x.player,x.court]),[[d.id,true,'Court']]);
 assert.deepEqual(startedDuels(view('p5'),now).map(x=>x.player),[false],'others signed up watch the announcement');
 s.registrations.find(r=>r.playerId==='p6')!.status='waitlist';assert.deepEqual(startedDuels(view('p6'),now),[],'not someone who is not playing tonight');
 assert.deepEqual(startedDuels(view('p0'),m.start!+duelAlertMinutes*minute),[],'no longer after 15 minutes');
 const called=remindersForChange(s,prior,'owner','start',now).filter(n=>n.title==='天机战帖开战');
 assert.deepEqual(called.flatMap(n=>n.accountIds).sort(),['member1','member2','member3','owner']);assert.equal(called[0].roundId,m.roundId);assert.match(called[0].body,/Court斗法开场/);
 assert.deepEqual(remindersForChange(s,s,'owner','again',now).filter(n=>n.title==='天机战帖开战'),[],'once');
 m.status='complete';m.scoreA=21;m.scoreB=10;m.games=[{a:21,b:10}];m.end=now;assert.deepEqual(startedDuels(view('p0'),now),[],'not once scored');
});
