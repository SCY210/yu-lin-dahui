import {registrationSpans} from '../domain/booking-signups';
import {eventFormat} from '../domain/match-format';
import type {Booking,Event,Registration} from '../domain/types';

export type OccupancySegment={start:number;end:number;playerIds:string[];status:'empty'|'short'|'ready'};
/** Planned signup coverage, not inferred match history or financial liability. */
export function courtOccupancy(e:Event,bookings:Booking[],registrations:Registration[]){
 const courts=bookings.filter(b=>b.eventId===e.id&&b.end>b.start),rows=registrations.filter(r=>r.eventId===e.id);
 const needed=eventFormat(e)==='singles'?2:eventFormat(e)==='practice'?1:4;
 return courts.map(booking=>{
  // Reuse billing/scheduling signup boundaries, including promotion and registration times.
  const spans=e.status==='cancelled'?[]:rows.flatMap(r=>registrationSpans({bookings:courts},e,r,booking.id))
   .map(a=>({playerId:a.playerId,start:Math.max(a.start,booking.start),end:Math.min(a.end??booking.end,booking.end)})).filter(a=>a.end>a.start);
  // Sweep interval endpoints; overlapping rows of one player still count as one person.
  const endpoints=new Map<number,Map<string,number>>();
  for(const span of spans)for(const [at,delta]of [[span.start,1],[span.end,-1]]){
   let changes=endpoints.get(at);if(!changes){changes=new Map();endpoints.set(at,changes)}
   changes.set(span.playerId,(changes.get(span.playerId)??0)+delta);
  }
  const cuts=[...new Set([booking.start,booking.end,...endpoints.keys()])].sort((a,b)=>a-b),active=new Map<string,number>();
  const segments:OccupancySegment[]=[];
  for(let i=0;i<cuts.length-1;i++){
   const start=cuts[i],end=cuts[i+1];
   for(const [id,delta]of endpoints.get(start)??[]){const count=(active.get(id)??0)+delta;if(count>0)active.set(id,count);else active.delete(id)}
   const playerIds=[...active.keys()].sort(),last=segments.at(-1);
   if(last&&last.playerIds.length===playerIds.length&&last.playerIds.every((id,j)=>id===playerIds[j]))last.end=end;
   else segments.push({start,end,playerIds,status:!playerIds.length?'empty':playerIds.length<needed?'short':'ready'});
  }
  return {booking,needed,segments,emptyMs:segments.filter(s=>s.status==='empty').reduce((total,s)=>total+s.end-s.start,0)};
 });
}

export function occupancyDuration(ms:number){
 const minutes=Math.round(ms/60000),hours=Math.floor(minutes/60),rest=minutes%60;
 return hours?(hours+'小时'+(rest?rest+'分钟':'')):minutes+'分钟';
}
