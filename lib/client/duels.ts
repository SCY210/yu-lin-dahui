import {duelGameOf,duelState,type Duel} from '../domain/duels';
import type {Booking,Event,Match,Registration} from '../domain/types';

export type DuelStart={eventId:string;title:string;duel:Duel;match:Match;court:string;player:boolean};
type Data={events:Event[];matches:Match[];registrations:Registration[];bookings:Booking[];me:{playerId:string}};
/** How long after a duel's game starts its announcement still shows (app/duel-alert.tsx). */
export const duelAlertMinutes=15;

/** 天机战帖 games that have just started, for everyone signed up for the activity (the four, and those watching): the
 * full-screen announcement, and the four's popup (docs/DUELS.md). Earliest first. */
export function startedDuels(data:Data,now:number):DuelStart[]{
 const me=data.me.playerId;
 return data.events.flatMap(e=>(e.duels??[]).flatMap(duel=>{
  const player=[...duel.a,...duel.b].includes(me);
  if(!player&&!data.registrations.some(r=>r.eventId===e.id&&r.playerId===me&&r.status==='confirmed'))return [];
  const match=duelGameOf(duel,e,data.matches);
  if(!match||match.status!=='playing'||match.start===null||now<match.start||now>=match.start+duelAlertMinutes*60000)return [];
  if(duelState(duel,e,data.matches,now)!=='locked')return [];
  return [{eventId:e.id,title:e.title,duel,match,court:data.bookings.find(b=>b.id===match.courtId)?.name??'场地',player}];
 })).sort((x,y)=>x.match.start!-y.match.start!);
}
