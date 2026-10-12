import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {livePresentIds} from '../lib/domain/live-play';
import {readyIds,propose} from '../lib/domain/grouping';
import {matchingStopped,stoppedPendingMatches} from '../lib/domain/matching-participation';
import {attendancePointAdjustments} from '../lib/domain/points-attendance';
import {emptyState,type Event} from '../lib/domain/types';

const now=Date.parse('2026-10-12T15:00:00Z');
function fixture(){
 const s=emptyState();s.settings.initialized=true;
 const e:Event={id:'event',creatorId:'owner',title:'Fictional participation',start:now-3600000,end:now+3*3600000,venue:'Hall',address:'',capacity:8,signupDeadline:now,cancelDeadline:now-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal'};
 s.events.push(e);
 for(let i=0;i<8;i++){
  const id='p'+i,accountId=i?'member'+i:'owner';
  s.players.push({id,name:id,ownerId:accountId,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
  s.accounts.push({id:accountId,email:'',role:i?'member':'admin',playerId:id});
  s.registrations.push({id:'reg'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 s.bookings.push({id:'court',eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:1000});
 return {s,e,owner:s.accounts[0],member:s.accounts[1]};
}

test('voluntary opt-out excludes live, round and planned proposals without changing signup, attendance, or points',async()=>{
 const {s,e,member}=fixture(),before=structuredClone({registrations:s.registrations,attendance:s.attendance,players:s.players});
 await apply(s,member,'pointsParticipation',{eventId:e.id,playerId:member.playerId,playing:false},now);
 assert.equal(matchingStopped(e,member.playerId),true);
 assert.ok(!livePresentIds(s,e,now).includes(member.playerId));assert.ok(!readyIds(s,e.id,now).includes(member.playerId));
 assert.ok(!propose(s,e,now,15,7).eligible.includes(member.playerId));
 assert.deepEqual({registrations:s.registrations,attendance:s.attendance,players:s.players},before);
 assert.deepEqual(attendancePointAdjustments(s),[]);assert.equal(e.noShowHold,undefined);assert.equal(e.pointsSession,undefined);
 await apply(s,member,'pointsParticipation',{eventId:e.id,playerId:member.playerId,playing:false},now);assert.deepEqual(e.matchingStopped,[member.playerId]);
});

test('a running game and completed results remain unchanged, while subsequent matching skips the player',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'liveStart',{eventId:e.id},now);
 const first=s.matches[0],playerId=first.a[0],account=s.accounts.find(a=>a.playerId===playerId)!,snapshot=structuredClone(first);
 await apply(s,account,'pointsParticipation',{eventId:e.id,playerId,playing:false},now+1000);assert.deepEqual(first,snapshot);
 await apply(s,owner,'score',{matchId:first.id,a:21,b:19,reason:'Fictional score'},now+60000);
 assert.equal(first.status,'complete');assert.ok(s.matches.filter(m=>m.status==='playing').every(m=>![...m.a,...m.b].includes(playerId)));
 const result=structuredClone(first);await apply(s,account,'pointsParticipation',{eventId:e.id,playerId,playing:true},now+61000);
 assert.deepEqual(first,result);assert.equal(matchingStopped(e,playerId),false);
});

test('self, proxy and event manager can adjust matching; spoofed unrelated member cannot',async()=>{
 const {s,e,member}=fixture(),before=structuredClone(s);
 await assert.rejects(()=>apply(s,member,'pointsParticipation',{eventId:e.id,playerId:'p2',playing:false,isOwner:true},now),/403/);assert.deepEqual(s,before);
 s.players[2].ownerId=member.id;
 await apply(s,member,'pointsParticipation',{eventId:e.id,playerId:'p2',playing:false},now);assert.ok(matchingStopped(e,'p2'));
 e.creatorId=member.id;await apply(s,member,'pointsParticipation',{eventId:e.id,playerId:'p3',playing:false},now);assert.ok(matchingStopped(e,'p3'));
});

test('resume does not clear late, no-show, time-window, waitlist or disabled-member guards',async()=>{
 const {s,e,owner}=fixture();e.noShowHold=['p1'];e.pointsSession={attendance:[{playerId:'p2',late:true,available:false,at:now}],waiting:[]};
 s.registrations[3].arrival=now+60000;
 for(const playerId of ['p1','p2','p3']){await apply(s,owner,'pointsParticipation',{eventId:e.id,playerId,playing:false},now);await apply(s,owner,'pointsParticipation',{eventId:e.id,playerId,playing:true},now)}
 assert.ok(['p1','p2','p3'].every(id=>!livePresentIds(s,e,now).includes(id)));
 assert.deepEqual(e.noShowHold,['p1']);assert.equal(e.pointsSession.attendance[0].available,false);
 s.registrations[4].status='waitlist';s.players[5].enabled=false;
 for(const playerId of ['p4','p5'])await assert.rejects(()=>apply(s,owner,'pointsParticipation',{eventId:e.id,playerId,playing:false},now),/正式报名/);
});

test('pending planned lineup remains reviewable and cannot start or accept an early score while opted out',async()=>{
 const {s,e,owner}=fixture();
 await apply(s,owner,'planPoints',{eventId:e.id,at:now,pointsMinutes:30,roundMinutes:15,seed:1,pairing:'rotate'},now);
 await apply(s,owner,'publishPoints',{eventId:e.id},now);
 const m=s.matches[0],r=s.rounds[0],snapshot=structuredClone(m),playerId=m.a[0];
 await apply(s,owner,'pointsParticipation',{eventId:e.id,playerId,playing:false},now);
 assert.deepEqual(m,snapshot);assert.ok(stoppedPendingMatches(s,e).some(x=>x.id===m.id));
 await assert.rejects(()=>apply(s,owner,'start',{roundId:r.id,at:now,monthly:true,elo:true},now),/不再上场/);
 await assert.rejects(()=>apply(s,owner,'score',{matchId:m.id,a:21,b:19,reason:'Should not score'},now+60000),/不再上场/);
 assert.deepEqual(m,snapshot);assert.equal(s.matches.some(m=>m.status==='forfeit'),false);
 await apply(s,owner,'pointsParticipation',{eventId:e.id,playerId,playing:true},now);
 await apply(s,owner,'start',{roundId:r.id,at:now,monthly:true,elo:true},now);assert.equal(m.status,'playing');
});

test('opt-out is scoped to one event and cannot change closed or unsupported events',async()=>{
 const {s,e,owner,member}=fixture(),other={...structuredClone(e),id:'other'};s.events.push(other);
 await apply(s,member,'pointsParticipation',{eventId:e.id,playerId:member.playerId,playing:false},now);assert.equal(matchingStopped(other,member.playerId),false);
 for(const status of ['ended','cancelled','draft'] as const){e.status=status;await assert.rejects(()=>apply(s,owner,'pointsParticipation',{eventId:e.id,playerId:'p1',playing:true},now),/结束前/)}
 e.status='open';e.matchFormat='practice';await assert.rejects(()=>apply(s,owner,'pointsParticipation',{eventId:e.id,playerId:'p1',playing:true},now),/练球/);
});

test('organizer can replace an opted-out published player with the available bench and start without resuming them',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'planPoints',{eventId:e.id,at:now,pointsMinutes:15,roundMinutes:15,seed:1,pairing:'rotate'},now);
 await apply(s,owner,'publishPoints',{eventId:e.id},now);
 const m=s.matches[0],r=s.rounds[0],playerId=m.a[0],bench=r.rest[0];assert.ok(bench);
 await apply(s,owner,'pointsParticipation',{eventId:e.id,playerId,playing:false},now);
 await apply(s,owner,'swap',{roundId:r.id,p1:playerId,p2:bench},now);
 assert.ok(![...m.a,...m.b].includes(playerId));assert.ok([...m.a,...m.b].includes(bench));assert.equal(stoppedPendingMatches(s,e).length,0);
 await apply(s,owner,'start',{roundId:r.id,at:now,monthly:true,elo:true},now);assert.equal(m.status,'playing');assert.equal(matchingStopped(e,playerId),true);
});
