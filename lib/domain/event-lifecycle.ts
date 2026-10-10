import type {Event,Match,State} from './types';

/** The clock is authoritative for an opened activity. Keep the stored status
 * intact so extending its court bookings does not require a manual reopen. */
export function eventStatusAt(e:Event,now=Date.now()):Event['status']{
 return e.deletedAt===undefined&&['open','locked','live'].includes(e.status)&&now>=e.end?'ended':e.status;
}

/** New sign-ups close this long before the activity starts. */
export const signupCloseHours=2;
const hour=3600000;
/** Deadline stored when an activity is created. One created at shorter notice stays open until it starts. */
export function initialSignupDeadline(start:number,now:number){const deadline=start-signupCloseHours*hour;return now>deadline?start:deadline}
/** When new sign-ups close. Activities created before the rule stored their end time (or nothing); they follow the rule too. */
export function signupClosesAt(e:Pick<Event,'start'|'end'|'signupDeadline'>){return !Number.isFinite(e.signupDeadline)||e.signupDeadline>=e.end?e.start-signupCloseHours*hour:e.signupDeadline}
/** Members (not organisers) can no longer start a new sign-up. Existing sign-ups can still be adjusted. */
export function signupClosed(e:Pick<Event,'start'|'end'|'signupDeadline'>,now:number){return now>=signupClosesAt(e)}

/** An activity no longer in progress: ended by the clock or by its organiser,
 * cancelled, or past its end time in any state. Derived on every read, so no
 * write (or visit) is needed when the scheduled end passes. */
export function activityConcluded(e:Event,now=Date.now()){
 return ['ended','cancelled'].includes(eventStatusAt(e,now))||now>=e.end;
}

/** Growth settles per activity: a result counts once its activity has concluded.
 * A match whose activity record is missing settles at its own completion. */
export function settledMatchFilter(s:Pick<State,'events'>,now=Date.now()){
 const events=new Map(s.events.map(e=>[e.id,e]));
 return (m:Pick<Match,'eventId'>)=>{const e=events.get(m.eventId);return !e||activityConcluded(e,now)};
}
