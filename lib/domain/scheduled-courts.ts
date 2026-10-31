import {eventStatusAt} from './event-lifecycle';
import {courtPlayers,eventFormat,isPractice} from './match-format';
import {pointsWindow} from './points-window';
import {readyIds,validateRound} from './grouping';
import {isPlannedLineup,pendingMatchLineup} from './round-lineup';
import {bookingAllowsPlayer,registrationSpans} from './booking-signups';
import {fillPlannedGap,type PlannedGap} from './planned-gap';
import {livePresentIds} from './live-play';
import {markRanked} from './all-ranked';
import {clearFilledPointsWaiting} from './points-attendance';
import {liveActivityAvailable} from './live-window';
import {month,type Event,type Match,type Round,type State} from './types';

const terminal=(m:Match)=>['complete','forfeit','cancelled'].includes(m.status);
const order=(a:Round,b:Round)=>(a.pointsSlot!==undefined&&b.pointsSlot!==undefined?a.pointsSlot-b.pointsSlot:0)||a.start-b.start||a.id.localeCompare(b.id);

/** Find only the first unfinished match on each physical court. A later round
 * may overlap an earlier one, but neither a court nor a player can play twice.
 * Read-only, so unchanged polls do not clone or rewrite the club. */
export function scheduledCourtProgress(s:State,e:Event,now:number,explicit=false):{ready:Match[];expired:Match[];gap?:PlannedGap}{
 const empty={ready:[],expired:[]};
 // After the scheduled end only overtime rounds (临时加一轮) continue, and only on an explicit action such as a score,
 // never from background maintenance.
 const late=now>=e.end;
 if(e.livePlay?.enabled||e.tournament||isPractice(e)||e.deletedAt!==undefined||(late?!explicit||!liveActivityAvailable(e,now):['draft','ended','cancelled'].includes(eventStatusAt(e,now)))||now<Math.max(e.start,pointsWindow(e).start))return empty;
 const rounds=s.rounds.filter(r=>r.eventId===e.id&&!r.live&&r.status!=='cancelled');
 if(!rounds.some(r=>['published','playing'].includes(r.status)&&(!late||r.overtime)))return empty;
 // Attendance/court phases, not estimated individual match durations, control
 // the switch. An unfinished game may continue beyond its players' phase.
 const enabled=new Set(s.players.filter(p=>p.enabled).map(p=>p.id));
 const cuts=[...new Set([e.start,e.end,
  ...s.bookings.filter(b=>b.eventId===e.id).flatMap(b=>[b.start,b.end]),
  ...s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed'&&enabled.has(r.playerId)).flatMap(r=>registrationSpans(s,e,r).flatMap(a=>[a.start,a.end??e.end])),
 ])].filter(t=>t>=e.start&&t<=e.end).sort((a,b)=>a-b);
 const phases=new Map(rounds.filter(r=>isPlannedLineup(e,r)&&!r.overtime).map(r=>{
  const end=cuts.find(t=>t>r.start)??e.end,start=cuts.findLast(t=>t<=r.start)??e.start;
  return [r.id,{start,end}] as const;
 }));
 // Gap rounds are appended with stable new slot IDs, but run before later
 // attendance phases even when those phases have smaller original slot IDs.
 rounds.sort((a,b)=>(phases.get(a.id)?.start??a.start)-(phases.get(b.id)?.start??b.start)||order(a,b));
 const bookings=new Map(s.bookings.map(b=>[b.id,b])),events=new Map(s.events.map(x=>[x.id,x]));
 const court=(m:Pick<Match,'eventId'|'courtId'>)=>{const b=bookings.get(m.courtId);return b?JSON.stringify([(b.venue??events.get(m.eventId)?.venue??'').trim().toLowerCase(),b.name.trim().toLowerCase()]):m.courtId};
 const byRound=new Map<string,Match[]>(),busyPlayers=new Set<string>(),busyCourts=new Set<string>();
 for(const m of s.matches){
  if(m.eventId===e.id){const rows=byRound.get(m.roundId)??[];rows.push(m);byRound.set(m.roundId,rows)}
  if(m.status==='playing'){busyCourts.add(court(m));for(const id of [...m.a,...m.b])busyPlayers.add(id)}
 }
 const laterConfirmedPhase=Math.max(-Infinity,...rounds.filter(r=>['published','playing'].includes(r.status)&&(byRound.get(r.id)??[]).some(m=>['published','playing'].includes(m.status))).map(r=>phases.get(r.id)?.start??-Infinity));
 const blocked=new Set<string>(),finished=new Set<string>(),phaseReleased=new Set<string>(),ready:Match[]=[],expired:Match[]=[];
 for(const r of rounds)for(const m of byRound.get(r.id)??[]){
  const key=court(m),phase=phases.get(r.id);
  // In overtime a scheduled lineup that never started does not hold its court.
  if(late&&!r.overtime&&m.status==='published'&&pendingMatchLineup(m))continue;
  // Only confirmed, unstarted lineups expire. Draft confirmation, actual games
  // and recorded results retain their existing protection and scoring rules.
  // A manually edited final lineup may deliberately wait for a later arrival;
  // without a confirmed successor phase, keep it available for that adjustment.
  if(phase&&phase.end<=now&&laterConfirmedPhase>=phase.end&&['published','playing'].includes(r.status)&&m.status==='published'&&pendingMatchLineup(m)){
   expired.push(m);phaseReleased.add(key);continue;
  }
  if(blocked.has(key))continue;
  if(terminal(m)){
   // Early-entered/future-ended results do not release a court before that fact.
   if(m.end!==null&&m.end>now){blocked.add(key);continue}
   if(m.start!==null&&m.end!==null)finished.add(key);
   continue;
  }
  blocked.add(key);
  if(!['published','playing'].includes(r.status)||m.status!=='published'||!pendingMatchLineup(m)||busyCourts.has(key)||(phase&&phase.start>now)||(!finished.has(key)&&!phaseReleased.has(key)&&r.start>now))continue;
  const ids=[...m.a,...m.b],booking=bookings.get(m.courtId);
  if(ids.some(id=>busyPlayers.has(id))||!booking||(booking.end<=now&&!r.overtime))continue;
  try{validateRound(s,e.id,now,0,[m])}catch{continue}
  ready.push(m);busyCourts.add(key);ids.forEach(id=>busyPlayers.add(id));
 }
 if(!ready.length&&e.playMode!=='arena'&&!late){
  const currentStart=cuts.findLast(t=>t<=now)??e.start,currentEnd=cuts.find(t=>t>now)??e.end;
  const future=rounds.filter(r=>(phases.get(r.id)?.start??-Infinity)>now);
  const confirmedFuture=future.some(r=>['published','playing'].includes(r.status)&&(byRound.get(r.id)??[]).some(m=>m.status==='published'&&pendingMatchLineup(m)));
  const current=rounds.filter(r=>{const p=phases.get(r.id);return p&&p.start===currentStart});
  const pending=current.some(r=>(byRound.get(r.id)??[]).some(m=>pendingMatchLineup(m)));
  const played=current.some(r=>(byRound.get(r.id)??[]).some(m=>['complete','forfeit'].includes(m.status)&&m.start!==null&&m.end!==null&&m.end<=now));
  const until=Math.min(currentEnd,pointsWindow(e).end,e.end),duration=Math.min(e.pointsPlan?.roundMinutes??15,60,Math.floor((until-now)/60000));
  if(confirmedFuture&&!pending&&played&&duration>=5){
   const reserved=new Set(s.matches.filter(m=>m.end!==null&&m.end>now&&terminal(m)).map(court));
   const free=[...bookings.values()].filter(b=>b.eventId===e.id&&b.start<=now&&b.end>=now+duration*60000&&!busyCourts.has(court({eventId:e.id,courtId:b.id}))&&!reserved.has(court({eventId:e.id,courtId:b.id})));
   if(!free.length)return {ready,expired};
   const present=new Set(livePresentIds(s,e,now));
   const ids=readyIds(s,e.id,now,duration).filter(id=>present.has(id)),needed=courtPlayers(e);
   const usable=free.filter(b=>{
    const eligible=new Set(ids.filter(id=>bookingAllowsPlayer(s,e.id,b.id,id,now,now+duration*60000)));
    if(eventFormat(e)==='doubles'&&e.pointsChoice?.selectedMode==='fixed')return (e.pointsChoice.teams??[]).filter(t=>t.length===2&&t.every(id=>eligible.has(id))).length>=2;
    return eligible.size>=needed;
   });
   if(usable.length)return {ready,expired,gap:{duration,until,courtIds:usable.map(b=>b.id),futureRoundIds:future.map(r=>r.id),playerIds:ids}};
  }
 }
 return {ready,expired};
}
export function readyScheduledMatches(s:State,e:Event,now:number):Match[]{return scheduledCourtProgress(s,e,now).ready}

/** Persist the next courts in the same transaction as scoring (and recover due
 * courts on reads after arrivals/bookings change). Current-phase lineups stay intact. */
export function advanceScheduledCourts(s:State,e:Event,now:number,explicit=false){
 const {ready:matches,expired,gap}=scheduledCourtProgress(s,e,now,explicit);if(!matches.length&&!expired.length&&!gap)return false;
 const rounds=new Map(s.rounds.map(r=>[r.id,r]));
 if(expired.length){
  const affected=new Set(expired.map(m=>m.roundId));expired.forEach(m=>m.status='cancelled');
  const byRound=new Map<string,Match[]>();
  for(const m of s.matches)if(affected.has(m.roundId)){const rows=byRound.get(m.roundId)??[];rows.push(m);byRound.set(m.roundId,rows)}
  for(const id of affected){
   const r=rounds.get(id)!,rows=byRound.get(id)!;
   if(rows.every(m=>m.status==='cancelled'))r.status='cancelled';else reconcileScoredRound(s,r,now,rows);
  }
  s.audits.push({id:crypto.randomUUID(),at:now,actor:'system:points-courts',action:'pointsPhaseAdvance',reason:'参加时段已切换，跳过前一时段尚未开打的预排',changes:{eventId:e.id,matchIds:expired.map(m=>m.id)}});
 }
 for(const m of matches){
  const r=rounds.get(m.roundId)!;
  if(r.status!=='playing'){r.start=now;r.status='playing'}
  m.start=now;m.status='playing';markRanked(m,e);
 }
 if(matches.length){
  const season=month(now);if(!s.seasons.some(x=>x.id===season))s.seasons.push({id:season,rules:{...s.settings.rules},version:1});
  clearFilledPointsWaiting(s,e);
  s.audits.push({id:crypto.randomUUID(),at:now,actor:'system:points-courts',action:'pointsAutoAdvance',reason:'场地与球员空闲，自动开始已发布的下一场',changes:{eventId:e.id,matchIds:matches.map(m=>m.id)}});
 }
 const filled=gap?fillPlannedGap(s,e,now,gap):false;
 return !!matches.length||!!expired.length||filled;
}

/** Scoring one court never finishes the other courts in its round. Future
 * early scores keep their existing published state until real play starts. */
export function reconcileScoredRound(s:State,r:Round,now:number,rows?:Match[]){
 const matches=rows??s.matches.filter(m=>m.roundId===r.id);
 if(matches.length&&matches.every(terminal)){r.status='complete';return}
 if(matches.some(m=>m.status==='playing'||(m.start!==null&&m.end!==null&&m.end<=now&&['complete','forfeit'].includes(m.status))))r.status='playing';
}
