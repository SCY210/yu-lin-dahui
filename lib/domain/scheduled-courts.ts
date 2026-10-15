import {eventStatusAt} from './event-lifecycle';
import {isPractice} from './match-format';
import {pointsWindow} from './points-window';
import {validateRound} from './grouping';
import {pendingMatchLineup} from './round-lineup';
import {markRanked} from './all-ranked';
import {clearFilledPointsWaiting} from './points-attendance';
import {month,type Event,type Match,type Round,type State} from './types';

const terminal=(m:Match)=>['complete','forfeit','cancelled'].includes(m.status);
const order=(a:Round,b:Round)=>(a.pointsSlot!==undefined&&b.pointsSlot!==undefined?a.pointsSlot-b.pointsSlot:0)||a.start-b.start||a.id.localeCompare(b.id);

/** Find only the first unfinished match on each physical court. A later round
 * may overlap an earlier one, but neither a court nor a player can play twice.
 * Read-only, so unchanged polls do not clone or rewrite the club. */
export function readyScheduledMatches(s:State,e:Event,now:number):Match[]{
 if(e.livePlay?.enabled||e.tournament||isPractice(e)||e.deletedAt!==undefined||['draft','ended','cancelled'].includes(eventStatusAt(e,now))||now<Math.max(e.start,pointsWindow(e).start)||now>=e.end)return [];
 const rounds=s.rounds.filter(r=>r.eventId===e.id&&!r.live&&r.status!=='cancelled').sort(order);
 if(!rounds.some(r=>['published','playing'].includes(r.status)))return [];
 const bookings=new Map(s.bookings.map(b=>[b.id,b])),events=new Map(s.events.map(x=>[x.id,x]));
 const court=(m:Match)=>{const b=bookings.get(m.courtId);return b?JSON.stringify([(b.venue??events.get(m.eventId)?.venue??'').trim().toLowerCase(),b.name.trim().toLowerCase()]):m.courtId};
 const byRound=new Map<string,Match[]>(),busyPlayers=new Set<string>(),busyCourts=new Set<string>();
 for(const m of s.matches){
  if(m.eventId===e.id){const rows=byRound.get(m.roundId)??[];rows.push(m);byRound.set(m.roundId,rows)}
  if(m.status==='playing'){busyCourts.add(court(m));for(const id of [...m.a,...m.b])busyPlayers.add(id)}
 }
 const blocked=new Set<string>(),finished=new Set<string>(),ready:Match[]=[];
 for(const r of rounds)for(const m of byRound.get(r.id)??[]){
  const key=court(m);if(blocked.has(key))continue;
  if(terminal(m)){
   // Early-entered/future-ended results do not release a court before that fact.
   if(m.end!==null&&m.end>now){blocked.add(key);continue}
   if(m.start!==null&&m.end!==null)finished.add(key);
   continue;
  }
  blocked.add(key);
  if(!['published','playing'].includes(r.status)||m.status!=='published'||!pendingMatchLineup(m)||busyCourts.has(key)||(!finished.has(key)&&r.start>now))continue;
  const ids=[...m.a,...m.b],booking=bookings.get(m.courtId);
  if(ids.some(id=>busyPlayers.has(id))||!booking||booking.end<=now)continue;
  try{validateRound(s,e.id,now,0,[m])}catch{continue}
  ready.push(m);busyCourts.add(key);ids.forEach(id=>busyPlayers.add(id));
 }
 return ready;
}

/** Persist the next courts in the same transaction as scoring (and recover due
 * courts on reads after arrivals/bookings change). Published lineups stay intact. */
export function advanceScheduledCourts(s:State,e:Event,now:number){
 const matches=readyScheduledMatches(s,e,now);if(!matches.length)return false;
 const rounds=new Map(s.rounds.map(r=>[r.id,r]));
 for(const m of matches){
  const r=rounds.get(m.roundId)!;
  if(r.status!=='playing'){r.start=now;r.status='playing'}
  m.start=now;m.status='playing';markRanked(m,e);
 }
 const season=month(now);if(!s.seasons.some(x=>x.id===season))s.seasons.push({id:season,rules:{...s.settings.rules},version:1});
 clearFilledPointsWaiting(s,e);
 s.audits.push({id:crypto.randomUUID(),at:now,actor:'system:points-courts',action:'pointsAutoAdvance',reason:'场地与球员空闲，自动开始已发布的下一场',changes:{eventId:e.id,matchIds:matches.map(m=>m.id)}});
 return true;
}

/** Scoring one court never finishes the other courts in its round. Future
 * early scores keep their existing published state until real play starts. */
export function reconcileScoredRound(s:State,r:Round,now:number){
 const matches=s.matches.filter(m=>m.roundId===r.id);
 if(matches.length&&matches.every(terminal)){r.status='complete';return}
 if(matches.some(m=>m.status==='playing'||(m.start!==null&&m.end!==null&&m.end<=now&&['complete','forfeit'].includes(m.status))))r.status='playing';
}
