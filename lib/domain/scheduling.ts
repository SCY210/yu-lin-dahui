import type {Event,State} from './types';
export type SchedulingMode='planned'|'round'|'live';
export const schedulingLabels:Record<SchedulingMode,string>={planned:'预排赛程',round:'每轮打完再生成下一轮',live:'实时排场'};
/** Infer old activities from their actual rounds instead of treating every activity as live. */
export function schedulingMode(s:Pick<State,'rounds'>,e:Event):SchedulingMode{
 if(e.livePlay?.enabled)return 'live';
 if(e.schedulingMode)return e.schedulingMode;
 const all=s.rounds.filter(r=>r.eventId===e.id),rounds=all.filter(r=>r.status!=='cancelled');
 if(rounds.some(r=>r.pointsSlot!==undefined))return 'planned';
 if(rounds.some(r=>!r.live))return 'round';
 if(all.some(r=>r.pointsSlot!==undefined))return 'planned';
 if(all.some(r=>!r.live))return 'round';
 return 'live';
}
export function pendingSchedulingIds(s:Pick<State,'matches'>,eventId:string){return s.matches.filter(m=>m.eventId===eventId&&['draft','published'].includes(m.status)).map(m=>m.id).sort()}
/** Never delete historical records or cancel a game that has already started. */
export function cancelPendingScheduling(s:State,eventId:string){
 const ids=pendingSchedulingIds(s,eventId),pending=new Set(ids);
 for(const m of s.matches)if(pending.has(m.id))m.status='cancelled';
 for(const r of s.rounds.filter(r=>r.eventId===eventId&&['draft','published'].includes(r.status))){
  const ms=s.matches.filter(m=>m.roundId===r.id);if(ms.every(m=>m.status==='cancelled'))r.status='cancelled';
 }
 return ids;
}
