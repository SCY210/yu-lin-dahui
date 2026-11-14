import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {propose} from '../lib/domain/grouping';
import {fixedPartnerTeams} from '../lib/domain/fixed-partners';
import {fillLiveCourts} from '../lib/domain/live-play';
import {keepsLocks,lockSplits,lockedPartners,pickFour} from '../lib/domain/locked-pairs';
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

test('队列取四人时锁组两人一起入选，只剩一个位置时让给下一位',()=>{
 const none=new Map<string,string>();
 assert.deepEqual(pickFour(['a','b','c','d','e'],none),['a','b','c','d']);
 assert.equal(pickFour(['a','b','c'],none),undefined);
 const ae=new Map([['a','e'],['e','a']]);
 assert.deepEqual(pickFour(['a','b','c','d','e'],ae),['a','e','b','c'],'a pair is chosen when its first member is due');
 const de=new Map([['d','e'],['e','d']]);
 assert.deepEqual(pickFour(['a','b','c','d','f','e'],de),['a','b','c','f'],'a pair waits rather than taking the last seat alone');
 assert.deepEqual(pickFour(['a','b','c','d','e','f'],de),['d','e','a','b'],'the choice goes least far down the queue');
 assert.equal(pickFour(['a','b','c','d'],new Map([['d','x'],['x','d']])),undefined,'a locked player whose partner is not free waits');
 const two=new Map([['a','b'],['b','a'],['c','d'],['d','c']]);
 assert.deepEqual(pickFour(['a','c','b','d','e'],two),['a','b','c','d']);
 assert.ok(keepsLocks(['a','b','c','d'],two));assert.ok(!keepsLocks(['a','c','b','d'],two));assert.ok(!keepsLocks(['a','b','e','c'],two));
 assert.deepEqual(lockSplits(['a','e','b','c'],ae),[[['a','e'],['b','c']]]);
 assert.equal(lockSplits(['b','c','d','f'],ae),undefined);
 assert.deepEqual([...lockedPartners({lockedPairs:[['a','b'],['c','d']]},['a','b','c'])],[['a','b'],['b','a']],'only pairs whose two players are both available apply');
});

test('预排轮次中锁组两人同时上场并同队，其余球友照常轮换',()=>{
 for(const count of [8,10]){
  const {s,e}=fixture(count);e.lockedPairs=[['A',String.fromCharCode(64+count)]];
  const [x,y]=e.lockedPairs[0];
  for(let seed=1;seed<=25;seed++){
   const proposal=propose(s,e,start+120000,15,seed);
   const withX=proposal.courts.find(m=>onCourt(m,x)),withY=proposal.courts.find(m=>onCourt(m,y));
   assert.equal(withX,withY,`seed ${seed}: locked players play or rest together`);
   if(withX)assert.ok(together(withX,x,y),`seed ${seed}: locked players are partners`);
   if(count===8)assert.ok(withX,'with eight players and two courts everyone plays');
  }
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

test('实时排场中锁组两人总是同时上场并同队',()=>{
 const now=Date.parse('2030-10-10T16:00:00Z'),{state:s}=createSimulation(now),e=s.events[0];
 s.players=s.players.slice(0,10);s.accounts=s.accounts.slice(0,10);s.registrations=s.registrations.slice(0,10);s.bookings=s.bookings.slice(0,2);
 e.start=now-3600000;s.bookings.forEach(b=>b.start=e.start);s.registrations.forEach(r=>{r.arrival=e.start;r.registeredAt=e.start});
 e.livePlay={enabled:true,paused:false,preferences:[],completions:[],rest:[]};
 const ids=s.players.map(p=>p.id),[x,y]=[ids[0],ids[9]];e.lockedPairs=[[x,y]];
 let games=0;
 for(let i=0;i<12;i++){
  const at=now+i*600000;
  for(const m of s.matches.filter(m=>m.status==='playing')){m.status='complete';m.end=at-1000;m.scoreA=21;m.scoreB=19;m.games=[{a:21,b:19}]}
  const started:Match[]=fillLiveCourts(s,e,at,{});
  for(const m of started){
   assert.equal(onCourt(m,x),onCourt(m,y),`game ${i}: locked players come on court together`);
   if(onCourt(m,x)){assert.ok(together(m,x,y),`game ${i}: locked players are partners`);games++}
  }
 }
 assert.ok(games>=6,'the locked pair keeps getting turns');
});
