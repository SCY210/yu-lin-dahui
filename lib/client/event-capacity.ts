import type {Booking,Event,Registration} from '../domain/types';

/** Occupied signup places, not unique players: a person may book several slots. */
export function eventCapacitySummary(e:Event,allBookings:Booking[],allRegistrations:Registration[]){
 const bookings=allBookings.filter(b=>b.eventId===e.id).slice().sort((a,b)=>a.start-b.start||a.name.localeCompare(b.name,'zh-CN',{numeric:true}));
 const regs=allRegistrations.filter(r=>r.eventId===e.id),formal=regs.filter(r=>r.status==='confirmed');
 const scoped=bookings.some(b=>b.signupCapacity!==undefined)||regs.some(r=>r.bookingSignups!==undefined);
 if(!scoped||!bookings.length)return {occupied:formal.length,capacity:e.capacity,people:formal.length,slots:bookings.length,scoped:false,courts:[] as {id:string;name:string;start:number;end:number;occupied:number;capacity:number;showTime:boolean}[]};
 const courts=bookings.map(b=>{
  const people=new Set(regs.flatMap(r=>r.bookingSignups?.some(x=>x.bookingId===b.id&&x.status==='confirmed')?[r.playerId]:!r.bookingSignups&&bookings.length===1&&r.status==='confirmed'?[r.playerId]:[]));
  return {id:b.id,name:b.name,start:b.start,end:b.end,occupied:people.size,capacity:b.signupCapacity??e.capacity,showTime:bookings.some(x=>x.id!==b.id&&x.name===b.name)};
 });
 return {occupied:courts.reduce((sum,b)=>sum+b.occupied,0),capacity:courts.reduce((sum,b)=>sum+b.capacity,0),people:formal.length,slots:bookings.length,scoped:true,courts};
}
