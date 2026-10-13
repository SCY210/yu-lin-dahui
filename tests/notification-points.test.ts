import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Account} from '../lib/domain/types';
import {notificationPointEntries,notificationPointsStatus,recordNotificationPoints,notificationPointsPolicy} from '../lib/domain/notification-points';
import {doublesQuarterlyLeaderboard,doublesAnnualLeaderboard,singlesQuarterlyLeaderboard} from '../lib/domain/ranking';
const member:Account={id:'notification-test-member',playerId:'notification-test-player',role:'member',email:''};
const now=Date.UTC(2026,9,13,12);
test('initial reward is once-only; closing deducts 30 and verified reactivation adds only 10 per episode',()=>{
 const s=emptyState();assert.equal(recordNotificationPoints(s,member,'disable',now),0);assert.equal(recordNotificationPoints(s,member,'reactivate',now),0);
 assert.equal(recordNotificationPoints(s,member,'enable',now),10);assert.equal(recordNotificationPoints(s,member,'enable',now+1),0);
 assert.equal(recordNotificationPoints(s,member,'disable',now+2),-30);assert.equal(recordNotificationPoints(s,member,'disable',now+3),0);
 assert.equal(notificationPointsStatus(s,{...member,playerId:'rebound-player'}).status,'disabled');
 assert.equal(recordNotificationPoints(s,member,'reactivate',now+4),10);assert.equal(recordNotificationPoints(s,member,'reactivate',now+5),0);assert.equal(recordNotificationPoints(s,member,'enable',now+6),0);
 assert.equal(notificationPointsStatus(s,member).status,'earned');assert.equal(notificationPointEntries(s).reduce((n,row)=>n+row.points,0),-10);
 assert.equal(recordNotificationPoints(s,member,'disable',now+7),-30);assert.equal(recordNotificationPoints(s,member,'reactivate',now+8),10);
 assert.deepEqual(notificationPointEntries(s).map(row=>row.points),[10,-30,10,-30,10]);assert.equal(s.players.length,0);
});
test('reactivation belongs to its current quarter and never reverses the original penalty or cultivation',()=>{
 const s=emptyState();s.accounts.push(member);s.players.push({id:member.playerId,name:'Synthetic member',ownerId:member.id,enabled:true,initialRating:0,rating:0,ratedGames:0,ratingReason:''});
 recordNotificationPoints(s,member,'enable',now);recordNotificationPoints(s,member,'disable',now+1);
 const before=doublesQuarterlyLeaderboard(s,'2026-Q4',now)[0];assert.equal(before.points,-20);
 const later=Date.UTC(2027,0,8,12);assert.equal(recordNotificationPoints(s,member,'reactivate',later),10);
 const activation=notificationPointEntries(s).at(-1)!;assert.equal(activation.period,'2027-01');assert.equal(activation.reactivates,s.audits[1].id);
 assert.equal(doublesQuarterlyLeaderboard(s,'2026-Q4',later)[0].points,-20);assert.equal(doublesQuarterlyLeaderboard(s,'2027-Q1',later)[0].points,10);
 assert.equal(doublesAnnualLeaderboard(s,2026,later)[0].points,-20);assert.equal(doublesAnnualLeaderboard(s,2027,later)[0].points,10);
 assert.deepEqual(doublesQuarterlyLeaderboard(s,'2027-Q1',later)[0].realmScore,before.realmScore);assert.equal(singlesQuarterlyLeaderboard(s,'2027-Q1',later).length,0);
});
test('duplicate, orphan and wrong-account reactivations cannot manufacture points',()=>{
 const s=emptyState();recordNotificationPoints(s,member,'enable',now);recordNotificationPoints(s,member,'disable',now+1);recordNotificationPoints(s,member,'reactivate',now+2);
 const activation=structuredClone(s.audits.at(-1)!);s.audits.push({...activation,id:'duplicate'},{...activation,id:'orphan',changes:{...activation.changes as object,reactivates:'missing'}},{...activation,id:'wrong-account',actor:'other'});
 assert.equal(notificationPointEntries(s).filter(row=>row.kind==='reactivate').length,1);assert.equal(notificationPointEntries(s).reduce((n,row)=>n+row.points,0),-10);
 s.audits.push({id:'malformed',at:now,actor:member.id,action:'notificationPoints',reason:'',changes:{policy:'other-version',kind:'reactivate',points:30}});assert.equal(notificationPointEntries(s).length,3);
});
test('already-settled historical 30-point refunds stay intact but new reactivations are only 10',()=>{
 const s=emptyState();recordNotificationPoints(s,member,'enable',now);recordNotificationPoints(s,member,'disable',now+1);
 const penalty=s.audits.at(-1)!;s.audits.push({id:'historical-refund',at:now+2,actor:member.id,action:'notificationPoints',reason:'Historical policy',changes:{policy:notificationPointsPolicy,playerId:member.playerId,period:'2026-10',kind:'refund',points:30,refundOf:penalty.id}});
 assert.equal(notificationPointsStatus(s,member).status,'earned');assert.equal(notificationPointEntries(s).reduce((n,row)=>n+row.points,0),10);
 assert.equal(recordNotificationPoints(s,member,'reactivate',now+3),0);recordNotificationPoints(s,member,'disable',now+4);assert.equal(recordNotificationPoints(s,member,'reactivate',now+5),10);
 assert.deepEqual(notificationPointEntries(s).map(row=>row.points),[10,-30,30,-30,10]);assert.equal(notificationPointEntries(s).reduce((n,row)=>n+row.points,0),-10);
});
