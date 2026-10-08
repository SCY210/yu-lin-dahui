import type {Attendance,Booking,Event,Registration,State} from './types';

export function bookingCapacity(b:Booking,e:Event){return b.signupCapacity??e.capacity}
export function promoteLegacy(s:State,e:Event,now:number){
 let room=e.capacity-s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed'&&!r.bookingSignups).length;
 for(const r of s.registrations.filter(r=>r.eventId===e.id&&r.status==='waitlist'&&!r.bookingSignups&&s.players.some(p=>p.id===r.playerId&&p.enabled)).sort((a,b)=>a.sequence-b.sequence||a.id.localeCompare(b.id))){if(room--<=0)break;r.status='confirmed';if(r.joinedAsWaitlist)r.promotedAt=now}
}
export function bookingRows(s:Pick<State,'registrations'>,bookingId:string){return s.registrations.flatMap(r=>(r.bookingSignups??[]).filter(x=>x.bookingId===bookingId&&x.status!=='cancelled').map(x=>({...x,playerId:r.playerId,id:r.id})))}
export function syncRegistration(r:Registration){
 if(!r.bookingSignups)return;
 const active=r.bookingSignups.filter(x=>x.status!=='cancelled'),confirmed=active.filter(x=>x.status==='confirmed');
 r.status=confirmed.length?'confirmed':active.length?'waitlist':'cancelled';
 r.cancelRequested=active.some(x=>x.cancelRequested);
 if(active.length){r.arrival=Math.min(...active.map(x=>x.arrival));r.departure=Math.max(...active.map(x=>x.departure))}
}
export function promoteBooking(s:State,e:Event,b:Booking,now:number){
 let room=bookingCapacity(b,e)-bookingRows(s,b.id).filter(x=>x.status==='confirmed').length;
 for(const r of s.registrations.filter(r=>r.eventId===e.id&&s.players.some(p=>p.id===r.playerId&&p.enabled)).sort((a,c)=>(a.bookingSignups?.find(x=>x.bookingId===b.id)?.sequence??0)-(c.bookingSignups?.find(x=>x.bookingId===b.id)?.sequence??0)||a.id.localeCompare(c.id))){
  const row=r.bookingSignups?.find(x=>x.bookingId===b.id);
  if(row?.status!=='waitlist')continue;if(room--<=0)break;
  row.status='confirmed';if(row.joinedAsWaitlist)row.promotedAt=now;syncRegistration(r);
 }
}
export function registrationSpans(s:State,e:Event,r:Registration,bookingId?:string):Attendance[]{
 if(r.bookingSignups){return r.bookingSignups.filter(x=>x.status==='confirmed'&&(!bookingId||x.bookingId===bookingId)).flatMap(x=>{
  const b=s.bookings.find(b=>b.id===x.bookingId&&b.eventId===e.id);if(!b)return [];
  return [{id:`automatic:${r.id}:${b.id}`,eventId:e.id,playerId:r.playerId,bookingId:b.id,start:Math.max(e.start,b.start,x.arrival,x.registeredAt,x.joinedAsWaitlist?(x.promotedAt??e.start):e.start),end:Math.min(e.end,b.end,x.departure),state:'ready' as const,source:'automatic' as const}];
 })}
 if(r.status!=='confirmed')return [];
 return [{id:`automatic:${r.id}`,eventId:e.id,playerId:r.playerId,start:Math.max(e.start,r.arrival,r.registeredAt??e.start,r.joinedAsWaitlist?(r.promotedAt??e.start):e.start),end:Math.min(e.end,r.departure),state:'ready',source:'automatic'}];
}
export function courtSpans(s:State,e:Event,b:Booking){
 const current=e.status==='cancelled'?[]:s.registrations.filter(r=>r.eventId===e.id).flatMap(r=>registrationSpans(s,e,r,b.id));
 return [...current,...s.attendance.filter(a=>a.eventId===e.id&&a.end!==null&&a.source==='automatic'&&(!a.bookingId||a.bookingId===b.id))].map(a=>({...a,start:Math.max(a.start,b.start),end:Math.min(a.end??e.end,b.end)})).filter(a=>a.end>a.start);
}
export function venueParticipation(s:State,e:Event,r:Registration){
 const spans=registrationSpans(s,e,r).map(a=>({start:a.start,end:a.end??e.end,venue:s.bookings.find(b=>b.id===a.bookingId)?.venue??e.venue})).filter(a=>a.end>a.start).sort((a,b)=>a.venue.localeCompare(b.venue)||a.start-b.start);
 const merged:typeof spans=[];
 for(const a of spans){const last=merged.at(-1);if(last&&last.venue===a.venue&&a.start<=last.end)last.end=Math.max(last.end,a.end);else merged.push({...a})}
 return merged;
}
export function bookingAllowsPlayer(s:State,eventId:string,bookingId:string,playerId:string,start:number,end:number){
 const e=s.events.find(e=>e.id===eventId),b=s.bookings.find(b=>b.id===bookingId&&b.eventId===eventId),r=s.registrations.find(r=>r.eventId===eventId&&r.playerId===playerId);
 if(!e||!b)return false;
 const venue=b.venue??e.venue;
 if(!r?.bookingSignups)return venue===e.venue&&(e.attendanceMode!=='automatic'||r?.status==='confirmed');
 if(r.status!=='confirmed')return false;
 // Signups define attendance and fee groups. Matches mix everyone present at
 // the same venue, including consecutive signup intervals on different courts.
 return venueParticipation(s,e,r).some(a=>a.venue===venue&&a.start<=start&&a.end>=end);
}
export function archiveBooking(s:State,e:Event,r:Registration,bookingId:string,now:number){
 for(const a of registrationSpans(s,e,r,bookingId)){const end=Math.min(a.end??e.end,now);if(end>a.start)s.attendance.push({...a,id:crypto.randomUUID(),end,state:'left',source:'automatic'})}
}
