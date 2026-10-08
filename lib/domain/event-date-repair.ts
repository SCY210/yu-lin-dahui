import {clubOwnerId} from './ownership';
import {replayRating} from './ranking';
import {fail,type State} from './types';

export type EventDateRepair={eventId:string;fromStart:number;fromEnd:number;toStart:number;toEnd:number};

/** Owner-confirmed correction of one misdated activity, never a score rewrite. */
export function repairEventDate(s:State,plan:EventDateRepair,now:number){
 const original=s.events.find(e=>e.id===plan.eventId);
 if(!original||original.deletedAt!==undefined||original.start!==plan.fromStart||original.end!==plan.fromEnd)return false;
 const owner=clubOwnerId(s);
 if(!owner||original.creatorId!==owner||!s.accounts.some(a=>a.id===owner&&a.role==='admin'))return false;
 const delta=plan.toStart-plan.fromStart;
 if(plan.toEnd-plan.fromEnd!==delta||plan.toEnd<=plan.toStart||now<plan.toEnd)fail('日期修正计划无效');
 const work=structuredClone(s),e=work.events.find(e=>e.id===plan.eventId)!;
 const rows=<T extends {eventId:string}>(collection:T[])=>collection.filter(x=>x.eventId===e.id);
 const time=(t:number|null)=>t===null?null:t+delta;
 const snapshot={event:structuredClone(original),bookings:rows(s.bookings),registrations:rows(s.registrations),rounds:rows(s.rounds),matches:rows(s.matches),attendance:rows(s.attendance),costs:rows(s.costs),settlements:rows(s.settlements)};
 e.start=plan.toStart;e.end=plan.toEnd;e.signupDeadline+=delta;e.cancelDeadline+=delta;
 if(e.pointsPlan)e.pointsPlan={...e.pointsPlan,start:e.pointsPlan.start+delta,end:e.pointsPlan.end+delta};
 for(const b of rows(work.bookings)){b.start+=delta;b.end+=delta}
 for(const r of rows(work.registrations)){r.arrival+=delta;r.departure+=delta;for(const slot of r.bookingSignups??[]){slot.arrival+=delta;slot.departure+=delta}}
 for(const r of rows(work.rounds))r.start+=delta;
 for(const m of rows(work.matches)){m.start=time(m.start);m.end=time(m.end)}
 for(const a of rows(work.attendance)){a.start+=delta;a.end=time(a.end)}
 for(const c of rows(work.costs)){c.start=time(c.start);c.end=time(c.end);for(const interval of c.overrides??[]){interval.start+=delta;interval.end+=delta}}
 for(const settlement of rows(work.settlements))for(const line of settlement.detail){line.start+=delta;line.end+=delta}
 replayRating(work);
 work.audits.push({id:crypto.randomUUID(),at:now,actor:owner,action:'repairEventDate',reason:'群主确认周四双打局实际为2026年10月8日19:00–21:00，修正误存的周五日期，保留比分与接龙',changes:{plan,before:snapshot,after:{start:e.start,end:e.end},matches:rows(work.matches).length,registrations:rows(work.registrations).length}});
 Object.assign(s,work);return true;
}
