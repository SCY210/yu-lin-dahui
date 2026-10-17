import type {Booking,Event,Registration} from './types';

export type ContinuousCourt<T extends Booking=Booking>=T&{segments:T[]};
const normalized=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
/** The payer is a financial attribute, not the identity of a physical court. */
export function continuousCourts<T extends Booking>(e:Pick<Event,'id'|'venue'>,bookings:T[]):ContinuousCourt<T>[] {
 const groups:ContinuousCourt<T>[]=[],lastByCourt=new Map<string,ContinuousCourt<T>>();
 for(const b of bookings.filter(b=>b.eventId===e.id).slice().sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id))){
  const key=JSON.stringify([normalized(b.venue??e.venue??''),normalized(b.name)]),last=lastByCourt.get(key);
  if(last&&b.start<=last.end){last.end=Math.max(last.end,b.end);last.segments.push(b);last.signupCapacity=Math.max(last.signupCapacity??0,b.signupCapacity??0)}
  else {const group={...b,segments:[b]};groups.push(group);lastByCourt.set(key,group)}
 }
 return groups.sort((a,b)=>a.start-b.start||a.name.localeCompare(b.name,'zh-CN',{numeric:true}));
}
/** One roster entry per person, while keeping the underlying per-slot attendance and fees. */
export function continuousCourtRows(registrations:Registration[],court:ContinuousCourt){
 const ids=new Set(court.segments.map(b=>b.id));
 return registrations.filter(r=>r.eventId===court.eventId).flatMap(r=>{
  const rows=r.bookingSignups?.filter(x=>ids.has(x.bookingId)&&x.status!=='cancelled')??[];
  if(!rows.length)return [];
  const first=rows[0],confirmed=rows.filter(x=>x.status==='confirmed');
  return [{...first,id:r.id,playerId:r.playerId,bookingId:court.id,status:confirmed.length?'confirmed' as const:'waitlist' as const,
   arrival:Math.min(...rows.map(x=>x.arrival)),departure:Math.max(...rows.map(x=>x.departure)),sequence:Math.min(...rows.map(x=>x.sequence)),
   note:[...new Set(rows.map(x=>x.note).filter(Boolean))].join('；'),cancelRequested:rows.some(x=>x.cancelRequested),partlyWaiting:confirmed.length>0&&rows.some(x=>x.status==='waitlist')}];
 });
}
/** Concurrent places: a split reservation must not double a court's capacity or occupancy. */
export function continuousCourtCapacity(e:Event,court:ContinuousCourt,registrations:Registration[]){
 const segments=court.segments,points=[...new Set(segments.flatMap(b=>[b.start,b.end]))].sort((a,b)=>a-b);
 let capacity=0,occupied=0;
 for(let i=0;i<points.length-1;i++){
  const at=points[i],active=segments.filter(b=>b.start<=at&&at<b.end);
  if(!active.length)continue;capacity=Math.max(capacity,...active.map(b=>b.signupCapacity??e.capacity));
  occupied=Math.max(occupied,new Set(registrations.filter(r=>r.eventId===e.id&&r.bookingSignups?.some(x=>x.status==='confirmed'&&active.some(b=>b.id===x.bookingId))).map(r=>r.playerId)).size);
 }
 return {capacity,occupied};
}
