import {fail,type Account,type Event,type State} from './types';

export function canManageEvent(account:Pick<Account,'id'|'role'>,event:Pick<Event,'creatorId'>){
 return account.role==='admin'||event.creatorId===account.id;
}

/** Score entry is shared by the event's signed-up accounts, not just its host.
 * Resolve the account's own player and active signup from stored data. A proxy
 * signup, match team or client-supplied eventId never grants account authority.
 */
export function canRecordScore(s:Pick<State,'registrations'>,a:Pick<Account,'id'|'role'|'playerId'>,event:Event){
 if(event.deletedAt!==undefined)return false;
 if(canManageEvent(a,event))return true;
 if(['draft','cancelled'].includes(event.status))return false;
 return s.registrations.some(r=>r.eventId===event.id&&r.playerId===a.playerId&&
  (r.bookingSignups?r.bookingSignups.some(row=>['confirmed','waitlist'].includes(row.status)):['confirmed','waitlist'].includes(r.status)));
}

const eventActions=new Set(['pointsModeVoting','pointsModeSelect','planPoints','publishPoints','shuttleOption','shuttleRemove','shuttleConfirm','shuttleVoting','deleteEvent','restoreEvent','eventStatus','eventEdit','booking','bookingEdit','moveQueue','attendance','attendanceEdit','generate','swap','moveCourt','lock','publish','start','cancelRound','score','matchScoring','void','cost','costOverride','bookingBearer','deleteCost','modes','exemption','settle','playSettings','handicap','challengeMatch']);

// Resolve nested IDs from persisted state: a supplied eventId cannot grant access
// to a booking, attendance record, round, match or cost belonging to another event.
export function authorizeEventAction(s:State,a:Account,action:string,p:Record<string,unknown>){
 if(!eventActions.has(action))return false;
 let eventId:unknown=p.eventId;
 if(['bookingEdit','bookingBearer'].includes(action))eventId=s.bookings.find(b=>b.id===p.bookingId)?.eventId;
 else if(action==='attendanceEdit')eventId=s.attendance.find(at=>at.id===p.attendanceId)?.eventId;
 else if(['swap','publish','start','cancelRound'].includes(action))eventId=s.rounds.find(r=>r.id===p.roundId)?.eventId;
 else if(['moveCourt','lock','score','matchScoring','void','handicap','challengeMatch'].includes(action))eventId=s.matches.find(m=>m.id===p.matchId)?.eventId;
 else if(['costOverride','deleteCost'].includes(action))eventId=s.costs.find(c=>c.id===p.costId)?.eventId;
 const event=s.events.find(e=>e.id===eventId)??fail('活动或关联记录不存在');
 if(action==='score'){
  if(!canRecordScore(s,a,event))fail('403: 只有本活动已接龙的球友、创建者或管理员可以录入比分');
 }else if(!canManageEvent(a,event))fail('403: 只能管理自己创建的活动');
 if(event.deletedAt!==undefined&&!['deleteEvent','restoreEvent'].includes(action))fail('活动已删除，请先恢复活动');
 return true;
}

export function isEventAction(action:string){return eventActions.has(action)}
