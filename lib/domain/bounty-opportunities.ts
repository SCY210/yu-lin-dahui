import {eventFormat} from './match-format';
import {registrationSpans} from './booking-signups';
import {awaitingArrival} from './points-attendance';
import type {Event,State} from './types';

/** Require an actual published lineup, not a hypothetical team from the signup pool. Scores are server-derived. */
export function upsetOfferEligible(s:Pick<State,'matches'|'rounds'|'players'|'registrations'|'bookings'>,e:Event,playerId:string,now:number,scores:ReadonlyMap<string,{score:number}>,gap=250){
 const players=new Map(s.players.map(p=>[p.id,p])),rounds=new Map(s.rounds.filter(r=>r.eventId===e.id).map(r=>[r.id,r])),
  registrations=new Map(s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed').map(r=>[r.playerId,r]));
 const size=eventFormat(e)==='singles'?1:2;
 return s.matches.some(m=>{
  if(m.eventId!==e.id||m.status!=='published'||!m.monthly||!m.elo||m.handicap?.applied||![...m.a,...m.b].includes(playerId))return false;
  const r=rounds.get(m.roundId);if(!r||!['published','playing'].includes(r.status))return false;
  const start=m.start??r.start,end=start+r.duration*60000,ids=[...m.a,...m.b];
  if(start<=now||start<e.start||end>e.end||end<=start||m.a.length!==size||m.b.length!==size||new Set(ids).size!==ids.length)return false;
  const court=s.bookings.find(b=>b.eventId===e.id&&b.id===m.courtId);
  if(!court||court.start>start||court.end<end)return false;
  if(ids.some(id=>{
   const p=players.get(id),signup=registrations.get(id);
   if(!p?.enabled||!signup||awaitingArrival(e,id)||!Number.isFinite(scores.get(id)?.score))return true;
   return !registrationSpans(s,e,signup).some(span=>{
    const venue=s.bookings.find(b=>b.id===span.bookingId)?.venue??e.venue;
    return venue===(court.venue??e.venue)&&span.start<=start&&(span.end??e.end)>=end;
   });
  }))return false;
  const own=m.a.includes(playerId)?m.a:m.b,other=m.a.includes(playerId)?m.b:m.a;
  const average=own.reduce((sum,id)=>sum+scores.get(id)!.score,0)/own.length;
  return other.some(id=>scores.get(id)!.score-average>=gap);
 });
}
