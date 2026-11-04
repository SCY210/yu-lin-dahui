import type {Booking,Event,Registration} from '../domain/types';
import {bookingOccupancy} from '../domain/booking-signups';

/** Peak simultaneous signup places per court. A partially full court can still accept another time interval. */
export function eventCapacitySummary(e:Event,allBookings:Booking[],allRegistrations:Registration[]){
 const bookings=allBookings.filter(b=>b.eventId===e.id).slice().sort((a,b)=>a.start-b.start||a.name.localeCompare(b.name,'zh-CN',{numeric:true}));
 const regs=allRegistrations.filter(r=>r.eventId===e.id),formal=regs.filter(r=>r.status==='confirmed');
 const scoped=bookings.some(b=>b.signupCapacity!==undefined)||regs.some(r=>r.bookingSignups!==undefined);
 if(!scoped||!bookings.length)return {occupied:formal.length,capacity:e.capacity,people:formal.length,slots:bookings.length,scoped:false,courts:[] as {id:string;name:string;start:number;end:number;occupied:number;capacity:number;showTime:boolean}[]};
 const courts=bookings.map(b=>{
  const seen=new Set<string>(),rows=regs.flatMap(r=>{
   const row=r.bookingSignups?.find(x=>x.bookingId===b.id&&x.status==='confirmed')??(!r.bookingSignups&&bookings.length===1&&r.status==='confirmed'?r:undefined);
   if(!row||seen.has(r.playerId))return [];seen.add(r.playerId);
   return [{status:row.status,arrival:row.arrival??b.start,departure:row.departure??b.end}];
  }),load=bookingOccupancy(rows,b.start,b.end),capacity=b.signupCapacity??e.capacity;
  return {id:b.id,name:b.name,start:b.start,end:b.end,occupied:load.peak,capacity,full:load.minimum>=capacity,showTime:bookings.some(x=>x.id!==b.id&&x.name===b.name)};
 });
 return {occupied:courts.reduce((sum,b)=>sum+b.occupied,0),capacity:courts.reduce((sum,b)=>sum+b.capacity,0),full:courts.every(b=>b.full),people:formal.length,slots:bookings.length,scoped:true,courts};
}
