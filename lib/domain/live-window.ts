import type {Event} from './types';

/** Explicit live actions may continue after the scheduled end. A manual closure
 * before that time, drafts, cancellation and deletion still stop play. */
export function liveActivityAvailable(e:Pick<Event,'start'|'end'|'status'|'deletedAt'>,now:number){
 return e.deletedAt===undefined&&!['draft','cancelled'].includes(e.status)&&(e.status!=='ended'||now>=e.end);
}

/** Overtime uses the last scheduled attendance/court phase. Match timestamps
 * remain real time; booking, attendance and fee durations are never extended. */
export function liveAvailabilityTime(e:Pick<Event,'end'>,now:number){return Math.min(now,e.end-1)}
