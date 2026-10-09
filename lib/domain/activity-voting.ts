import {canManageEvent} from './permissions';
import {eventStatusAt} from './event-lifecycle';
import type {Account,Event,State} from './types';

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
 if(e.deletedAt!==undefined||['draft','cancelled'].includes(e.status)||now<e.start)return false;
 // Missing score entry must not hold a finished activity's voting hostage.
 if(now>=e.end)return true;
 return eventStatusAt(e,now)==='ended'&&!s.matches.some(m=>m.eventId===e.id&&m.status==='playing');
}

export function canCastAwardVote(s:VotingState&Pick<State,'matches'>,e:Event,a:Account,now=Date.now()):boolean{
 return isAwardVotingOpen(s,e,now)&&(canManageEvent(a,e)||awardCandidateIds(s,e.id,now).includes(a.playerId));
}
