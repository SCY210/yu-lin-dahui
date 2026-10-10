import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Event,type Round,type Match} from '../lib/domain/types';
import {schedulingMode,pendingSchedulingIds,cancelPendingScheduling} from '../lib/domain/scheduling';
const start=Date.parse('2030-10-10T13:00:00Z'),minute=60000;
function fixture(){const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';for(let i=0;i<8;i++){const id=i?'member'+i:'owner';s.accounts.push({id,email:'',playerId:'p'+i,role:i?'member':'admin'});s.players.push({id:'p'+i,name:'p'+i,ownerId:id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''})}const e:Event={id:'e',creatorId:'owner',title:'Fixture scheduling',start,end:start+120*minute,venue:'Fixture venue',address:'',capacity:8,signupDeadline:start+120*minute,cancelDeadline:start-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};s.events=[e];s.bookings=[{id:'court',eventId:e.id,name:'Court',start,end:e.end,pricing:'total',cents:1380}];s.registrations=s.players.map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,sequence:i,status:'confirmed',arrival:start,departure:e.end,registeredAt:start-minute,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));return {s,e,owner:s.accounts[0]}}
const payload=(s:ReturnType<typeof emptyState>,e:Event,mode:'planned'|'round'|'live')=>({eventId:e.id,mode,expectedMode:schedulingMode(s,e),expectedPendingIds:pendingSchedulingIds(s,e.id)});
test('old planned and ordinary rounds retain their mode while an unscheduled activity defaults to live',()=>{
 const {s,e}=fixture();assert.equal(schedulingMode(s,e),'live');const r:Round={id:'old',eventId:e.id,start,duration:15,status:'published',eligible:[],rest:[],seed:1,pointsSlot:1};s.rounds=[r];assert.equal(schedulingMode(s,e),'planned');r.status='cancelled';assert.equal(schedulingMode(s,e),'planned');delete r.pointsSlot;assert.equal(schedulingMode(s,e),'round');e.livePlay={enabled:true,paused:false,preferences:[],rest:[],completions:[]};assert.equal(schedulingMode(s,e),'live');
});
test('switching cancels only unstarted games and preserves active games, completed scores and break preferences',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'liveStart',{eventId:e.id},start);const current=s.matches[0],before=structuredClone(current);e.livePlay!.preferences=[{playerId:'p0',avoidConsecutive:true}];
 const r:Round={...s.rounds[0],id:'future',status:'draft',pointsSlot:1,start:start+30*minute};s.rounds.push(r);s.matches.push({...structuredClone(current),id:'future-game',roundId:r.id,status:'draft',start:null});
 await apply(s,owner,'schedulingMode',payload(s,e,'planned'),start+minute);assert.deepEqual(current,before);assert.equal(s.matches[1].status,'cancelled');assert.equal(r.status,'cancelled');assert.equal(e.livePlay!.enabled,false);assert.equal(e.livePlay!.preferences[0].avoidConsecutive,true);
 await apply(s,owner,'score',{matchId:current.id,a:21,b:19},start+2*minute);assert.equal(s.matches.length,2,'switching off live prevents automatic replacement');const scored=structuredClone(current);
 await apply(s,owner,'planPoints',{eventId:e.id,at:start+30*minute,pointsMinutes:30,roundMinutes:15,seed:7,pairing:'rotate'},start+3*minute);assert.deepEqual(current,scored);assert.equal(s.rounds.filter(r=>r.status==='draft').length,2);assert.equal(e.schedulingMode,'planned');
});
test('planned, one-round and live workflows can be switched through with independent score advancement',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'schedulingMode',payload(s,e,'planned'),start-minute);
 await apply(s,owner,'planPoints',{eventId:e.id,at:start,pointsMinutes:60,roundMinutes:15,seed:1,pairing:'rotate'},start-minute);await apply(s,owner,'publishPoints',{eventId:e.id},start-minute);assert.equal(s.rounds.filter(r=>r.status==='published').length,4);
 await apply(s,owner,'schedulingMode',payload(s,e,'round'),start);assert.ok(s.rounds.every(r=>r.status==='cancelled'));
 await apply(s,owner,'generate',{eventId:e.id,at:start,duration:15,seed:2},start);const round=s.rounds.find(r=>r.status==='draft')!;await apply(s,owner,'publish',{roundId:round.id},start);await apply(s,owner,'start',{roundId:round.id,at:start,monthly:true,elo:true},start);
 await assert.rejects(()=>apply(s,owner,'generate',{eventId:e.id,at:start+minute,duration:15,seed:3},start+minute),/录完当前轮/);
 const m=s.matches.find(m=>m.status==='playing')!;await apply(s,owner,'score',{matchId:m.id,a:21,b:19},start+10*minute);assert.equal(s.matches.filter(m=>m.status==='playing').length,0);
 await apply(s,owner,'generate',{eventId:e.id,at:start+10*minute,duration:15,seed:3},start+10*minute);await apply(s,owner,'schedulingMode',payload(s,e,'live'),start+11*minute);assert.equal(e.livePlay?.enabled??false,false);
 await apply(s,owner,'liveStart',{eventId:e.id},start+11*minute);const live=s.matches.find(m=>m.status==='playing')!;const count=s.matches.length;await apply(s,owner,'score',{matchId:live.id,a:21,b:19},start+20*minute);assert.equal(s.matches.length,count+1);assert.equal(s.matches.filter(m=>m.status==='playing').length,1);assert.equal(s.matches.find(x=>x.id===m.id)!.scoreA,21);
});
test('unauthorized, stale mode, changed pending IDs, practice and ended requests leave state untouched',async()=>{
 const {s,e,owner}=fixture();const p=payload(s,e,'round'),before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[2],'schedulingMode',p,start),/403/);assert.deepEqual(s,before);
 await apply(s,owner,'schedulingMode',p,start);const after=structuredClone(s);await assert.rejects(()=>apply(s,owner,'schedulingMode',p,start),/409/);assert.deepEqual(s,after);
 const stale=payload(s,e,'planned');s.matches.push({id:'new-draft',eventId:e.id,roundId:'pending',status:'draft'} as Match);const pending=structuredClone(s);await assert.rejects(()=>apply(s,owner,'schedulingMode',stale,start),/409/);assert.deepEqual(s,pending);
 e.status='ended';const ended=structuredClone(s);await assert.rejects(()=>apply(s,owner,'schedulingMode',payload(s,e,'planned'),e.end),/结束前/);assert.deepEqual(s,ended);e.status='open';e.matchFormat='practice';await assert.rejects(()=>apply(s,owner,'schedulingMode',payload(s,e,'planned'),start),/练球/);
});
test('a mixed round never cancels a playing or completed match when its remaining draft is withdrawn',()=>{
 const {s,e}=fixture();const r:Round={id:'mixed',eventId:e.id,start,duration:15,status:'playing',eligible:[],rest:[],seed:1};s.rounds=[r];s.matches=[{id:'running',roundId:r.id,eventId:e.id,status:'playing'},{id:'done',roundId:r.id,eventId:e.id,status:'complete',scoreA:21,scoreB:19},{id:'pending',roundId:r.id,eventId:e.id,status:'published'}] as Match[];assert.deepEqual(cancelPendingScheduling(s,e.id),['pending']);assert.deepEqual(s.matches.map(m=>m.status),['playing','complete','cancelled']);assert.equal(r.status,'playing');
});

test('remaining-time planning preserves the confirmed partner mode and previously fixed teams',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'planPoints',{eventId:e.id,at:start,pointsMinutes:30,roundMinutes:15,seed:3,pairing:'fixed'},start-minute);await apply(s,owner,'publishPoints',{eventId:e.id},start-minute);const first=s.rounds[0];await apply(s,owner,'start',{roundId:first.id,at:start,monthly:true,elo:true},start);const m=s.matches.find(m=>m.roundId===first.id)!;await apply(s,owner,'score',{matchId:m.id,a:21,b:19},start+10*minute);const teams=structuredClone(e.pointsChoice!.teams),before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'planPoints',{eventId:e.id,at:start+30*minute,pointsMinutes:30,roundMinutes:15,seed:4,pairing:'rotate'},start+11*minute),/保留已确认搭档/);assert.deepEqual(s,before);
 await apply(s,owner,'planPoints',{eventId:e.id,at:start+30*minute,pointsMinutes:30,roundMinutes:15,seed:4,pairing:'fixed'},start+11*minute);assert.deepEqual(e.pointsChoice!.teams,teams);assert.equal(m.scoreA,21);
});
