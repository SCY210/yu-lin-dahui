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
/** The way of scheduling the organiser is advised to pick (docs/SCHEDULING_MODES.md): always the planned schedule,
 * because it keeps the two sides of a game close in strength. It splits everybody playing a round into teams at once;
 * live play can only split the four players whose turn it is. In whole-evening simulations on two to four courts the
 * mean rating gap between the sides was 20-37 planned and 106-140 live with full attendance, and 41-61% of live games
 * had a gap over 100. Live play gives 3-22% more games, which the club ranks below balanced games. */
export function recommendedSchedulingMode():{mode:'planned';reason:string}{
 return {mode:'planned',reason:'预排在每轮所有上场球友里统一分队，模拟中双方修为分平均只差 20–40 分；实时排场只能在刚轮到的 4 人里分队，平均差 110–140 分，约一半的局差 100 分以上。'};
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
