import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Event} from '../lib/domain/types';
import {fillLiveCourts,livePresentIds} from '../lib/domain/live-play';
import {liveLineupSnapshot} from '../lib/domain/live-lineup';
import {canSwapLivePlayers} from '../lib/domain/permissions';
import {pendingSchedulingIds} from '../lib/domain/scheduling';
import {clubViewValidUntil} from '../lib/club-read-cache';
import {eventStatusAt} from '../lib/domain/event-lifecycle';

const end=Date.parse('2026-10-29T21:00:00Z'),minute=60000;
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 const e:Event={id:'e',creatorId:'owner',title:'Fictional overtime',start:end-2*3600000,end,venue:'Fixture court',address:'',capacity:7,signupDeadline:end-4*3600000,cancelDeadline:end-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events=[e];s.bookings=[{id:'court',eventId:e.id,name:'Court 1',start:e.start,end:e.end,pricing:'total',cents:2000}];
 for(let i=0;i<9;i++){
  const id=i?'member'+i:'owner',playerId='p'+i;
  s.accounts.push({id,playerId,email:'',role:i?'member':'admin'});
  s.players.push({id:playerId,name:'Fixture '+i,ownerId:id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
  if(i<8)s.registrations.push({id:'r'+i,eventId:e.id,playerId,status:i===7?'waitlist':'confirmed',sequence:i,arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 return {s,e,owner:s.accounts[0],member:s.accounts[1]};
}

for(const status of ['open','ended'] as const)test('manual live play starts after the clock end from '+status+' without extending any fee or signup interval',async()=>{
 const {s,e,owner,member}=fixture();e.status=status;const times=structuredClone({event:[e.start,e.end],bookings:s.bookings,registrations:s.registrations});
 await apply(s,owner,'schedulingMode',{eventId:e.id,mode:'live',expectedMode:'planned',expectedPendingIds:pendingSchedulingIds(s,e.id)},end+minute);
 await apply(s,owner,'liveStart',{eventId:e.id},end+minute);
 const first=s.matches[0];assert.equal(first.start,end+minute);assert.equal(first.status,'playing');assert.equal(new Set([...first.a,...first.b]).size,4);
 assert.equal(livePresentIds(s,e,end+minute).length,7);assert.deepEqual({event:[e.start,e.end],bookings:s.bookings,registrations:s.registrations},times);
 await apply(s,member,'score',{matchId:first.id,a:21,b:19,reason:'Fixture overtime score'},end+2*minute);
 assert.equal(first.end,end+2*minute,'overtime scores keep their real completion time');
 assert.equal(s.matches.filter(m=>m.status==='playing').length,0,'the ended activity never refills on a background read');
 assert.equal(fillLiveCourts(s,e,end+3*minute).length,0);
 await apply(s,member,'liveNext',{eventId:e.id,courtId:'court'},end+3*minute);
 assert.equal(s.matches.filter(m=>m.status==='playing').length,1);assert.equal(s.matches.at(-1)!.start,end+3*minute);
 assert.deepEqual({event:[e.start,e.end],bookings:s.bookings,registrations:s.registrations},times);
});

test('overtime retains only the final attendance phase and cannot pull an earlier court back into use',async()=>{
 const {s,e,owner}=fixture();s.registrations[1].departure=end-minute;
 s.bookings.push({...s.bookings[0],id:'earlier',name:'Earlier court',end:end-minute});
 await apply(s,owner,'liveStart',{eventId:e.id},end+minute);
 assert.ok(!livePresentIds(s,e,end+minute).includes('p1'));
 assert.equal(s.matches.length,1);assert.equal(s.matches[0].courtId,'court');
});

test('confirmed members swap the live lineup after time expires, with stale, scored, waitlist and outsider protection',async()=>{
 const {s,e,owner,member}=fixture();await apply(s,owner,'liveStart',{eventId:e.id},end+minute);
 const m=s.matches[0],p1=m.a[0],p2=livePresentIds(s,e,end+minute).find(id=>![...m.a,...m.b].includes(id))!;
 const payload={eventId:e.id,p1,p2,expectedLineup:liveLineupSnapshot(s,e.id)},before=structuredClone(s);
 assert.equal(canSwapLivePlayers(s,member,e),true);
 for(const a of [s.accounts[7],s.accounts[8]]){assert.equal(canSwapLivePlayers(s,a,e),false);await assert.rejects(()=>apply(s,a,'liveSwap',{...payload,role:'admin'},end+minute),/403/);assert.deepEqual(s,before)}
 await apply(s,member,'liveSwap',payload,end+minute);assert.ok(m.a.includes(p2));assert.ok(!m.a.includes(p1));
 const swapped=structuredClone(s);await assert.rejects(()=>apply(s,member,'liveSwap',payload,end+minute),/409/);assert.deepEqual(s,swapped);
 m.games=[{a:5,b:3}];const scored=structuredClone(s);
 await assert.rejects(()=>apply(s,member,'liveSwap',{eventId:e.id,p1:p2,p2:p1,expectedLineup:liveLineupSnapshot(s,e.id)},end+minute),/已录分/);assert.deepEqual(s,scored);
 s.registrations[1].status='cancelled';assert.equal(canSwapLivePlayers(s,member,e),false);
});

test('before-start, draft, cancelled and deleted activities still refuse manual live scheduling',async()=>{
 for(const state of ['before','draft','cancelled','deleted'] as const){
  const {s,e,owner}=fixture();if(state==='draft'||state==='cancelled')e.status=state;if(state==='deleted')e.deletedAt=end;
  const before=structuredClone(s);await assert.rejects(()=>apply(s,owner,'liveStart',{eventId:e.id},state==='before'?e.start-1:end+minute));assert.deepEqual(s,before);
 }
});

test('the existing end-time validator boundary still exposes the transition to manual overtime',()=>{
 const {s,e,owner}=fixture();
 assert.equal(clubViewValidUntil(s,owner,end-1),end);
 assert.equal(eventStatusAt(e,end-1),'open');assert.equal(eventStatusAt(e,end),'ended');
 assert.equal(livePresentIds(s,e,end-1).length,7);assert.equal(livePresentIds(s,e,end).length,7);
 // Automatic expiry and voting remain clock-based; the explicit live commands
 // use the same final availability phase without another clock-driven write.
 assert.equal(s.matches.length,0);
});
