import {attendanceForEvent,usesAutomaticAttendance} from './attendance';
import {courtSpans} from './booking-signups';
import type {State,Event,Settlement} from './types';

type Result=Pick<Settlement,'eventId'|'bills'|'detail'|'total'|'subsidy'|'unallocated'|'expenseTotal'|'roundingDifference'>;
/** Equal attendance, court scope and exemptions receive exactly equal cents.
 * Keep the recorded expenses separate from the rounded split total. */
export function equalFeeAmounts(s:State,e:Event,now:number,result:Result,allocate:(n:number,w:Record<string,number>)=>Record<string,number>){
 const spans=attendanceForEvent(s,e),groups=new Map<string,string[]>();
 const intervals=(rows:{start:number;end:number|null}[])=>rows.map(a=>[Math.max(a.start,e.start),Math.min(a.end??Math.min(now,e.end),e.end,now)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const scoped=usesAutomaticAttendance(e)&&(s.registrations.some(r=>r.eventId===e.id&&r.bookingSignups)||s.attendance.some(a=>a.eventId===e.id&&a.bookingId));
 const bookings=s.bookings.filter(b=>b.eventId===e.id).sort((a,b)=>a.id.localeCompare(b.id));
 for(const bill of result.bills){
  const r=s.registrations.find(r=>r.eventId===e.id&&r.playerId===bill.playerId);
  const key=JSON.stringify([intervals(spans.filter(a=>a.playerId===bill.playerId)),scoped?bookings.map(b=>[b.id,intervals(courtSpans(s,e,b).filter(a=>a.playerId===bill.playerId))]):null,r?.courtExempt.mode??'none',r?.ballExempt.mode??'none']);
  groups.set(key,[...(groups.get(key)??[]),bill.playerId]);
 }
 const expenseTotal=result.total,types=['court','ball','other'] as const;
 for(const ids of groups.values()){
  if(ids.length<2)continue;
  const bills=result.bills.filter(b=>ids.includes(b.playerId)),n=bills.length;
  const parts=types.map(type=>{const sum=bills.reduce((a,b)=>a+b[type],0);return {type,value:Math.floor(sum/n),remainder:sum%n}});
  const target=Math.ceil(bills.reduce((sum,b)=>sum+b.total,0)/n);
  let extra=target-parts.reduce((sum,p)=>sum+p.value,0);
  for(const part of [...parts].sort((a,b)=>b.remainder-a.remainder||a.type.localeCompare(b.type)))if(extra-->0)part.value++;
  for(const part of parts){
   const indices=result.detail.map((line,i)=>line.type===part.type&&ids.some(id=>Object.hasOwn(line.shares,id))?i:-1).filter(i=>i>=0);
   const weights=Object.fromEntries(indices.map(i=>[String(i),ids.reduce((sum,id)=>sum+(result.detail[i].shares[id]??0),0)]));
   const amounts=allocate(part.value,weights);
   for(const i of indices)for(const id of ids)result.detail[i].shares[id]=amounts[String(i)]??0;
   for(const b of bills)b[part.type]=part.value;
  }
  for(const b of bills)b.total=target;
 }
 result.expenseTotal=expenseTotal;result.total=result.bills.reduce((sum,b)=>sum+b.total,0)+result.subsidy+result.unallocated;result.roundingDifference=result.total-expenseTotal;
 for(const line of result.detail)line.roundingDifference=Object.values(line.shares).reduce((sum,c)=>sum+c,0)+line.subsidy+line.unallocated-line.cents;
 return result;
}
