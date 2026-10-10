import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Match} from '../lib/domain/types';
import {automaticEventTitle,eventFormat,courtPlayers} from '../lib/domain/match-format';
import {calculateSettlementPreview,calculateSettlement} from '../lib/domain/money';
import {projectClubState} from '../lib/club-view';
import {replayRating} from '../lib/domain/ranking';
import {rotationPlan} from '../lib/domain/play';
import {propose} from '../lib/domain/grouping';
import {pointsPhases} from '../lib/domain/points-phases';
import {pointsVotingOpen} from '../lib/domain/points-voting';
import {isAwardVotingOpen} from '../lib/domain/activity-voting';
import {newEventForm} from '../app/event-create-form';
import {visibleFormFields} from '../app/form-fields';
const start=Date.parse('2030-10-10T13:00:00Z'),hour=3600000;
function seed(){const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='a0';for(let i=0;i<4;i++){s.accounts.push({id:'a'+i,playerId:'p'+i,email:'',role:i?'member':'admin'});s.players.push({id:'p'+i,ownerId:'a'+i,name:'Fixture '+i,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''})}return s}
const input={matchFormat:'practice',start,end:start+2*hour,venue:'Fixture Venue',address:'',capacity:3,cancelDeadline:start-86400000,note:'高远球、步法和网前挑球',status:'open',practiceShuttleCents:150,practiceBallCount:2,bookings:[{name:'Court',start,end:start+2*hour,pricing:'hourly',cents:690}]};
async function fixture(){const s=seed();await apply(s,s.accounts[0],'event',input,start-hour);return {s,e:s.events[0],owner:s.accounts[0]}}
test('practice persists its content, capacity, remembered ball price and expense without scheduling a match',async()=>{
 const {s,e}=await fixture();assert.equal(eventFormat(e),'practice');assert.equal(e.title,automaticEventTitle(start,'practice'));assert.match(e.title,/练球/);assert.equal(e.note,input.note);assert.equal(s.bookings[0].signupCapacity,3);assert.equal(e.practiceShuttleCents,150);assert.equal(s.costs[0].used,2);assert.equal(s.costs[0].cents,150);assert.equal(e.pointsPlan,undefined);assert.equal(s.matches.length,0);assert.equal(courtPlayers(e),0);
});
test('practice needs content and validates nonnegative integer ball costs atomically; zero quantity charges nothing',async()=>{
 for(const patch of [{note:'  '},{practiceShuttleCents:-1},{practiceBallCount:1.5}]){const s=seed(),before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[0],'event',{...input,...patch},start-hour));assert.deepEqual(s,before)}
 const s=seed();await apply(s,s.accounts[0],'event',{...input,practiceBallCount:0},start-hour);assert.equal(s.costs.length,0);
});
test('signup capacity, waitlist and time-based practice fees use the ordinary server workflow',async()=>{
 const {s,e}=await fixture();for(let i=0;i<4;i++)await apply(s,s.accounts[i],'courtRegister',{bookingId:s.bookings[0].id,playerId:'p'+i,arrival:start,departure:e.end,note:''},start-hour/2);
 assert.deepEqual(s.registrations.map(r=>r.status),['confirmed','confirmed','confirmed','waitlist']);
 const preview=calculateSettlementPreview(s,e,start+hour);assert.equal(preview.bills.length,3);assert.ok(preview.bills.every(b=>b.court===460&&b.ball===100&&b.total===560));assert.equal(preview.unallocated,0);assert.deepEqual(preview,calculateSettlement(s,e,e.end));
 const view=projectClubState(s,s.accounts[0],'2030-10',2030,start+hour);assert.equal(view.events[0].note,input.note);assert.equal(view.rotationPlans[e.id].usedCourts,0);assert.equal(s.matches.length,0);
});
test('practice rejects direct competitive commands, helper scheduling, partner votes and MVP voting',async()=>{
 const {s,e,owner}=await fixture();
 for(const [action,payload]of [['liveStart',{eventId:e.id}],['livePreference',{eventId:e.id,playerId:owner.playerId,avoidConsecutive:true}],['generate',{eventId:e.id,at:start,duration:15,seed:1}],['planPoints',{eventId:e.id,at:start,pointsMinutes:60,roundMinutes:15,seed:1,pairing:'rotate'}],['pointsModeSelect',{eventId:e.id,mode:'fixed'}],['pointsModeVote',{eventId:e.id,mode:'rotate'}],['playSettings',{eventId:e.id,playMode:'balanced',identityMode:'off',arenaCourtId:'none',handicap:false}]] as const){const before=structuredClone(s);await assert.rejects(()=>apply(s,owner,action,payload,start+1),/练球/);assert.deepEqual(s,before)}
 assert.throws(()=>propose(s,e,start,15,1),/练球/);assert.equal(rotationPlan(s,e,start).usedCourts,0);assert.deepEqual(pointsPhases(s,e,start,e.end),[]);assert.equal(pointsVotingOpen(e,start-hour),false);assert.equal(isAwardVotingOpen(s,e,e.end),false);
});
test('malformed imported practice scores cannot affect either ranking board or Elo',async()=>{
 const {s,e,owner}=await fixture();const m:Match={id:'bad',eventId:e.id,roundId:'bad-round',courtId:s.bookings[0].id,a:['p0','p1'],b:['p2','p3'],status:'complete',start,end:start+60000,scoreA:21,scoreB:19,games:[{a:21,b:19}],monthly:true,elo:true,locked:false,enteredBy:owner.id};s.matches.push(m);replayRating(s,e.end);assert.ok(s.players.every(p=>p.rating===1000&&p.ratedGames===0));
 const view=projectClubState(s,owner,'2030-10',2030,e.end);assert.ok(view.quarterlyLeaderboard.every(p=>p.points===0&&p.totalMatches===0));assert.equal(view.singlesQuarterlyLeaderboard.length,0);await assert.rejects(()=>apply(s,owner,'score',{matchId:m.id,a:19,b:21},e.end),/练球/);
});
test('practice content and unit price are editable, but a scheduled match blocks activity type changes',async()=>{
 const {s,e,owner}=await fixture();await apply(s,owner,'eventEdit',{eventId:e.id,matchFormat:'practice',venue:e.venue,address:e.address,capacity:3,cancelDeadline:e.cancelDeadline,note:'练习发接发',practiceShuttleCents:180},start);assert.equal(e.note,'练习发接发');assert.equal(e.practiceShuttleCents,180);
 const before=structuredClone(s);await assert.rejects(()=>apply(s,owner,'eventEdit',{eventId:e.id,matchFormat:'practice',venue:e.venue,address:e.address,capacity:3,cancelDeadline:e.cancelDeadline,note:''},start),/练习内容/);assert.deepEqual(s,before);
});
test('creation fields reveal required multiline practice content and ball controls only for practice',()=>{
 const form=newEventForm(start-hour),normal=visibleFormFields(form.fields,form.values),training=visibleFormFields(form.fields,{...form.values,matchFormat:'practice'});assert.ok(form.fields.find(f=>f.key==='matchFormat')!.options!.some(([v])=>v==='practice'));assert.ok(!normal.some(f=>f.key==='practiceShuttleCents'));assert.equal(normal.find(f=>f.key==='note')!.optional,true);assert.equal(training.find(f=>f.key==='note')!.required,true);assert.equal(training.find(f=>f.key==='note')!.type,'textarea');assert.ok(training.some(f=>f.key==='practiceBallCount'));
 const body=form.convert!({...form.values,matchFormat:'practice',note:'步法练习',capacity:5,practiceShuttleCents:150,practiceBallCount:3});assert.equal(body.practiceBallCount,3);assert.equal(body.bookings[0].signupCapacity,5);assert.equal(body.bookings[0].cents,690);
});
