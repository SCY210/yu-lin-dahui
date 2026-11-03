import type {Event,State} from './types';
export type SchedulingMode='planned'|'round'|'live';
export const schedulingLabels:Record<SchedulingMode,string>={planned:'预排赛程',round:'每轮打完再生成下一轮',live:'实时排场'};
/** Infer old activities from their actual rounds. An activity with no arrangement yet defaults to the planned schedule
 * (the clock plans and publishes it when the activity starts, lib/domain/points-auto-start.ts). One-round mode is
 * retired for new choices; activities already using it keep it until they end. */
export function schedulingMode(s:Pick<State,'rounds'>,e:Event):SchedulingMode{
 if(e.livePlay?.enabled)return 'live';
 if(e.schedulingMode)return e.schedulingMode;
 const all=s.rounds.filter(r=>r.eventId===e.id),rounds=all.filter(r=>r.status!=='cancelled');
 if(rounds.some(r=>r.pointsSlot!==undefined))return 'planned';
 if(rounds.some(r=>!r.live))return 'round';
 if(all.some(r=>r.pointsSlot!==undefined))return 'planned';
 if(all.some(r=>!r.live))return 'round';
 return all.length?'live':'planned';
}
/** The way of scheduling the organiser is advised to pick (docs/SCHEDULING_MODES.md). Whole-evening simulations on
 * two to four courts gave live play 3 to 22% more games (more with fewer resting players) and a shorter longest wait: a court that finishes takes
 * the next players at once instead of waiting for the next planned round, whose players may still be on another
 * court. With one court nothing waits for another court, so the planned schedule, which shows every round in advance,
 * is advised. Courts with the same venue and name count once. */
export function recommendedSchedulingMode(s:Pick<State,'bookings'>,e:Event):{mode:'planned'|'live';reason:string}{
 const courts=new Set(s.bookings.filter(b=>b.eventId===e.id).map(b=>(b.venue??e.venue).trim().toLowerCase()+'/'+b.name.trim().toLowerCase())).size;
 return courts>=2
  ?{mode:'live',reason:courts+' 片场时，一片场打完马上补人，不用等别的场；模拟整晚局数多 3–22%，人越紧差得越多，最长等待也更短。'}
  :{mode:'planned',reason:'只有一片场时不会等别的场，两种方式局数相近；预排能提前看到每一轮的名单。'};
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
