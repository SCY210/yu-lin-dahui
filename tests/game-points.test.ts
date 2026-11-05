import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,defaultRules} from '../lib/domain/types';
import {eventGamePoints,eventScoreRules} from '../lib/domain/game-points';
import {validScore} from '../lib/domain/ranking';
import {bountyGoal,bountyOutcome,type BountyRecord} from '../lib/domain/bounties';
import {activityNoticeVersion} from '../lib/activity-notice';

const now=Date.parse('2030-10-08T12:00:00Z');
const notice={noticeAccepted:true,noticeVersion:activityNoticeVersion};
async function fixture(fields:Record<string,unknown>={}){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='a0';
 for(let i=0;i<4;i++){s.accounts.push({id:'a'+i,email:'',role:i?'member':'admin',playerId:'p'+i});s.players.push({id:'p'+i,ownerId:'a'+i,name:'Player '+i,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})}
 await apply(s,s.accounts[0],'event',{matchFormat:'doubles',start:now-60000,end:now+3600000,venue:'Fixture venue',address:'',capacity:16,cancelDeadline:now-86400000,note:'练发球',status:'open',bookings:[{advancedBy:'p0',name:'Court 1',start:now-60000,end:now+3600000,pricing:'hourly',cents:690}],...fields},now-120000);
 const e=s.events[0];for(const p of s.players)await apply(s,s.accounts[0],'register',{...notice,eventId:e.id,playerId:p.id,arrival:e.start,departure:e.end,note:''},now-120000);
 return {s,e,owner:s.accounts[0]};
}
const edit=(e:{id:string;venue:string;cancelDeadline:number},extra:Record<string,unknown>)=>({eventId:e.id,venue:e.venue,address:'',capacity:16,cancelDeadline:e.cancelDeadline,note:'练发球',...extra});

test('a 15-point game is won at 15 with a two-point lead and ends at 21',()=>{
 const r=eventScoreRules(defaultRules,{gamePoints:15});
 for(const [a,b] of [[15,13],[15,0],[16,14],[20,18],[21,20],[21,19]])assert.ok(validScore(a,b,r),`${a}:${b}`);
 for(const [a,b] of [[15,14],[17,14],[21,18],[22,20],[21,15]])assert.ok(!validScore(a,b,r),`${a}:${b}`);
 assert.equal(eventScoreRules(defaultRules,{}),defaultRules,'unset stays the season rule of 21');
});

test('an activity created as 15-point accepts 15-point scores and refuses 21-point ones',async()=>{
 const {s,e,owner}=await fixture({gamePoints:15});assert.equal(e.gamePoints,15);
 await apply(s,owner,'liveStart',{eventId:e.id},now);const m=s.matches[0];
 await assert.rejects(()=>apply(s,owner,'score',{matchId:m.id,a:21,b:15},now+1000),/终局比分不符合/);
 await apply(s,owner,'score',{matchId:m.id,a:15,b:12},now+1000);assert.equal(m.status,'complete');
 // The default and an explicit 21 both store nothing.
 const plain=await fixture({gamePoints:21});assert.equal(plain.e.gamePoints,undefined);assert.equal(eventGamePoints(plain.e),21);
});

test('practice and competitions never keep a 15-point choice',async()=>{
 const practice=await fixture({matchFormat:'practice',gamePoints:15});assert.equal(practice.e.gamePoints,undefined);
 const cup=await fixture({tournament:true,gamePoints:15});assert.equal(cup.e.gamePoints,undefined);
 await assert.rejects(()=>apply(cup.s,cup.owner,'eventEdit',edit(cup.e,{gamePoints:15}),now),/赛制设置/);
});

test('organisers switch the points per game until a score is saved',async()=>{
 const {s,e,owner}=await fixture();
 await apply(s,owner,'eventEdit',edit(e,{gamePoints:15}),now);assert.equal(e.gamePoints,15);
 await apply(s,owner,'eventEdit',edit(e,{gamePoints:21}),now);assert.equal(e.gamePoints,undefined);
 await apply(s,owner,'eventEdit',edit(e,{}),now);assert.equal(e.gamePoints,undefined,'an edit without the field keeps it');
 await apply(s,owner,'liveStart',{eventId:e.id},now);await apply(s,owner,'score',{matchId:s.matches[0].id,a:21,b:15},now+1000);
 await assert.rejects(()=>apply(s,owner,'eventEdit',edit(e,{gamePoints:15}),now+2000),/已有比分/);
});

test('rout and deuce bounties use the 15-point thresholds',()=>{
 const e={id:'e',start:now-3600000,end:now,status:'ended',ranked:true,matchFormat:'doubles',gamePoints:15} as never;
 const record=(kind:'rout'|'deuce'):BountyRecord=>({playerId:'p0',kind,status:'accepted',at:now-4000000,coins:1,points:1,penalty:1,gamePoints:15});
 const match=(a:number,b:number)=>({matches:[{id:'m',eventId:'e',roundId:'r',a:['p0','p1'],b:['p2','p3'],status:'complete',start:now-3000000,end:now-2000000,scoreA:a,scoreB:b,games:[{a,b}]}]}) as never;
 assert.equal(bountyOutcome(match(15,6),e,record('rout'),now),'completed');
 assert.equal(bountyOutcome(match(15,7),e,record('rout'),now),'failed');
 assert.equal(bountyOutcome(match(16,14),e,record('deuce'),now),'completed');
 assert.equal(bountyOutcome(match(15,13),e,record('deuce'),now),'failed');
 assert.match(bountyGoal('rout',15),/不超过 6 分/);assert.match(bountyGoal('deuce',15),/14 平/);
});
