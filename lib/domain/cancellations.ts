import type {Account,Registration,State} from './types';

/** Reasons the app fills in when the member leaves the reason empty; they are not shown as a reason. */
const automaticReasons=new Set(['取消报名','申请取消报名','cancel 操作','courtCancel 操作']);

/** Store who cancelled, when and why once a registration becomes fully cancelled. */
export function recordCancellation(s:Pick<State,'players'>,r:Registration,a:Pick<Account,'id'|'playerId'>,now:number,reason?:string){
 r.cancelledAt=now;r.cancelledBy=a.id;
 r.cancelledAs=a.playerId===r.playerId?'self':s.players.find(p=>p.id===r.playerId)?.ownerId===a.id?'registrant':'organizer';
 const text=reason?.trim();if(text&&!automaticReasons.has(text))r.cancelReason=text.slice(0,200);else delete r.cancelReason;
}
export function clearCancellation(r:Registration){delete r.cancelledAt;delete r.cancelledBy;delete r.cancelReason;delete r.cancelledAs}

export type CancellationView={at?:number;by:'self'|'registrant'|'organizer'|'unknown';byName?:string;reason?:string};
/** What everyone who can see the activity sees about a cancelled signup. Older cancellations, from before the time was
 * stored, are recovered from the latest cancel audit of that player in that activity. */
export function cancellationView(s:Pick<State,'audits'|'accounts'|'players'|'bookings'|'events'>,r:Registration):CancellationView|undefined{
 if(r.status!=='cancelled')return undefined;
 let at=r.cancelledAt,actor=r.cancelledBy,reason=r.cancelReason;
 if(at===undefined){
  const bookings=new Set(s.bookings.filter(b=>b.eventId===r.eventId).map(b=>b.id));
  const audit=s.audits.filter(x=>{
   if(x.action!=='cancel'&&x.action!=='courtCancel')return false;
   const c=x.changes as {input?:Record<string,unknown>}&Record<string,unknown>|undefined,input=(c?.input??c)??{};
   return input.playerId===r.playerId&&(input.eventId===r.eventId||typeof input.bookingId==='string'&&bookings.has(input.bookingId));
  }).sort((a,b)=>b.at-a.at)[0];
  if(audit){at=audit.at;actor=audit.actor;const text=audit.reason?.trim();reason=text&&!automaticReasons.has(text)?text.slice(0,200):undefined}
 }
 const account=s.accounts.find(x=>x.id===actor),player=s.players.find(p=>p.id===r.playerId);
 const by:CancellationView['by']=r.cancelledAs??(!account?'unknown':account.playerId===r.playerId?'self':player?.ownerId===account.id?'registrant':s.events.some(e=>e.id===r.eventId&&e.creatorId===account.id)?'organizer':'unknown');
 const byName=account?s.players.find(p=>p.id===account.playerId)?.name:undefined;
 return {...(at!==undefined?{at}:{}),by,...(byName?{byName}:{}),...(reason?{reason}:{})};
}
