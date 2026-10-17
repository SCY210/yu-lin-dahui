import type {Booking,Handover} from './types';

/** One court booked by members in turn (docs/FEE_ADVANCES.md). Each member may book only two hours a day, so a longer
 * court is often booked by several people. It stays one court slot with one sign-up list; `handovers` record where the
 * next member's booking starts, and each part's court fee is repaid to its own booker. */
export type BookingPart={start:number;end:number;advancedBy?:string};
type Timed=Pick<Booking,'start'|'end'|'advancedBy'|'handovers'>;

const inside=(b:Timed)=>(b.handovers??[]).filter(h=>h.at>b.start&&h.at<b.end).sort((x,y)=>x.at-y.at);
/** The parts of a court slot and who booked each, in time order. A slot without handovers is one part. */
export function bookingParts(b:Timed):BookingPart[]{
 const parts:BookingPart[]=[];let start=b.start,advancedBy=b.advancedBy;
 for(const h of inside(b)){if(h.at>start)parts.push({start,end:h.at,advancedBy});start=h.at;advancedBy=h.advancedBy}
 parts.push({start,end:b.end,advancedBy});
 return parts;
}
/** Who booked the court at time t. */
export function advancerAt(b:Timed,t:number){let by=b.advancedBy;for(const h of inside(b))if(h.at<=t)by=h.advancedBy;return by}
/** Every member who booked a part of this slot. */
export function bookingAdvancers(b:Timed){return bookingParts(b).map(p=>p.advancedBy)}
/** Rebuild the handovers from parts, dropping a handover to the member who already booked the part before it. */
function setParts(b:Timed,parts:BookingPart[]){
 b.advancedBy=parts[0].advancedBy;
 const handovers:Handover[]=[];let last=parts[0].advancedBy;
 for(const p of parts.slice(1)){if(p.advancedBy&&p.advancedBy!==last)handovers.push({at:p.start,advancedBy:p.advancedBy});last=p.advancedBy}
 if(handovers.length)b.handovers=handovers;else delete b.handovers;
}
/** New start and end of a slot: handovers outside it are dropped, and the part covering the new start keeps its booker. */
export function retimeBooking(b:Timed,start:number,end:number){
 const first=advancerAt(b,start),kept=inside(b).filter(h=>h.at>start&&h.at<end);
 b.start=start;b.end=end;b.advancedBy=first;
 if(kept.length)b.handovers=kept;else delete b.handovers;
}
/** Correct who booked the part that starts at `at`. */
export function setPartAdvancer(b:Timed,at:number,advancedBy:string){
 const parts=bookingParts(b),part=parts.find(p=>p.start===at);if(!part)return false;
 part.advancedBy=advancedBy;setParts(b,parts);return true;
}
/** Whether slot `next` continues `b` on the same court without a gap, so they are shown and signed up as one slot. */
export function continuesCourt(b:Pick<Booking,'name'|'venue'|'end'|'pricing'|'cents'|'bearer'>,next:Pick<Booking,'name'|'venue'|'start'|'pricing'|'cents'|'bearer'>,venue:string){
 return b.name.trim()===next.name.trim()&&(b.venue??venue)===(next.venue??venue)&&b.end===next.start&&b.pricing==='hourly'&&next.pricing==='hourly'&&b.cents===next.cents&&(b.bearer??'members')===(next.bearer??'members');
}
/** Joins slots of one court that follow each other into one slot whose later bookers become handovers. Slots with a
 * gap, another court or another price stay separate. */
export function mergeCourtSlots<T extends Omit<Booking,'id'|'eventId'>>(rows:T[],venue:string):(T&Pick<Booking,'handovers'>)[]{
 const merged:(T&Pick<Booking,'handovers'>)[]=[];
 for(const row of [...rows].sort((a,b)=>a.start-b.start)){
  const before=merged.find(b=>continuesCourt(b,row,venue));
  if(!before){merged.push({...row});continue}
  setParts(before,[...bookingParts(before),...bookingParts(row)]);before.end=row.end;
 }
 return rows.map(r=>merged.find(m=>m.start<=r.start&&m.end>=r.end&&m.name.trim()===r.name.trim()&&(m.venue??venue)===(r.venue??venue))!).filter((m,i,list)=>list.indexOf(m)===i);
}
