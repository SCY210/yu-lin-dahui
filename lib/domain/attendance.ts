import type {Attendance,Event,State} from './types';

export function usesAutomaticAttendance(e:Event){return e.attendanceMode==='automatic'}

// This marker is persisted once on rollout. Ended activities keep their original records.
export function enableDefaultAttendance(s:State,now:number){
 let changed=false;
 for(const e of s.events)if(e.deletedAt===undefined&&!e.attendanceMode&&!['ended','cancelled'].includes(e.status)&&e.end>now){e.attendanceMode='automatic';changed=true}
 return changed;
}

// Planned intervals are shared by grouping, voting and billing. Consumers which
// report elapsed participation must clip these intervals to their own clock.
export function attendanceForEvent(s:State,e:Event):Attendance[]{
 if(!usesAutomaticAttendance(e))return s.attendance.filter(a=>a.eventId===e.id);
 const regs=s.registrations.filter(r=>r.eventId===e.id);
 const spans:Attendance[]=regs.filter(r=>r.status==='confirmed'&&e.status!=='cancelled').map(r=>({
  id:`automatic:${e.id}:${r.playerId}`,eventId:e.id,playerId:r.playerId,
  start:Math.max(e.start,r.arrival,r.registeredAt??e.start,r.joinedAsWaitlist?(r.promotedAt??e.start):e.start),
  end:Math.min(e.end,r.departure),state:'ready',source:'automatic',
 }));
 // Cancellation archives preserve participation already incurred. Old manual
 // records remain stored, but do not override the new default for formal members.
 spans.push(...s.attendance.filter(a=>a.eventId===e.id&&a.end!==null&&(a.source==='automatic'||regs.some(r=>r.playerId===a.playerId&&r.status==='cancelled'))));
 const result:Attendance[]=[];
 for(const playerId of [...new Set(spans.map(a=>a.playerId))]){
  const rows=spans.filter(a=>a.playerId===playerId).map(a=>({...a,start:Math.max(e.start,a.start),end:Math.min(e.end,a.end??e.end)})).filter(a=>a.end>a.start).sort((a,b)=>a.start-b.start||a.end-b.end);
  const merged:Attendance[]=[];
  for(const row of rows){const last=merged.at(-1);if(last&&row.start<=last.end!){last.end=Math.max(last.end!,row.end)}else merged.push({...row,id:`automatic:${e.id}:${playerId}:${merged.length}`,state:'ready',source:'automatic'})}
  result.push(...merged);
 }
 return result;
}

// Use only on a projection clone: do not persist virtual records as actual rows.
export function applyDefaultAttendance(s:State){
 const ids=new Set(s.events.filter(e=>e.deletedAt===undefined&&usesAutomaticAttendance(e)).map(e=>e.id));
 const derived=s.events.filter(e=>e.deletedAt===undefined&&usesAutomaticAttendance(e)).flatMap(e=>attendanceForEvent(s,e));
 s.attendance=[...s.attendance.filter(a=>!ids.has(a.eventId)),...derived];
 return s;
}

export function archiveDefaultAttendance(s:State,e:Event,playerId:string,now:number){
 if(!usesAutomaticAttendance(e))return;
 for(const a of attendanceForEvent(s,e).filter(a=>a.playerId===playerId)){
  const end=Math.min(now,a.end??e.end,e.end);
  if(end>a.start)s.attendance.push({...a,id:crypto.randomUUID(),end,state:'left',source:'automatic'});
 }
}
