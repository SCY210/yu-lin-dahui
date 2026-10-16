import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,month,type Match} from '../lib/domain/types';
import {enableRoleRankedEvents,eventRankingEnabled} from '../lib/domain/event-ranking';
import {quarterlyLeaderboard,annualLeaderboard} from '../lib/domain/ranking';
import {realmSnapshot} from '../lib/domain/realm-rating';
import {mvpPointAdjustments} from '../lib/domain/activity-voting';
import {attendancePointAdjustments} from '../lib/domain/points-attendance';
import {enableAllRanked} from '../lib/domain/all-ranked';

const now=Date.parse('2030-10-08T12:00:00Z');
const input={matchFormat:'doubles',start:now-60000,end:now+3600000,venue:'Fictional venue',address:'',capacity:16,cancelDeadline:now-86400000,note:'',status:'open',bookings:[{advancedBy:'p-owner',name:'Court 1',start:now-60000,end:now+3600000,pricing:'hourly',cents:690}]};
async function fixture(creator='host',extra={}){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=['owner','admin','host','member','bench1','bench2'].map(id=>({id,email:'',role:id==='owner'||id==='admin'?'admin':'member',playerId:'p-'+id}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 await apply(s,s.accounts.find(a=>a.id===creator)!,'event',{...input,...extra},now-120000);
 const e=s.events[0];for(const p of s.players)await apply(s,s.accounts[0],'register',{eventId:e.id,playerId:p.id,arrival:e.start,departure:e.end,note:''},now-120000);
 return {s,e,host:s.accounts[2],admin:s.accounts[1],owner:s.accounts[0]};
}

test('member creation is ordinary; forged ranked creation is denied before mutation',async()=>{
 const {s,e,host}=await fixture();assert.equal(e.ranked,false);
 const before=structuredClone(s);await assert.rejects(()=>apply(s,host,'event',{...input,ranked:true,isOwner:true,role:'admin'},now),/403/);assert.deepEqual(s,before);
 await apply(s,host,'eventEdit',{eventId:e.id,ranked:true,venue:e.venue,address:'',capacity:16,cancelDeadline:e.cancelDeadline,note:''},now);assert.equal(e.ranked,false,'editing the format cannot forge an enable');
});

for(const mode of ['live','round','planned'] as const)test('ordinary '+mode+' scheduling and scoring never change points or cultivation',async()=>{
 const {s,e,host}=await fixture();
 if(mode==='live'){await apply(s,host,'liveStart',{eventId:e.id},now);await apply(s,host,'livePause',{eventId:e.id,paused:true},now)}
 else{
  if(mode==='round'){await apply(s,host,'generate',{eventId:e.id,at:now,duration:15,seed:1},now);await apply(s,host,'publish',{roundId:s.rounds[0].id},now)}
  else {await apply(s,host,'planPoints',{eventId:e.id,at:now,pointsMinutes:30,roundMinutes:15,seed:1,pairing:'rotate'},now);await apply(s,host,'publishPoints',{eventId:e.id},now)}
  await apply(s,host,'start',{roundId:s.rounds[0].id,at:now,monthly:true,elo:true},now);
 }
 const m=s.matches.find(m=>m.status==='playing')!;assert.ok(m);assert.equal(m.monthly,false);assert.equal(m.elo,false);
 await apply(s,host,'score',{matchId:m.id,a:21,b:19},now+1000);
 assert.ok(s.matches.every(m=>!m.monthly&&!m.elo));
 const before=structuredClone(s);await assert.rejects(()=>apply(s,host,'matchScoring',{matchId:m.id,monthly:true,elo:true,reason:''},now+2000),/403/);assert.deepEqual(s,before);
 m.monthly=true;m.elo=true; // Even corrupted old flags cannot bypass activity-level ranking exclusion.
 for(const rows of [quarterlyLeaderboard(s,'2030-Q4',now+7200000),annualLeaderboard(s,2030,now+7200000)])assert.ok(rows.every(r=>r.points===0&&r.games===0));
 assert.ok([...realmSnapshot(s,now+7200000).values()].every(r=>r.score===1000&&r.ratedGames===0));
 assert.ok(s.players.every(p=>p.rating===1000));
});

test('only admins and the stored owner can enable ranking before play, with stale and history guards',async()=>{
 const {s,e,host,admin,owner}=await fixture();
 await assert.rejects(()=>apply(s,host,'eventRanking',{eventId:e.id,ranked:true,expectedRanked:false},now),/403/);
 await assert.rejects(()=>apply(s,admin,'eventRanking',{eventId:e.id,ranked:true,expectedRanked:false},e.end+1),/结束/,'calendar-ended activities are frozen even while the stored status is open');
 await apply(s,admin,'eventRanking',{eventId:e.id,ranked:true,expectedRanked:false},now);assert.equal(eventRankingEnabled(e),true);
 const before=structuredClone(s);await assert.rejects(()=>apply(s,admin,'eventRanking',{eventId:e.id,ranked:false,expectedRanked:false},now),/409/);assert.deepEqual(s,before);
 await assert.rejects(()=>apply(s,host,'liveStart',{eventId:e.id},now),/403/);
 await apply(s,owner,'liveStart',{eventId:e.id},now);assert.ok(s.matches.every(m=>m.monthly&&m.elo));
 await assert.rejects(()=>apply(s,admin,'eventRanking',{eventId:e.id,ranked:false,expectedRanked:true},now),/已开打/);
 const ordinary=await fixture();ordinary.owner.role='member';await apply(ordinary.s,ordinary.owner,'eventRanking',{eventId:ordinary.e.id,ranked:true,expectedRanked:false},now);assert.equal(ordinary.e.ranked,true,'owner authority comes from stored ownership, not a browser flag');await apply(ordinary.s,ordinary.owner,'liveStart',{eventId:ordinary.e.id},now);assert.ok(ordinary.s.matches.every(m=>m.monthly));
});

test('ordinary MVP awards and attendance adjustments cannot leak points',async()=>{
 const {s,e}=await fixture();s.awardVotes.push({id:'vote',eventId:e.id,voterId:'host',playerId:'p-member',category:'mvp',at:e.end+1000});
 s.audits.push({id:'late',at:now,actor:'host',action:'pointsLate',reason:'fixture',changes:{eventId:e.id,playerId:'p-member',period:month(now),format:'doubles',delta:-1}});
 assert.deepEqual(mvpPointAdjustments(s,e.end+86400001),[]);assert.deepEqual(attendancePointAdjustments(s),[]);
 assert.ok(annualLeaderboard(s,2030,e.end+86400001).every(r=>r.points===0));
});

test('one-time upgrade makes unplayed member activities ordinary and preserves historical scores',async()=>{
 const {s,e}=await fixture();delete e.ranked;
 const old={...e,id:'history',start:now-7200000,end:now-3600000};s.events.push(old);
 const draft:Match={id:'draft',eventId:e.id,roundId:'round',courtId:s.bookings[0].id,a:['p-owner','p-admin'],b:['p-host','p-member'],status:'published',start:null,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};s.matches.push(draft);
 assert.equal(enableRoleRankedEvents(s,now),true);assert.equal(e.ranked,false);assert.equal(old.ranked,true);assert.equal(draft.monthly,false);
 const after=structuredClone(s);assert.equal(enableRoleRankedEvents(s,now),false);assert.deepEqual(s,after);
 delete s.settings.scoringPolicy;enableAllRanked(s,now);assert.equal(draft.monthly,false,'the legacy migration must respect explicitly ordinary activities');
});
