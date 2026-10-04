import {canManageEvent} from './permissions';
import type {Account,Event,State} from './types';

type VotingState=Pick<State,'players'|'registrations'|'attendance'>;

/** Formal sign-ups may vote before play; past attendance preserves participation. */
export function awardCandidateIds(s:VotingState,eventId:string,now=Date.now()):string[]{
 const participants=new Set(s.registrations.filter(r=>r.eventId===eventId&&r.status==='confirmed').map(r=>r.playerId));
 // Automatic attendance may include planned future intervals in the club view.
 // Only intervals that have begun qualify independently of a formal sign-up.
 for(const at of s.attendance)if(at.eventId===eventId&&at.start<=now&&(at.end===null||at.end>at.start))participants.add(at.playerId);
 return s.players.filter(p=>p.enabled&&participants.has(p.id)).map(p=>p.id);
}

export function canCastAwardVote(s:VotingState,e:Event,a:Account,now=Date.now()):boolean{
 return e.status!=='cancelled'&&(canManageEvent(a,e)||awardCandidateIds(s,e.id,now).includes(a.playerId));
}
