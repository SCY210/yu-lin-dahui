import type {State,Account,Event} from './types';

type ShuttleState={players:Pick<State['players'][number],'id'|'enabled'>[];registrations:Pick<State['registrations'][number],'eventId'|'status'|'playerId'>[]};
export function shuttleParticipantIds(s:ShuttleState,eventId:string){
 const enabled=new Set(s.players.filter(p=>p.enabled).map(p=>p.id));
 return new Set(s.registrations.filter(r=>r.eventId===eventId&&r.status!=='cancelled'&&enabled.has(r.playerId)).map(r=>r.playerId));
}
export function canVoteForShuttle(s:ShuttleState,e:Event,a:Pick<Account,'playerId'>,now=Date.now()){
 return e.deletedAt===undefined&&['open','locked'].includes(e.status)&&now<e.start&&!!e.shuttlePlan?.votingOpen&&shuttleParticipantIds(s,e.id).has(a.playerId);
}
export function shuttleVoteCounts(s:ShuttleState,e:Event){
 const participants=shuttleParticipantIds(s,e.id),counts:Record<string,number>={};
 for(const option of e.shuttlePlan?.options??[])counts[option.id]=0;
 for(const vote of e.shuttlePlan?.votes??[])if(participants.has(vote.playerId)&&Object.hasOwn(counts,vote.optionId))counts[vote.optionId]++;
 return counts;
}
