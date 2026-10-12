'use client';
import {eventDisplayLabels,eventDisplayStatus} from '../lib/client/event-display-status';
import {useActivityClock} from '../lib/client/use-activity-clock';
import type {Event} from '../lib/domain/types';
import './event-status-badge.css';

/** One colour per state so 报名中, 已截止, 进行中, 已结束 and 已取消 are told apart at a glance. */
export default function EventStatusBadge({e,capacity}:{e:Pick<Event,'id'|'status'|'start'|'end'|'signupDeadline'|'deletedAt'>;capacity?:{occupied:number;capacity:number}}){
 const now=useActivityClock(e),status=eventDisplayStatus(e,now,capacity);
 return <span className="badge event-status-badge" data-status={status}>{status==='live'&&<span className="event-status-dot" aria-hidden="true"/>}{eventDisplayLabels[status]}</span>;
}
