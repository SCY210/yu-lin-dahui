import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Event} from '../lib/domain/types';
import {repairEventDate,type EventDateRepair} from '../lib/domain/event-date-repair';
import {isAwardVotingOpen} from '../lib/domain/activity-voting';
import {leaderboard} from '../lib/domain/ranking';

const start=Date.parse('2026-10-09T17:00:00Z'),end=start+7200000,day=86400000,now=end-day+3600000;
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 for(const [i,id] of ['owner','a','b','c'].entries()){s.accounts.push({id,playerId:'p'+i,email:'',role:i?'member':'admin'});s.players.push({id:'p'+i,name:id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})}
 const e:Event={id:'target',creatorId:'owner',title:'周四双打局',start,end,venue:'测试',address:'',capacity:6,signupDeadline:end,cancelDeadline:start-day,note:'',status:'open',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal',pointsPlan:{start,end,roundMinutes:15,generatedAt:now-1000}};
 s.events.push(e,{...e,id:'foreign'});s.bookings.push({id:'court',eventId:e.id,name:'场地',start,end,pricing:'total',cents:1000});
 for(const [i,p] of s.players.entries())s.registrations.push({id:'r'+i,eventId:e.id,playerId:p.id,sequence:i+1,status:'confirmed',arrival:start,departure:end,registeredAt:now-300000,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''},bookingSignups:[{bookingId:'court',status:'confirmed',sequence:i+1,arrival:start,departure:end,note:'',registeredAt:now-300000,joinedAsWaitlist:false,cancelRequested:false}]});
 s.rounds.push({id:'round',eventId:e.id,start,duration:15,status:'complete',eligible:s.players.map(p=>p.id),rest:[],seed:1});
 s.matches.push({id:'match',eventId:e.id,roundId:'round',courtId:'court',a:['p0','p1'],b:['p2','p3'],status:'complete',start,end:start+900000,scoreA:21,scoreB:19,monthly:true,elo:true,locked:false,enteredBy:'owner',games:[{a:21,b:19}]});
 s.awardVotes.push({id:'existing-vote',eventId:e.id,voterId:'a',playerId:'p2',category:'mvp',at:now});
 const plan:EventDateRepair={eventId:e.id,fromStart:start,fromEnd:end,toStart:start-day,toEnd:end-day};return {s,e,plan};
}
test('corrects the entire activity date, preserves score/roster/real write times and opens voting',()=>{
 const {s,e,plan}=fixture(),points=leaderboard(s,'2026-10',now+30*day).map(p=>[p.playerId,p.pointsChange]),match=structuredClone(s.matches[0]),foreign=structuredClone(s.events[1]);
 assert.equal(isAwardVotingOpen(s,e,now),false);assert.ok(repairEventDate(s,plan,now));
 const fixed=s.events[0];assert.equal(fixed.start,start-day);assert.equal(fixed.end,end-day);assert.equal(s.bookings[0].start,start-day);assert.equal(s.rounds[0].start,start-day);assert.equal(fixed.pointsPlan!.end,end-day);assert.equal(fixed.pointsPlan!.generatedAt,e.pointsPlan!.generatedAt);
 for(const r of s.registrations){assert.equal(r.arrival,start-day);assert.equal(r.bookingSignups![0].departure,end-day);assert.equal(r.registeredAt,now-300000);assert.equal(r.sequence,s.registrations.indexOf(r)+1)}
 assert.deepEqual(s.matches[0],{...match,start:match.start!-day,end:match.end!-day});assert.deepEqual(s.events[1],foreign);assert.deepEqual(leaderboard(s,'2026-10',now+30*day).map(p=>[p.playerId,p.pointsChange]),points);assert.equal(s.awardVotes[0].id,'existing-vote');assert.ok(isAwardVotingOpen(s,fixed,now));assert.equal(s.audits[0].action,'repairEventDate');assert.equal((s.audits[0].changes as any).before.event.start,start);
 const after=structuredClone(s);assert.equal(repairEventDate(s,plan,now),false);assert.deepEqual(s,after);
});
test('a different date, deleted activity, missing target or different owner cannot be overwritten',()=>{
 for(const kind of ['changed','deleted','missing','foreign-owner'] as const){const {s,plan}=fixture();if(kind==='changed')s.events[0].start++;if(kind==='deleted')s.events[0].deletedAt=now;if(kind==='missing')s.events=s.events.slice(1);if(kind==='foreign-owner')s.events[0].creatorId='other';const before=structuredClone(s);assert.equal(repairEventDate(s,plan,now),false);assert.deepEqual(s,before)}
});
test('an invalid correction does not partially change scores or data',()=>{
 const {s,plan}=fixture(),before=structuredClone(s);assert.throws(()=>repairEventDate(s,{...plan,toEnd:plan.toEnd+1},now),/计划无效/);assert.deepEqual(s,before);
});
