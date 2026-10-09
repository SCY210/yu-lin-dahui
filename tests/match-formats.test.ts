import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Match} from '../lib/domain/types';
import {eventFormat,automaticEventTitle} from '../lib/domain/match-format';
import {propose,validateRound} from '../lib/domain/grouping';
import {pointsPhases} from '../lib/domain/points-phases';
import {projectClubState} from '../lib/club-view';
import {liveAppearances} from '../lib/domain/live-play';

const now=Date.parse('2030-10-08T12:00:00Z');
async function fixture(format:'singles'|'doubles'='singles',count=6,courts=1){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='a0';
 for(let i=0;i<count;i++){s.accounts.push({id:'a'+i,email:'',role:i?'member':'admin',playerId:'p'+i});s.players.push({id:'p'+i,ownerId:'a'+i,name:'Player '+i,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})}
 await apply(s,s.accounts[0],'event',{matchFormat:format,start:now-60000,end:now+3600000,venue:'Fixture venue',address:'',capacity:16,cancelDeadline:now-86400000,note:'',status:'open',bookings:Array.from({length:courts},(_,i)=>({name:'Court '+i,start:now-60000,end:now+3600000,pricing:'hourly',cents:690}))},now-120000);
 const e=s.events[0];for(const p of s.players)await apply(s,s.accounts[0],'register',{eventId:e.id,playerId:p.id,arrival:e.start,departure:e.end,note:''},now-120000);
 return {s,e,owner:s.accounts[0]};
}
test('creation needs no title, names use Madrid date and format, legacy records stay doubles',async()=>{
 for(const format of ['singles','doubles'] as const){const {s,e}=await fixture(format);assert.equal(e.title,automaticEventTitle(e.start,format));assert.equal(e.matchFormat,format);assert.equal(s.bookings[0].cents,690)}
 assert.equal(eventFormat({}),'doubles');assert.match(automaticEventTitle(Date.parse('2030-10-08T23:30:00Z'),'singles'),/10月9日.*单打/);
});
test('two singles players can start, score and correct without notes; rest is respected and history is not duplicated',async()=>{
 const {s,e,owner}=await fixture('singles',2);await apply(s,owner,'livePreference',{eventId:e.id,playerId:'p0',avoidConsecutive:true},now);
 await apply(s,owner,'liveStart',{eventId:e.id},now);const first=s.matches[0];assert.equal(first.a.length,1);assert.equal(first.b.length,1);
 await apply(s,s.accounts[1],'score',{matchId:first.id,a:21,b:19},now+1000);assert.equal(first.status,'complete');assert.equal(s.matches.length,1);assert.ok(e.livePlay!.rest.some(r=>r.playerId==='p0'));
 const board=projectClubState(s,owner,'2030-10',2030,now+1000);assert.equal(board.singlesQuarterlyLeaderboard.length,2);assert.ok(board.quarterlyLeaderboard.every(r=>r.pointsChange===0&&r.games===0));assert.ok(board.singlesQuarterlyLeaderboard.some(r=>r.pointsChange===16));
 await apply(s,s.accounts[1],'score',{matchId:first.id,a:19,b:21,reason:''},now+2000);assert.equal(s.matches.length,1);assert.equal(s.audits.at(-1)!.reason,'常规修改');
 await apply(s,owner,'liveReady',{eventId:e.id,playerId:'p0'},now+3000);assert.equal(s.matches.length,2);assert.equal(s.matches[1].status,'playing');
 assert.ok(s.players.every(p=>p.rating===1000),'Singles must not change doubles matchmaking Elo');
});
test('independent singles courts never double-book a player and keep appearances balanced',async()=>{
 const {s,e,owner}=await fixture('singles',6,2);await apply(s,owner,'liveStart',{eventId:e.id},now);
 for(let i=0;i<12;i++){const active=s.matches.filter(m=>m.status==='playing');assert.equal(active.length,2);const ids=active.flatMap(m=>[...m.a,...m.b]);assert.equal(new Set(ids).size,4);assert.ok(active.every(m=>m.a.length===1&&m.b.length===1));await apply(s,owner,'score',{matchId:active[0].id,a:21,b:19},now+1000+i*1000)}
 const counts=s.players.map(p=>liveAppearances(s,e.id,p.id));assert.ok(Math.max(...counts)-Math.min(...counts)<=1,counts.join(','));
});
test('single-round and preplanned singles use two players per court with venue and duplicate checks',async()=>{
 const {s,e}=await fixture('singles',4,2),proposal=propose(s,e,now,15,1);assert.equal(proposal.courts.length,2);assert.equal(proposal.rest.length,0);
 const matches=proposal.courts.map((c,i)=>({...c,id:String(i),eventId:e.id} as Match));validateRound(s,e.id,now,15,matches);
 assert.equal(pointsPhases(s,e,now,now+900000)[0].playing,4);
 const duplicate=structuredClone(matches);duplicate[1].a=duplicate[0].a;assert.throws(()=>validateRound(s,e.id,now,15,duplicate),/重复/);
 const wrong=structuredClone(matches);wrong[0].a.push(wrong[1].a[0]);assert.throws(()=>validateRound(s,e.id,now,15,wrong));
 await apply(s,s.accounts[0],'planPoints',{eventId:e.id,at:now,pointsMinutes:30,roundMinutes:15,seed:1,pairing:'rotate'},now);assert.equal(s.rounds.length,2);assert.ok(s.matches.every(m=>m.a.length===1&&m.b.length===1));
});
test('format cannot be changed after scheduling; singles has no partner voting; doubles stays four players',async()=>{
 const {s,e,owner}=await fixture('singles',4);await apply(s,owner,'liveStart',{eventId:e.id},now);const before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'eventEdit',{eventId:e.id,matchFormat:'doubles',venue:e.venue,address:'',capacity:16,cancelDeadline:e.cancelDeadline,note:''},now),/已有分组/);assert.deepEqual(s,before);
 await assert.rejects(()=>apply(s,owner,'pointsModeSelect',{eventId:e.id,mode:'fixed'},now),/单打/);
 const doubles=await fixture('doubles',4);await apply(doubles.s,doubles.owner,'liveStart',{eventId:doubles.e.id},now);assert.equal(doubles.s.matches[0].a.length,2);assert.equal(doubles.s.matches[0].b.length,2);
});
