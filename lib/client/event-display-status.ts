import {eventStatusAt,signupClosed} from '../domain/event-lifecycle';
import type {Event} from '../domain/types';

/** What a member should read at a glance on an activity: derived from the stored status, the clock, the sign-up
 * deadline and the capacity, so a stored "open" never says 报名中 after sign-ups have closed. */
export type EventDisplayStatus='draft'|'open'|'full'|'closed'|'locked'|'live'|'ended'|'cancelled';
export const eventDisplayLabels:Record<EventDisplayStatus,string>={draft:'草稿',open:'报名中',full:'已满 · 可候补',closed:'报名已截止',locked:'报名已锁定',live:'进行中',ended:'已结束',cancelled:'已取消'};

type StatusEvent=Pick<Event,'status'|'start'|'end'|'signupDeadline'|'deletedAt'>;
export function eventDisplayStatus(e:StatusEvent,now:number,capacity?:{occupied:number;capacity:number}):EventDisplayStatus{
 if(e.status==='cancelled')return 'cancelled';
 if(e.status==='draft')return 'draft';
 if(eventStatusAt(e as Event,now)==='ended'||now>=e.end)return 'ended';
 if(e.status==='live'||now>=e.start)return 'live';
 if(e.status==='locked')return 'locked';
 if(signupClosed(e,now))return 'closed';
 if(capacity&&capacity.capacity>0&&capacity.occupied>=capacity.capacity)return 'full';
 return 'open';
}
