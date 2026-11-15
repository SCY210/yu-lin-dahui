import type {Event,State} from './types';
export type SchedulingMode='planned'|'round'|'live';
export const schedulingLabels:Record<SchedulingMode,string>={planned:'预排赛程',round:'每轮打完再生成下一轮',live:'实时排场'};
/** Physical courts of an activity: the same name at the same venue is one court. */
export function eventCourtCount(s:Pick<State,'bookings'>,e:Event){return new Set(s.bookings.filter(b=>b.eventId===e.id).map(b=>(b.venue??e.venue)+'/'+b.name)).size}
/** The way an activity is scheduled when the organiser has not chosen one (docs/SCHEDULING_MODES.md): live play on two
 * or more courts, the planned schedule on one (AGENTS.md C1). Old activities are inferred from their actual rounds. One-
 * round mode is retired for new choices; activities already using it keep it until they end. */
export function schedulingMode(s:Pick<State,'rounds'|'bookings'>,e:Event):SchedulingMode{
 if(e.livePlay?.enabled)return 'live';
 if(e.schedulingMode)return e.schedulingMode;
 const all=s.rounds.filter(r=>r.eventId===e.id),rounds=all.filter(r=>r.status!=='cancelled');
 if(rounds.some(r=>r.pointsSlot!==undefined))return 'planned';
 if(rounds.some(r=>!r.live))return 'round';
 if(all.some(r=>r.pointsSlot!==undefined))return 'planned';
 if(all.some(r=>!r.live))return 'round';
 return all.length||eventCourtCount(s,e)>=2?'live':'planned';
}
export type SchedulingAdvice={mode:'planned'|'live';reason:string;other:'planned'|'live';cases:string[]};
/** The way the organiser is advised to pick, by the number of courts (AGENTS.md C1): on one court the planned schedule,
 * which splits everybody playing a round into teams at once (simulated mean rating gap 20-37, live 106-140); on two or
 * more live play, where each court refills as soon as it finishes instead of waiting for players still on another
 * court (AGENTS.md E2). `cases` say when the other way serves better. */
export function recommendedSchedulingMode(courts:number):SchedulingAdvice{
 if(courts<=1)return {mode:'planned',other:'live',reason:'只有一片场时，预排把每轮所有上场的道友一起分队，双方强弱更接近：模拟中双方修为分平均只差 20–40 分，实时排场是 110–140 分。',
  cases:['场上只多 1 人左右轮休时：预排的下一局可能要等人，实时排场打完就补人。','有人想打一局歇一局时：「不连续上场」只在实时排场里有。']};
 return {mode:'live',other:'planned',reason:'两片场或以上时，实时排场每片场打完就补人，不用等别的场地的人下来，场地不空等。每局都由道友点「开始组队」开打。',
  cases:['想让双方强弱更接近时：预排在每轮所有上场的道友里一起分队，模拟中双方修为分平均只差 20–40 分，实时排场是 110–140 分。','人数正好排满各片场、几乎没人轮休时，预排也不会空场。']};
}
/** Whether this many players on this many courts leaves about one player resting per court, the case where planned
 * rounds leave courts idle and live scheduling fills them sooner (AGENTS.md E2). */
export function liveSchedulingFits(players:number,courts:number,perCourt:number){
 const extra=players-courts*perCourt;
 return courts>0&&extra>=1&&extra<=courts;
}
/** Whether play on a planned schedule has begun: someone pressed 开始比赛 (pointsPlay), or a game of the activity has
 * already started (an organiser started a round, a score was recorded, or the activity began before this button). Until
 * then the clock only plans and publishes; no game starts on its own (AGENTS.md C2). */
export function plannedPlayStarted(s:Pick<State,'matches'>,e:Pick<Event,'id'|'pointsSession'>){
 return e.pointsSession?.playStartedAt!==undefined||s.matches.some(m=>m.eventId===e.id&&m.start!==null);
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
