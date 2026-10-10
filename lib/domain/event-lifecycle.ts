import type {Event,Match,State} from './types';

/** The clock is authoritative for an opened activity. Keep the stored status
 * intact so extending its court bookings does not require a manual reopen. */
export function eventStatusAt(e:Event,now=Date.now()):Event['status']{
 return e.deletedAt===undefined&&['open','locked','live'].includes(e.status)&&now>=e.end?'ended':e.status;
}

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
