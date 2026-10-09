import type {State} from '../domain/types';
import {eventStatusAt} from '../domain/event-lifecycle';

/** Read only the viewer's projected data; scheduled, deleted and finished games
 * cannot become live cards just because an activity exists. */
export function homeLiveMatches(data:Pick<State,'events'|'matches'|'rounds'|'bookings'>,now:number){
 const events=new Map(data.events.filter(e=>e.deletedAt===undefined&&e.start<=now&&now<e.end&&['open','locked','live'].includes(eventStatusAt(e,now))).map(e=>[e.id,e]));
 const rounds=new Map(data.rounds.map(r=>[r.id,r])),bookings=new Map(data.bookings.map(b=>[b.id,b]));
 return data.matches.flatMap(match=>{
  const event=events.get(match.eventId),round=rounds.get(match.roundId);
  if(!event||match.status!=='playing'||match.start===null||!Number.isFinite(match.start)||match.start>now||!round||round.eventId!==event.id||round.status!=='playing')return [];
  const court=bookings.get(match.courtId);
  return [{event,match,round,court:court?.eventId===event.id?court:undefined}];
 }).sort((a,b)=>a.event.start-b.event.start||a.event.id.localeCompare(b.event.id)||(a.court?.name??'').localeCompare(b.court?.name??'','zh-CN',{numeric:true})||a.match.start!-b.match.start!||a.match.id.localeCompare(b.match.id));
}
