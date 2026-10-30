import {eventRankingEnabled} from './event-ranking';
import {isPractice,eventFormat} from './match-format';
import {eventStatusAt} from './event-lifecycle';
import {month,type Account,type Event,type State} from './types';

/** MVP voting closes this long after the scheduled end; the most-voted players then receive `mvpPoints`. */
export const awardVotingHours=24;
export const mvpPoints=5;
export const awardVotingClosesAt=(e:Pick<Event,'end'>)=>e.end+awardVotingHours*3600000;
export function mvpVotes(s:Pick<State,'awardVotes'>,e:Pick<Event,'id'|'start'|'end'>){return s.awardVotes.filter(v=>v.eventId===e.id&&v.category==='mvp'&&Number.isFinite(v.at)&&v.at>=e.start&&v.at<awardVotingClosesAt(e))}
export function canAwardMvpPoints(e:Event){return e.deletedAt===undefined&&eventRankingEnabled(e)&&!e.tournament&&!['draft','cancelled'].includes(e.status)}

type VotingState={players:Pick<State['players'][number],'id'|'enabled'>[];registrations:State['registrations'];attendance:State['attendance'];matches?:State['matches']};

/** Formal participation and past attendance preserve eligibility after play. */
export function awardCandidateIds(s:VotingState,eventId:string,now=Date.now()):string[]{
 const participants=new Set(s.registrations.filter(r=>r.eventId===eventId&&r.status==='confirmed').map(r=>r.playerId));
 // Automatic attendance may include planned future intervals in the club view.
 // Only intervals that have begun qualify independently of a formal sign-up.
 for(const at of s.attendance)if(at.eventId===eventId&&at.start<=now&&(at.end===null||at.end>at.start))participants.add(at.playerId);
 for(const m of s.matches??[])if(m.eventId===eventId&&m.status==='complete'&&m.start!==null&&m.end!==null&&m.start<=now&&m.end<=now&&m.end>m.start)for(const id of [...m.a,...m.b])participants.add(id);
 return s.players.filter(p=>p.enabled&&participants.has(p.id)).map(p=>p.id);
}

export function isAwardVotingOpen(s:Pick<State,'matches'>,e:Event,now=Date.now()):boolean{
 if(isPractice(e)||e.deletedAt!==undefined||['draft','cancelled'].includes(e.status)||now<e.start)return false;
 if(now>=awardVotingClosesAt(e))return false;
 // Missing score entry must not hold a finished activity's voting hostage.
 if(now>=e.end)return true;
 return eventStatusAt(e,now)==='ended'&&!s.matches.some(m=>m.eventId===e.id&&m.status==='playing');
}

export function canCastAwardVote(s:VotingState&Pick<State,'matches'>,e:Event,a:Account,now=Date.now()):boolean{
/** Only participants vote: being an administrator or the creator gives no ballot, since MVP votes award season points. */
 return isAwardVotingOpen(s,e,now)&&awardCandidateIds(s,e.id,now).includes(a.playerId);
}

/** The final MVP of an activity once voting has closed: everyone tied for the most votes (at least one). */
export function mvpWinners(s:Pick<State,'awardVotes'>,e:Pick<Event,'id'|'start'|'end'>,now:number){
 if(now<awardVotingClosesAt(e))return [];
 const counts=new Map<string,number>();
 for(const v of mvpVotes(s,e))counts.set(v.playerId,(counts.get(v.playerId)??0)+1);
 const max=Math.max(0,...counts.values());
 return max?[...counts].filter(([,n])=>n===max).map(([id])=>id).sort():[];
}
/** Season points for MVPs, on the activity's singles or doubles board in the month it started. */
export function mvpPointAdjustments(s:Pick<State,'events'|'awardVotes'>,now:number){
 return s.events.filter(canAwardMvpPoints).flatMap(e=>
  mvpWinners(s,e,now).map(playerId=>({playerId,eventId:e.id,period:month(e.start),format:eventFormat(e) as 'singles'|'doubles',delta:mvpPoints})));
}
