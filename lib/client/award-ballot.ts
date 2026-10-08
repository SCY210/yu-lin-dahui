import type {AwardVote} from '../domain/types';
export const awardCategories=['mvp','defense','net','effort'] as const;
export type AwardCategory=typeof awardCategories[number];
export function awardSummary(votes:AwardVote[],eventId:string,category:AwardCategory){
 const chosen=votes.filter(v=>v.eventId===eventId&&v.category===category);
 const counts=new Map<string,number>();for(const vote of chosen)counts.set(vote.playerId,(counts.get(vote.playerId)??0)+1);
 const max=Math.max(0,...counts.values());
 return {total:chosen.length,counts,max,leaders:max?[...counts].filter(([,n])=>n===max).map(([id])=>id):[]};
}
