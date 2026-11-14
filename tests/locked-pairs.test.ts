import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {propose} from '../lib/domain/grouping';
import {fixedPartnerTeams} from '../lib/domain/fixed-partners';
import {fillLiveCourts} from '../lib/domain/live-play';
import {keepsLocks,lockCounts,lockSplits,lockedPartners,pickFour} from '../lib/domain/locked-pairs';
import {createSimulation} from './helpers/scheduling-fixture';
import {emptyState,type Event,type Match,type Player} from '../lib/domain/types';

const start=Date.parse('2026-10-07T12:00:00Z');
const profile:NonNullable<Player['profile']>={years:2,hand:'right',preference:'doubles',style:'',equipment:''};
function fixture(count:number){
 const s=emptyState();
 const e:Event={id:'event',title:'锁组测试',start,end:start+3*3600000,venue:'测试球馆',address:'',capacity:16,signupDeadline:start,cancelDeadline:start,note:'',status:'live',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events.push(e);s.accounts.push({id:'admin',email:'',playerId:'A',role:'admin'},{id:'member',email:'',playerId:'B',role:'member'});
 for(let i=0;i<count;i++){
  const id=String.fromCharCode(65+i),rating=1600-i*60;
  s.players.push({id,name:id,ownerId:i===1?'member':'admin',rating,initialRating:rating,ratedGames:20,enabled:true,ratingReason:'现场评估',profile:{...profile}});
  s.registrations.push({id:'reg-'+id,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 for(let i=0;i<Math.floor(count/4);i++)s.bookings.push({id:'court-'+i,eventId:e.id,name:String(i),start,end:e.end,pricing:'hourly',cents:1000});
 return {s,e};
}
const admin=(s:ReturnType<typeof fixture>['s'])=>s.accounts[0],member=(s:ReturnType<typeof fixture>['s'])=>s.accounts[1];
const together=(m:{a:string[];b:string[]},x:string,y:string)=>[m.a,m.b].some(team=>team.includes(x)&&team.includes(y));
const onCourt=(m:{a:string[];b:string[]},id:string)=>[...m.a,...m.b].includes(id);

test('队列取四人时轮次优先：同样该上的搭档一起入选，否则锁组一人先打',()=>{
 const none=new Map<string,string>(),same=()=>true,never=()=>false;
 assert.deepEqual(pickFour(['a','b','c','d','e'],none),['a','b','c','d']);
 assert.equal(pickFour(['a','b','c'],none),undefined);
 const de=new Map([['d','e'],['e','d']]);
 assert.deepEqual(pickFour(['a','b','c','d','e','f'],de,same),['d','e','a','b'],'an as-due partner replaces the least due player');
 assert.deepEqual(pickFour(['a','b','c','d','e','f'],de,(out,incoming)=>incoming==='f'),['a','b','c','f'],'or the locked player gives their seat to someone as due');
 assert.deepEqual(pickFour(['a','b','c','d','e','f'],de,never),['a','b','c','d'],'when turns differ, the due player plays without their partner');
 const ae=new Map([['a','e'],['e','a']]);
 assert.deepEqual(pickFour(['a','b','c','e','d'],ae),['a','e','b','c'],'a complete pair comes first so it is one team');
 const two=new Map([['a','b'],['b','a'],['c','d'],['d','c']]);
 assert.deepEqual(pickFour(['a','c','b','d','e'],two),['a','b','c','d']);
 assert.ok(keepsLocks(['a','b','c','d'],two));assert.ok(!keepsLocks(['a','c','b','d'],two));
 assert.ok(keepsLocks(['a','e','c','d'],two),'one of a pair may play without the other');
 const required=lockCounts(['a','e','c','d'],two);
 assert.ok(!keepsLocks(['f','e','c','d'],two,required),'a search swap cannot drop the one chosen');
 assert.ok(!keepsLocks(['a','b','c','d'],two,required),'or bring in the other half');
 assert.deepEqual(lockSplits(['a','e','b','c'],ae),[[['a','e'],['b','c']]]);
 assert.equal(lockSplits(['b','c','d','f'],ae),undefined);
 assert.deepEqual([...lockedPartners({lockedPairs:[['a','b'],['c','d']]},['a','b','c'])],[['a','b'],['b','a']],'only pairs whose two players are both available apply');
});

/** Plays `rounds` planned rounds and returns each player's games and how many games the locked pair played together. */
function playPlanned(count:number,courts:number,lock:[string,string],rounds:number){
 const {s,e}=fixture(count);e.end=start+rounds*16*60000+3600000;s.bookings.splice(courts);s.bookings.forEach(b=>b.end=e.end);s.registrations.forEach(r=>r.departure=e.end);
 e.lockedPairs=[lock];let paired=0;
 for(let r=0;r<rounds;r++){
  const at=start+r*16*60000+60000,proposal=propose(s,e,at,15,r+1),id='round-'+r;
  const withX=proposal.courts.find(m=>onCourt(m,lock[0])),withY=proposal.courts.find(m=>onCourt(m,lock[1]));
  if(withX&&withY){assert.equal(withX,withY,`round ${r}: both locked players are on one court`);assert.ok(together(withX,...lock),`round ${r}: and partners`);paired++}
  s.rounds.push({id,eventId:e.id,start:at,duration:15,status:'complete',eligible:proposal.eligible,rest:proposal.rest,seed:r+1});
  proposal.courts.forEach((c,i)=>s.matches.push({...c,id:id+'-'+i,eventId:e.id,roundId:id,status:'complete',start:at,end:at+15*60000,scoreA:21,scoreB:19,games:[{a:21,b:19}],monthly:true,elo:true,locked:false,enteredBy:'admin'}));
 }
 return {games:s.players.map(p=>s.matches.filter(m=>onCourt(m,p.id)).length),paired,ids:s.players.map(p=>p.id)};
}

test('预排轮次中锁组两人同时上场必定同队，且上场次数与其他球友相差不超过一局',()=>{
 for(const [count,courts] of [[8,2],[9,2],[10,2],[13,2],[5,1],[7,1]] as const){
  const lock:[string,string]=['A',String.fromCharCode(64+count)],{games,paired,ids}=playPlanned(count,courts,lock,20);
  const others=games.filter((_,i)=>!lock.includes(ids[i])),mine=games.filter((_,i)=>lock.includes(ids[i]));
  for(const n of mine)assert.ok(n>=Math.min(...others)-1&&n<=Math.max(...others)+1,`${count} players on ${courts} courts: locked ${mine} vs others ${Math.min(...others)}-${Math.max(...others)}`);
  assert.ok(paired>=Math.min(...mine)*0.6,`${count} players on ${courts} courts: the pair mostly plays together (${paired} of ${mine})`);
 }
});

test('锁组一人未到时另一人照常轮换；擂台玩法不使用锁组',()=>{
 const {s,e}=fixture(8);e.lockedPairs=[['A','H']];
 s.registrations.find(r=>r.playerId==='H')!.status='cancelled';
 s.bookings.pop();
 const proposal=propose(s,e,start+120000,15,3);
 assert.equal(proposal.courts.length,1);
 assert.equal(lockedPartners(e,proposal.eligible).size,0);
});

test('固定搭档模式下锁组两人组成同一队',()=>{
 const {s,e}=fixture(8);e.lockedPairs=[['A','H']];
 const teams=fixedPartnerTeams(s,e);
 assert.ok(teams.some(t=>t.includes('A')&&t.includes('H')));
 assert.equal(new Set(teams.flat()).size,teams.flat().length);
});

test('创建者可以锁定和取消锁组，并校验球友与重复锁组',async()=>{
 const {s,e}=fixture(8);
 await assert.rejects(apply(s,member(s),'pairLock',{eventId:e.id,playerIds:['A','B']},start),/403/);
 await assert.rejects(apply(s,admin(s),'pairLock',{eventId:e.id,playerIds:['A','A']},start),/不同/);
 await apply(s,admin(s),'pairLock',{eventId:e.id,playerIds:['A','B']},start);
 assert.deepEqual(e.lockedPairs,[['A','B']]);
 await apply(s,admin(s),'pairLock',{eventId:e.id,playerIds:['B','A']},start);
 assert.equal(e.lockedPairs!.length,1,'locking the same pair again changes nothing');
 await assert.rejects(apply(s,admin(s),'pairLock',{eventId:e.id,playerIds:['A','C']},start),/已经和B锁组/);
 s.registrations.find(r=>r.playerId==='D')!.status='waitlist';
 await assert.rejects(apply(s,admin(s),'pairLock',{eventId:e.id,playerIds:['C','D']},start),/正式接龙/);
 await apply(s,admin(s),'pairUnlock',{eventId:e.id,playerId:'B'},start);
 assert.equal(e.lockedPairs,undefined);
 assert.deepEqual(s.audits.filter(a=>a.action==='pairLock'||a.action==='pairUnlock').map(a=>a.action),['pairLock','pairUnlock']);
 e.end=start;await assert.rejects(apply(s,admin(s),'pairLock',{eventId:e.id,playerIds:['A','B']},start),/已结束/);
});

test('单打活动不能锁组',async()=>{
 const {s,e}=fixture(8);e.matchFormat='singles';
 await assert.rejects(apply(s,admin(s),'pairLock',{eventId:e.id,playerIds:['A','B']},start),/双打/);
});

test('实时排场中锁组两人同一局必定同队，上场次数与其他球友相差不超过一局',()=>{
 for(const count of [10,11,13]){
  const now=Date.parse('2030-10-10T16:00:00Z'),{state:s}=createSimulation(now),e=s.events[0];
  while(s.players.length<count){const i=s.players.length;s.players.push({...s.players[0],id:'extra-'+i});s.registrations.push({...s.registrations[0],id:'extra-registration-'+i,playerId:'extra-'+i})}
  s.players=s.players.slice(0,count);s.registrations=s.registrations.slice(0,count);s.bookings=s.bookings.slice(0,2);
  e.start=now-3600000;e.end=now+12*3600000;s.bookings.forEach(b=>{b.start=e.start;b.end=e.end});s.registrations.forEach(r=>{r.arrival=e.start;r.registeredAt=e.start;r.departure=e.end});
  e.livePlay={enabled:true,paused:false,preferences:[],completions:[],rest:[]};
  const ids=s.players.map(p=>p.id),[x,y]=[ids[0],ids[count-1]];e.lockedPairs=[[x,y]];
  let at=now,paired=0;
  for(let i=0;i<30;i++){
   at+=300000;const playing=s.matches.filter(m=>m.status==='playing').sort((a,b)=>a.start!-b.start!);
   let started:Match[];
   if(playing.length){const m=playing[0];m.status='complete';m.end=at-1000;m.scoreA=21;m.scoreB=19;m.games=[{a:21,b:19}];started=fillLiveCourts(s,e,at,{courtId:m.courtId})}else started=fillLiveCourts(s,e,at,{});
   for(const m of started)if(onCourt(m,x)&&onCourt(m,y)){assert.ok(together(m,x,y),`game ${i}: locked players in one game are partners`);paired++}
  }
  const games=ids.map(id=>s.matches.filter(m=>onCourt(m,id)).length),others=games.slice(1,-1),mine=[games[0],games[count-1]];
  for(const n of mine)assert.ok(n>=Math.min(...others)-1&&n<=Math.max(...others)+1,`${count} players: locked ${mine} vs others ${Math.min(...others)}-${Math.max(...others)}`);
  assert.ok(paired>=Math.min(...mine)*0.6,`${count} players: the pair mostly plays together (${paired} of ${mine})`);
 }
});
