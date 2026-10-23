import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../lib/admin-simulation';
import {apply} from '../lib/domain/commands';
import {startDuePointsSessions} from '../lib/domain/points-auto-start';
import {propose,tiredPlayers,maxConsecutiveRounds} from '../lib/domain/grouping';
import {hasEmptyLiveCourt} from '../lib/domain/live-play';
import {roundLineupSnapshot,swapRoundPlayers} from '../lib/domain/round-lineup';
import {recentlyEnded} from '../lib/client/home-today';
import type {Match,Round,State} from '../lib/domain/types';

const minute=60000,base=Date.parse('2026-10-14T16:00:00Z');
/** Nobody is on two courts of one round, or on two courts that are playing at the same time. */
function doubleBooked(s:State){
 const rounds=new Map<string,string[]>(),playing=s.matches.filter(m=>m.status==='playing').flatMap(m=>[...m.a,...m.b]);
 for(const m of s.matches)if(m.status!=='cancelled')rounds.set(m.roundId,[...rounds.get(m.roundId)??[],...m.a,...m.b]);
 return [...rounds.values(),playing].some(ids=>new Set(ids).size!==ids.length);
}
function planned(count=12){
 const s=createSimulation(base).state,e=s.events[0];e.schedulingMode='planned';delete e.livePlay;
 s.registrations=s.registrations.slice(0,count);return {s,e,a:s.accounts[0]};
}

test('a late player is never replaced by someone from another court of the same round',async()=>{
 const {s,e,a}=planned(8);
 await apply(s,a,'planPoints',{eventId:e.id,at:e.start,pointsMinutes:60,roundMinutes:15,seed:3,pairing:'rotate'},e.start-minute);await apply(s,a,'publishPoints',{eventId:e.id},e.start-minute);
 await startDuePointsSessions(s,e.start,apply);
 const round=s.rounds.find(r=>r.pointsSlot===1)!,[first,second]=s.matches.filter(m=>m.roundId===round.id);
 // One court starts later, so its four players are scheduled but not yet playing; nobody else is free.
 second.status='published';second.start=null;
 await apply(s,a,'pointsLate',{matchId:first.id,playerId:first.a[0],replacement:'player',expectedA:[...first.a],expectedB:[...first.b]},e.start+minute);
 assert.equal(doubleBooked(s),false);
 assert.ok(!s.matches.some(m=>m.roundId===round.id&&m.status!=='cancelled'&&m.id!==second.id&&[...m.a,...m.b].some(id=>[...second.a,...second.b].includes(id))),'the other court keeps its own players');
 assert.equal(s.events[0].pointsSession!.waiting.length,1,'with nobody free the court waits instead');
});

test('a game on court cannot take a player who is playing on another court right now',()=>{
 const {s,e}=planned(12);const ids=s.players.map(p=>p.id);
 const round:Round={id:'r',eventId:e.id,start:e.start,duration:15,status:'playing',eligible:ids,rest:ids.slice(4),seed:1,pointsSlot:2};
 const game:Match={id:'g',eventId:e.id,roundId:'r',courtId:s.bookings[0].id,a:ids.slice(0,2),b:ids.slice(2,4),status:'playing',start:e.start,end:null,scoreA:null,scoreB:null,games:[],locked:false,enteredBy:null,monthly:true,elo:true};
 const other:Match={...structuredClone(game),id:'o',roundId:'earlier',courtId:s.bookings[1].id,a:ids.slice(4,6),b:ids.slice(6,8)};
 s.rounds.push(round);s.matches.push(game,other);
 const before=structuredClone(s);
 assert.throws(()=>swapRoundPlayers(s,round,ids[0],ids[4],e.start+minute,roundLineupSnapshot([game])),/另一片场地比赛/);assert.deepEqual(s,before);
 swapRoundPlayers(s,round,ids[0],ids[9],e.start+minute,roundLineupSnapshot([game]));assert.ok(game.a.includes(ids[9]),'a free player can still come on');
});

test('random planned-schedule operations never put anyone on two courts at once',async()=>{
 let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647},pick=<T,>(a:T[])=>a[Math.floor(rnd()*a.length)];
 for(let run=0;run<4;run++){
  const {s,e,a}=planned(run%2?10:12);if(run===1)s.bookings.push({...s.bookings[0],id:'court-3',name:'模拟 3 号场'});
  await apply(s,a,'planPoints',{eventId:e.id,at:e.start,pointsMinutes:180,roundMinutes:15,seed:run+1,pairing:'rotate'},e.start-minute);await apply(s,a,'publishPoints',{eventId:e.id},e.start-minute);
  for(let t=e.start;t<e.start+150*minute;t+=minute){
   await startDuePointsSessions(s,t,apply);
   const playing=s.matches.filter(m=>m.status==='playing'),open=s.matches.filter(m=>['published','playing'].includes(m.status)&&!m.games.length&&m.scoreA===null),op=rnd();
   try{
    if(op<.3&&playing.length){const m=pick(playing);if(t-(m.start??t)>8*minute)await apply(s,a,'score',{matchId:m.id,a:21,b:15},t)}
    else if(op<.4&&open.length){const m=pick(open);if(s.rounds.find(r=>r.id===m.roundId)!.start<=t)await apply(s,a,'pointsLate',{matchId:m.id,playerId:pick([...m.a,...m.b]),replacement:rnd()<.5?'player':'group',expectedA:[...m.a],expectedB:[...m.b]},t)}
    else if(op<.5&&open.length){const m=pick(open),round=s.matches.filter(x=>x.roundId===m.roundId&&x.status!=='cancelled');await apply(s,a,'swap',{roundId:m.roundId,p1:pick([...m.a,...m.b]),p2:pick(s.players).id,expectedLineup:roundLineupSnapshot(round)},t)}
    else if(op<.53)await apply(s,a,'pointsNext',{eventId:e.id,expectedRoundIds:s.rounds.filter(r=>r.eventId===e.id).map(r=>r.id).sort()},t);
   }catch{/* Refused operations change nothing. */}
   assert.equal(doubleBooked(s),false,'run '+run+' at +'+(t-e.start)/minute+' min');
  }
 }
});

test('after three rounds in a row a player rests whenever somebody else can play, but courts stay full',()=>{
 const {s,e}=planned(12),ids=s.players.map(p=>p.id),court=s.bookings[0].id;
 // ids[0..3] played the last three rounds on one court; everyone else rested.
 for(let i=0;i<maxConsecutiveRounds;i++){s.rounds.push({id:'r'+i,eventId:e.id,start:e.start+i*15*minute,duration:15,status:'complete',eligible:ids,rest:ids.slice(4),seed:1,pointsSlot:i+1});s.matches.push({id:'m'+i,eventId:e.id,roundId:'r'+i,courtId:court,a:ids.slice(0,2),b:ids.slice(2,4),status:'complete',start:e.start+i*15*minute,end:e.start+(i*15+12)*minute,scoreA:21,scoreB:15,games:[{a:21,b:15}],locked:false,enteredBy:null,monthly:true,elo:true})}
 assert.deepEqual([...tiredPlayers(s,e.id)].sort(),ids.slice(0,4).sort());
 const at=e.start+50*minute,next=propose(s,e,at,15,1),playing=next.courts.flatMap(c=>[...c.a,...c.b]);
 assert.equal(next.courts.length,2);assert.ok(ids.slice(0,4).every(id=>!playing.includes(id)),'the tired four rest');
 // With only eight players, both courts still need everyone.
 const few=planned(8);for(const r of s.rounds)few.s.rounds.push(structuredClone(r));for(const m of s.matches)few.s.matches.push(structuredClone(m));
 assert.equal(propose(few.s,few.e,at,15,1).courts.length,2,'never leaves a court short for this rule');
});

async function live(count=12,courts=2){
 const s=createSimulation(base).state,e=s.events[0];s.registrations=s.registrations.slice(0,count);if(courts===1)s.bookings=s.bookings.slice(0,1);
 await apply(s,s.accounts[0],'liveStart',{eventId:e.id},e.start+minute);return {s,e};
}
const players=(m:Match)=>[...m.a,...m.b];

test('live play: a scored court waits for 开始组队, which retains winners and refuses the same four even with an old override',async()=>{
 const {s,e}=await live(12,2),[first]=s.matches.filter(m=>m.status==='playing'),member=s.accounts.find(a=>a.playerId===first.a[0])!;
 const bench=s.players.map(p=>p.id).filter(id=>!s.matches.some(m=>m.status==='playing'&&players(m).includes(id)));
 await apply(s,member,'score',{matchId:first.id,a:21,b:19},e.start+15*minute);
 assert.ok(!s.matches.some(m=>m.status==='playing'&&m.courtId===first.courtId),'no next game on its own');
 assert.equal(hasEmptyLiveCourt(s,e,e.start+16*minute),false,'the clock does not treat a waiting court as work');
 await apply(s,member,'liveNext',{eventId:e.id,courtId:first.courtId},e.start+16*minute);
 const next=s.matches.find(m=>m.status==='playing'&&m.courtId===first.courtId)!;assert.ok(first.a.every(id=>players(next).includes(id)));assert.equal(players(next).filter(id=>bench.includes(id)).length,2);
 const outsider={id:'outsider',email:'',role:'member' as const,playerId:'nobody'};s.accounts.push(outsider);
 await apply(s,member,'score',{matchId:next.id,a:21,b:19},e.start+30*minute);
 await assert.rejects(()=>apply(s,outsider,'liveNext',{eventId:e.id,courtId:first.courtId},e.start+31*minute),/403/);
 // Four players on one court: only the same four are left.
 const solo=await live(4,1),[game]=solo.s.matches,owner=solo.s.accounts[0];
 await apply(solo.s,owner,'score',{matchId:game.id,a:21,b:19},solo.e.start+15*minute);
 await assert.rejects(()=>apply(solo.s,owner,'liveNext',{eventId:solo.e.id,courtId:game.courtId},solo.e.start+16*minute),/人数不足/);
 await assert.rejects(()=>apply(solo.s,owner,'liveNext',{eventId:solo.e.id,courtId:game.courtId,allowSame:true},solo.e.start+16*minute),/人数不足/);
 assert.equal(solo.s.matches.filter(m=>m.status==='playing').length,0);
});

test('the MVP prompt stays on the home page while the vote is open',()=>{
 const s=createSimulation(base).state,e=s.events[0],me=s.accounts[1],data={...s,me};
 assert.equal(recentlyEnded(data,e.end+23*60*minute).length,1,'23 hours after the end');
 assert.equal(recentlyEnded(data,e.end+24*60*minute).length,0,'gone when voting closes');
});
