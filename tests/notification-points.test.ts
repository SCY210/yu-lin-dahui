import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Account} from '../lib/domain/types';
import {notificationPointEntries,notificationPointsStatus,recordNotificationPoints} from '../lib/domain/notification-points';
import {doublesQuarterlyLeaderboard,doublesAnnualLeaderboard,singlesQuarterlyLeaderboard} from '../lib/domain/ranking';

const member:Account={id:'notification-test-member',playerId:'notification-test-player',role:'member',email:''};
test('notification points award and penalty are durable, account-specific and each applied once',()=>{
 const s=emptyState(),now=Date.UTC(2026,9,13,12);
 assert.equal(recordNotificationPoints(s,member,'disable',now),0);
 assert.equal(recordNotificationPoints(s,member,'enable',now),10);
 assert.equal(recordNotificationPoints(s,member,'enable',now+1),0);
 assert.equal(notificationPointsStatus(s,member).status,'earned');
 assert.equal(recordNotificationPoints(s,member,'disable',now+2),-30);
 assert.equal(recordNotificationPoints(s,member,'disable',now+3),0);
 assert.equal(recordNotificationPoints(s,member,'enable',now+4),0);
 assert.equal(notificationPointEntries(s).reduce((sum,row)=>sum+row.points,0),-20);
 assert.equal(notificationPointsStatus(s,{...member,id:'different-member'}).status,'available');
 assert.equal(notificationPointsStatus(s,{...member,playerId:'different-player'}).status,'disabled','rebinding cannot farm a second award');
 assert.equal(s.players.length,0,'No cultivation/rating mutation');
});
test('unrelated and malformed audit records do not grant notification points',()=>{
 const s=emptyState();s.audits.push({id:'unrelated',at:1,actor:member.id,action:'notificationPoints',reason:'',changes:{policy:'other-version',playerId:member.playerId,period:'2026-10',kind:'enable'}});
 assert.equal(notificationPointEntries(s).length,0);
 assert.equal(notificationPointsStatus(s,member).status,'available');
});
test('notification points reach the matching doubles quarter/year, without games or cultivation changes',()=>{
 const s=emptyState(),now=Date.UTC(2026,9,13,12);s.accounts.push(member);
 s.players.push({id:member.playerId,name:'Synthetic member',ownerId:member.id,enabled:true,initialRating:0,rating:0,ratedGames:0,ratingReason:''});
 recordNotificationPoints(s,member,'enable',now);
 const before=doublesQuarterlyLeaderboard(s,'2026-Q4',now)[0];
 assert.equal(before.notificationPoints,10);assert.equal(before.points,10);assert.equal(before.games,0);
 recordNotificationPoints(s,member,'disable',now+1);
 for(const rows of [doublesQuarterlyLeaderboard(s,'2026-Q4',now+2),doublesAnnualLeaderboard(s,2026,now+2)]){
  assert.equal(rows[0].points,-20);assert.equal(rows[0].notificationPoints,-20);assert.deepEqual(rows[0].realmScore,before.realmScore);
 }
 assert.equal(doublesQuarterlyLeaderboard(s,'2027-Q1',now)[0].points,0);
 assert.equal(singlesQuarterlyLeaderboard(s,'2026-Q4',now).length,0);
 assert.deepEqual(notificationPointEntries(structuredClone(s)).map(row=>row.points),[10,-30]);
});
