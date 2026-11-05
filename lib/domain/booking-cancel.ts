import {z} from 'zod';
import {authorizeEventAction} from './permissions';
import {editReason} from './edit-reason';
import {bookingAllowsPlayer,syncRegistration} from './booking-signups';
import {recordCancellation} from './cancellations';
import {pendingMatchLineup} from './round-lineup';
import {replanAfterExpiry} from './planned-replan';
import {fail,type Account,type State} from './types';

const inputSchema=z.object({bookingId:z.string().min(1).max(100),reason:editReason});

/** Cancel one unused court atomically. The original court and signups remain in the audit, while settled versions,
 * payments and played results retain their original records. */
export function applyBookingCancellation(s:State,a:Account,action:string,input:unknown,now:number){
 if(action!=='bookingCancel')return false;
 const p=inputSchema.parse(input);authorizeEventAction(s,a,action,p);
 const work=structuredClone(s),b=work.bookings.find(x=>x.id===p.bookingId)??fail('场地不存在或已取消');
 const e=work.events.find(x=>x.id===b.eventId)??fail('活动不存在');
 const courtMatches=work.matches.filter(m=>m.courtId===b.id);
 if(courtMatches.some(m=>m.status!=='cancelled'&&!pendingMatchLineup(m))||
  courtMatches.some(m=>m.start!==null||m.scoreA!==null||m.scoreB!==null||m.games.length)||
  work.attendance.some(row=>row.bookingId===b.id&&row.start<now&&(row.end===null||row.end>row.start)))
  fail('该场地已有开打、比分或参加记录，不能直接取消，请先核对历史记录');
 const eventRegistrations=work.registrations.filter(r=>r.eventId===e.id);
 const originalRegistrations=structuredClone(eventRegistrations.filter(r=>r.bookingSignups?.some(row=>row.bookingId===b.id)||!r.bookingSignups));
 work.bookings=work.bookings.filter(x=>x.id!==b.id);
 const remaining=work.bookings.filter(x=>x.eventId===e.id);
 for(const r of eventRegistrations){
  const row=r.bookingSignups?.find(x=>x.bookingId===b.id);
  if(row&&row.status!=='cancelled'){row.status='cancelled';row.cancelRequested=false;syncRegistration(r);if(r.status==='cancelled')recordCancellation(work,r,a,now,'场地取消');}
  else if(!r.bookingSignups&&!e.tournament&&r.status!=='cancelled'&&!remaining.some(x=>x.start<r.departure&&x.end>r.arrival)){
   r.status='cancelled';r.cancelRequested=false;recordCancellation(work,r,a,now,'场地取消');
  }
 }
 const withdrawn:string[]=[],rounds=new Map(work.rounds.filter(r=>r.eventId===e.id).map(r=>[r.id,r]));
 const eventMatches=work.matches.filter(m=>m.eventId===e.id),byRound=new Map<string,typeof eventMatches>();
 for(const m of eventMatches){const rows=byRound.get(m.roundId)??[];rows.push(m);byRound.set(m.roundId,rows)}
 const availability={...work,events:[e],bookings:remaining,registrations:eventRegistrations};
 for(const m of eventMatches.filter(x=>x.status!=='cancelled')){
  const round=rounds.get(m.roundId),at=m.start??round?.start??e.start,end=at+(round?.duration??15)*60000;
  const unavailable=m.courtId===b.id||(!e.tournament&&[...m.a,...m.b].some(id=>!bookingAllowsPlayer(availability,e.id,m.courtId,id,at,end)));
  if(!unavailable)continue;
  if(m.status==='playing')fail('相关球友仍在比赛，请先完成正在进行的比赛再取消场地');
  if(pendingMatchLineup(m)){m.status='cancelled';withdrawn.push(m.id)}
 }
 const withdrawnIds=new Set(withdrawn);
 for(const r of rounds.values()){
  const matches=byRound.get(r.id)??[];
  if(matches.some(m=>withdrawnIds.has(m.id))&&matches.every(m=>['complete','forfeit','cancelled'].includes(m.status)))
   r.status=matches.some(m=>m.status!=='cancelled')?'complete':'cancelled';
 }
 if(e.pointsSession)e.pointsSession.waiting=e.pointsSession.waiting.filter(row=>!withdrawnIds.has(row.matchId));
 for(const fixture of e.tournament?.fixtures??[])if(fixture.matchId&&withdrawnIds.has(fixture.matchId))delete fixture.matchId;
 const replanned=replanAfterExpiry(work,e,now);
 work.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:p.reason??'取消场地',changes:{eventId:e.id,bookingId:b.id,booking:b,registrations:originalRegistrations,withdrawnMatchIds:withdrawn,replannedRoundIds:replanned}});
 Object.assign(s,work);return true;
}
