import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Account} from '../lib/domain/types';
import {notificationPointEntries,notificationPointsStatus,recordNotificationPoints} from '../lib/domain/notification-points';
import {doublesQuarterlyLeaderboard,doublesAnnualLeaderboard,singlesQuarterlyLeaderboard} from '../lib/domain/ranking';

const member:Account={id:'notification-test-member',playerId:'notification-test-player',role:'member',email:''};
test('notification reward is once-only and each penalty has one paired refund',()=>{
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
 assert.equal(recordNotificationPoints(s,member,'refund',now+5),30);
 assert.equal(recordNotificationPoints(s,member,'refund',now+6),0);
 assert.equal(recordNotificationPoints(s,member,'enable',now+7),0);
 assert.equal(notificationPointsStatus(s,member).status,'earned');
 assert.equal(notificationPointEntries(s).reduce((sum,row)=>sum+row.points,0),10);
 assert.equal(recordNotificationPoints(s,member,'disable',now+8),-30);
 assert.equal(recordNotificationPoints(s,member,'disable',now+9),0);
 assert.equal(recordNotificationPoints(s,member,'refund',now+10),30);
 assert.deepEqual(notificationPointEntries(s).map(row=>row.points),[10,-30,30,-30,30]);
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
 const later=Date.UTC(2027,0,8,12);
 assert.equal(recordNotificationPoints(s,{...member,playerId:'rebound-player'},'refund',later),30);
 const refund=notificationPointEntries(s).at(-1)!;
 assert.equal(refund.playerId,member.playerId);assert.equal(refund.period,'2026-10');assert.equal(refund.refundOf,s.audits[1].id);
 assert.equal(doublesQuarterlyLeaderboard(s,'2026-Q4',later)[0].points,10);
 assert.equal(doublesQuarterlyLeaderboard(s,'2027-Q1',later)[0].points,0);
 assert.equal(doublesAnnualLeaderboard(s,2026,later)[0].points,10);
});
test('orphan, mismatched and duplicate refunds cannot manufacture points',()=>{
 const s=emptyState(),now=Date.UTC(2026,9,13,12);recordNotificationPoints(s,member,'enable',now);recordNotificationPoints(s,member,'disable',now+1);recordNotificationPoints(s,member,'refund',now+2);
 const refund=structuredClone(s.audits.at(-1)!);
 s.audits.push({...refund,id:'duplicate'}, {...refund,id:'orphan',changes:{...refund.changes as object,refundOf:'missing'}}, {...refund,id:'wrong-account',actor:'different-member'}, {...refund,id:'wrong-period',changes:{...refund.changes as object,period:'2027-01'}});
 assert.equal(notificationPointEntries(s).reduce((sum,row)=>sum+row.points,0),10);
 assert.equal(notificationPointEntries(s).filter(row=>row.kind==='refund').length,1);
});
