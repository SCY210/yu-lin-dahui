import {shuttleParticipantIds} from './shuttle-voting';
import type {Event,Account} from './types';

export type PointsMode='rotate'|'fixed';
export const pointsModeLabels={rotate:'每轮换搭档',fixed:'固定搭档'};
export function pointsChoiceCounts(s:Parameters<typeof shuttleParticipantIds>[0],e:Event){
 const participants=shuttleParticipantIds(s,e.id),counts={rotate:0,fixed:0};
 for(const vote of e.pointsChoice?.votes??[])if(participants.has(vote.playerId)&&Object.hasOwn(counts,vote.mode))counts[vote.mode]++;
 return counts;
}
export function canVotePointsMode(s:Parameters<typeof shuttleParticipantIds>[0],e:Event,a:Pick<Account,'playerId'>,now=Date.now()){
 return e.deletedAt===undefined&&['open','locked'].includes(e.status)&&now<e.start&&!!e.pointsChoice?.votingOpen&&shuttleParticipantIds(s,e.id).has(a.playerId);
}
