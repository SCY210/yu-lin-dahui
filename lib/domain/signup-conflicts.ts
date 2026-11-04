import {guestNameKey} from './guest-names';

type Person={id:string;name:string;guestEventId?:string;guest?:boolean;guestFriendId?:string};
type Signup={eventId:string;playerId:string;status:string;arrival:number;departure:number;bookingSignups?:{status:string;arrival:number;departure:number}[]};
export const duplicateSignupMessage='这位球友已接龙该时段，请先取消原接龙；修改请从原接龙进入';

/** Compare actual participation intervals, including waitlists and pending cancellations. A guest's nickname or
 * merged identity must not create a second place alongside their existing guest or member signup. */
export function hasSignupOverlap(s:{players:Person[];registrations:Signup[]},eventId:string,person:Person,arrival:number,departure:number,exceptPlayerId?:string){
 const key=guestNameKey(person.name),guest=!!(person.guestEventId||person.guest);
 const ids=new Set(s.players.filter(p=>p.id!==exceptPlayerId&&(p.id===person.id||!!person.guestFriendId&&p.guestFriendId===person.guestFriendId||
  (guest||!!(p.guestEventId||p.guest))&&guestNameKey(p.name)===key)).map(p=>p.id));
 return s.registrations.some(r=>r.eventId===eventId&&r.status!=='cancelled'&&ids.has(r.playerId)&&
  (r.bookingSignups??[r]).some(row=>row.status!=='cancelled'&&row.arrival<departure&&row.departure>arrival));
}
