import type {Booking,Event,Registration} from '../domain/types';
import {continuousCourts,continuousCourtCapacity} from '../domain/continuous-courts';

/** Occupied signup places, not unique players: a person may book several slots. */
export function eventCapacitySummary(e:Event,allBookings:Booking[],allRegistrations:Registration[]){
 const bookings=allBookings.filter(b=>b.eventId===e.id).slice().sort((a,b)=>a.start-b.start||a.name.localeCompare(b.name,'zh-CN',{numeric:true}));
 const regs=allRegistrations.filter(r=>r.eventId===e.id),formal=regs.filter(r=>r.status==='confirmed');
 const scoped=bookings.some(b=>b.signupCapacity!==undefined)||regs.some(r=>r.bookingSignups!==undefined);
 if(!scoped||!bookings.length)return {occupied:formal.length,capacity:e.capacity,people:formal.length,slots:bookings.length,scoped:false,courts:[] as {id:string;name:string;start:number;end:number;occupied:number;capacity:number;showTime:boolean}[]};
 const groups=continuousCourts(e,bookings);
 const courts=groups.map(b=>{
  const counts=continuousCourtCapacity(e,b,regs),legacy=bookings.length===1?formal.filter(r=>!r.bookingSignups).length:0;
  return {id:b.id,name:b.name,start:b.start,end:b.end,occupied:counts.occupied+legacy,capacity:counts.capacity,showTime:groups.some(x=>x.id!==b.id&&x.name===b.name)};
 });
 return {occupied:courts.reduce((sum,b)=>sum+b.occupied,0),capacity:courts.reduce((sum,b)=>sum+b.capacity,0),people:formal.length,slots:groups.length,scoped:true,courts};
}
