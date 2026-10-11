import {z} from 'zod';
import type {Event,State} from './types';
export type PointsSession={startedAt?:number;attendance:{playerId:string;late:boolean;available:boolean;at:number}[];waiting:{matchId:string;replacement:'player'|'group';playerId:string}[]};
export const pointsSession=():PointsSession=>({attendance:[],waiting:[]});
export const awaitingArrival=(e:Pick<Event,'pointsSession'>,playerId:string)=>!!e.pointsSession?.attendance.some(row=>row.playerId===playerId&&row.late&&!row.available);
/** An ordinary start/refill can resolve a waiting court without using its retry button. */
export function clearFilledPointsWaiting(s:Pick<State,'matches'|'bookings'>,e:Event){
 if(!e.pointsSession?.waiting.length)return;
 const key=(id:string)=>{const b=s.bookings.find(b=>b.id===id);return b?JSON.stringify([b.venue??e.venue,b.name]):id};
 e.pointsSession.waiting=e.pointsSession.waiting.filter(row=>{const old=s.matches.find(m=>m.id===row.matchId);return old&&!s.matches.some(m=>m.eventId===e.id&&m.status==='playing'&&key(m.courtId)===key(old.courtId))});
}
const adjustment=z.object({playerId:z.string(),period:z.string().regex(/^\d{4}-\d{2}$/),format:z.enum(['singles','doubles']),delta:z.union([z.literal(-1),z.literal(0),z.literal(1)])});
/** Separate from owner grants: lateness changes only the matching points board, never 修为. */
export function attendancePointAdjustments(s:Pick<State,'audits'>){return s.audits.flatMap(a=>{if(!['pointsLate','pointsPresence'].includes(a.action))return [];const parsed=adjustment.safeParse(a.changes);return parsed.success?[{...parsed.data,id:a.id,at:a.at}]:[]})}
