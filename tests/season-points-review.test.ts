import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Match} from '../lib/domain/types';
import {inactiveAt} from '../lib/domain/realm-rating';
import {mergeStrengthRating,doublesAnnualLeaderboard} from '../lib/domain/ranking';
import {clubViewValidUntil} from '../lib/club-read-cache';
import {projectClubState} from '../lib/club-view';
const last=Date.parse('2026-01-31T10:00:00.123Z'),due=Date.parse('2026-04-30T10:00:00.123Z');
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.strengthVersion='realm-elo-v2';s.settings.ownerAccountId='a';
 for(const id of ['a','b','c','d']){s.accounts.push({id,email:'',role:'member',playerId:id});s.players.push({id,ownerId:id,name:id,enabled:true,initialRating:1000,rating:1500,ratedGames:30,ratingReason:''})}
 const m:Match={id:'old',eventId:'old-event',roundId:'old-round',courtId:'old-court',a:['a','b'],b:['c','d'],status:'complete',start:last-60000,end:last,scoreA:21,scoreB:19,games:[{a:21,b:19}],monthly:true,elo:true,locked:false,enteredBy:'a'};s.matches.push(m);return s;
}
test('three calendar months clamp a short target month instead of rolling into the next month',()=>{
 assert.equal(inactiveAt(last,due-1),false);assert.equal(inactiveAt(last,due),true);
 assert.equal(inactiveAt(Date.parse('2027-11-30T08:15:00Z'),Date.parse('2028-02-29T08:15:00Z')),true);
});
test('already migrated grouping strength catches up after inactivity without another migration or lost season points',()=>{
 const s=fixture(),revision=s.revision,audits=structuredClone(s.audits),history=structuredClone(s.matches);
 assert.equal(mergeStrengthRating(s,due),null);assert.ok(s.players.every(p=>p.rating===1000&&p.ratedGames===0));assert.equal(s.revision,revision);assert.deepEqual(s.audits,audits);assert.deepEqual(s.matches,history);
 assert.equal(doublesAnnualLeaderboard(s,2026,due).find(r=>r.playerId==='a')!.points,3);assert.equal(doublesAnnualLeaderboard(s,2026,due).find(r=>r.playerId==='c')!.points,-1);
});
test('cached responses expire exactly at an inactivity deadline even without another write',()=>{
 const s=fixture();assert.equal(clubViewValidUntil(s,s.accounts[0],due-1000),due);
});
test('legacy open tabs still receive the monthly compatibility field without exposing raw matchmaking ratings',()=>{
 const s=fixture(),view=projectClubState(s,s.accounts[0],'2026-01',2026,last+1000);
 assert.ok(Array.isArray(view.leaderboard));assert.ok(view.leaderboard.every(row=>row.rating===null));assert.equal(view.leaderboard.find(row=>row.playerId==='a')!.points,3);
});
