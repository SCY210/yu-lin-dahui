import {shuttleParticipantIds} from './shuttle-voting';
import type {Event,Account} from './types';
import {eventFormat} from './match-format';

export type PointsMode='rotate'|'fixed';
export const pointsModeLabels={rotate:'每轮换搭档',fixed:'固定搭档'};
export function pointsChoiceCounts(s:Parameters<typeof shuttleParticipantIds>[0],e:Event){
 const participants=shuttleParticipantIds(s,e.id),counts={rotate:0,fixed:0};
 for(const vote of e.pointsChoice?.votes??[])if(participants.has(vote.playerId)&&Object.hasOwn(counts,vote.mode))counts[vote.mode]++;
 return counts;
}
/** An unconfigured, unconfirmed activity starts open; explicit closures stay closed. */
export function pointsVotingOpen(e:Event,now=Date.now()){
 if(eventFormat(e)==='singles')return false;
 const open=e.pointsChoice?.votingOpen??!e.pointsChoice?.selectedMode;
 return e.deletedAt===undefined&&['open','locked'].includes(e.status)&&now<e.start&&open;
}
export function canVotePointsMode(s:Parameters<typeof shuttleParticipantIds>[0],e:Event,a:Pick<Account,'playerId'>,now=Date.now()){
 return pointsVotingOpen(e,now)&&shuttleParticipantIds(s,e.id).has(a.playerId);
}
