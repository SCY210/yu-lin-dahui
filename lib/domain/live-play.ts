import {matchingStopped} from './matching-participation';
import {awaitingArrival,clearFilledPointsWaiting} from './points-attendance';
import {cancelPendingScheduling} from './scheduling';
import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {eventStatusAt} from './event-lifecycle';
import {bookingAllowsPlayer,registrationSpans} from './booking-signups';
import {fixedPartnerTeams} from './fixed-partners';
import {balanceCost,compareBalance} from './match-balance';
import {genderMismatches} from './gender-balance';
import {matchHistory} from './match-history';
import {authorizeEventAction,canManageEvent} from './permissions';
import {canEnableEventRanking} from './event-ranking';
import {decorateMatch} from './play';
import {markRanked} from './all-ranked';
import {eventFormat,courtPlayers,isPractice} from './match-format';
import {fail,month,type State,type Event,type Account,type Match,type LivePlay} from './types';

const id=z.string().min(1).max(100);
const schemas={
 liveStart:z.object({eventId:id}),livePause:z.object({eventId:id,paused:z.boolean()}),
 livePreference:z.object({eventId:id,playerId:id,avoidConsecutive:z.boolean()}),
 liveReady:z.object({eventId:id,playerId:id}),
};
const playing=(m:Match)=>m.status==='playing';
const physical=(s:Pick<State,'bookings'>,e:Event,courtId:string)=>{
 const b=s.bookings.find(b=>b.id===courtId);return JSON.stringify([b?.venue??e.venue,b?.name??courtId]);
};
export function liveAppearances(s:Pick<State,'matches'>,eventId:string,playerId:string){
 return s.matches.filter(m=>m.eventId===eventId&&m.start!==null&&['playing','complete','forfeit'].includes(m.status)&&[...m.a,...m.b].includes(playerId)&&(!m.noShow?.length||m.noShow.includes(playerId))).length;
}
export function livePresentIds(s:Pick<State,'players'|'registrations'|'bookings'|'attendance'>,e:Event,now:number){
 const enabled=new Set(s.players.filter(p=>p.enabled&&!e.noShowHold?.includes(p.id)&&!matchingStopped(e,p.id)).map(p=>p.id));
 return s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed'&&!awaitingArrival(e,r.playerId)&&enabled.has(r.playerId)&&
  registrationSpans(s as State,e,r).some(span=>span.start<=now&&(span.end??e.end)>now)&&
  !s.attendance.some(at=>at.eventId===e.id&&at.playerId===r.playerId&&at.state==='paused'&&at.end===null))
  .sort((a,b)=>a.sequence-b.sequence||a.playerId.localeCompare(b.playerId)).map(r=>r.playerId);
}
export function liveResting(e:Event,playerId:string,venue?:string){
 return !!e.livePlay?.rest.some(rest=>rest.playerId===playerId&&(!venue||rest.venue===venue));
}
/** Cheap no-work guard for read maintenance; use the same physical-court identity as fillLiveCourts. */
export function hasEmptyLiveCourt(s:Pick<State,'bookings'|'matches'>,e:Event,now:number){
 const busy=new Set(s.matches.filter(m=>m.eventId===e.id&&playing(m)).map(m=>physical(s,e,m.courtId)));
 return s.bookings.some(b=>b.eventId===e.id&&b.start<=now&&b.end>now&&!busy.has(physical(s,e,b.id)));
}
function configuration(e:Event):LivePlay{
 return e.livePlay??={enabled:false,paused:false,preferences:[],completions:[],rest:[]};
}
function pair(s:State,e:Event,ids:string[],history:ReturnType<typeof matchHistory>,rating:(id:string)=>number){
 const size=eventFormat(e)==='singles'?1:2;
 const cost=(order:string[])=>{
  const a=order.slice(0,size),b=order.slice(size);
  const mean=(t:string[])=>t.reduce((n,id)=>n+rating(id),0)/size;
  return balanceCost([Math.abs(mean(a)-mean(b))],history.variety(a,b),size===2?genderMismatches(s,a,b,rating):0,history.rematches(a,b),size===2?history.cohorts(order):0);
 };
 let best=ids,bestCost=cost(ids);
 if(size===2)for(const candidate of [[ids[0],ids[2],ids[1],ids[3]],[ids[0],ids[3],ids[1],ids[2]]]){
  const next=cost(candidate);if(compareBalance(next,bestCost)<0){best=candidate;bestCost=next}
 }
 return {a:best.slice(0,size),b:best.slice(size),cost:bestCost};
}

/** The score and its replacement matches are saved in the same state transaction.
 * Attendance/court times constrain availability internally; no duration is guessed. */
export function fillLiveCourts(s:State,e:Event,now:number){
 const config=e.livePlay;
 if(e.tournament||isPractice(e)||!config?.enabled||config.paused||e.deletedAt!==undefined||['draft','ended','cancelled'].includes(e.status)||now<e.start||now>=e.end)return;
 const present=livePresentIds(s,e,now),busy=new Set(s.matches.filter(playing).flatMap(m=>[...m.a,...m.b]));
 const courts=s.bookings.filter(b=>b.eventId===e.id&&b.start<=now&&b.end>now)
  .sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 const handled=new Set<string>();
 const history=matchHistory(s,e.id,true),ratings=new Map(s.players.map(p=>[p.id,p.rating]));
 const rating=(id:string)=>ratings.get(id)??1000;
 const counts=new Map<string,number>(),lastTurns=new Map<string,number>();
 for(const m of s.matches)if(m.eventId===e.id&&m.start!==null)for(const id of [...m.a,...m.b]){
  lastTurns.set(id,Math.max(lastTurns.get(id)??0,m.start));
  if(['playing','complete','forfeit'].includes(m.status)&&(!m.noShow?.length||m.noShow.includes(id)))counts.set(id,(counts.get(id)??0)+1);
 }
 const appearances=(id:string)=>counts.get(id)??0;
 const fairOrder=(a:string,b:string)=>appearances(a)-appearances(b)||(lastTurns.get(a)??0)-(lastTurns.get(b)??0)||present.indexOf(a)-present.indexOf(b)||a.localeCompare(b);
 for(const court of courts){
  const key=physical(s,e,court.id),venue=court.venue??e.venue;
  if(handled.has(key))continue;handled.add(key);
  if(s.matches.some(m=>m.eventId===e.id&&playing(m)&&physical(s,e,m.courtId)===key))continue;
  // Bench players get the next turn before this court's just-finished players,
  // even when the latter have fewer games or started their previous game earlier.
  // Derive this from stored matches so pause/resume and concurrent retries keep the same order.
  const previous=s.matches.filter(m=>m.eventId===e.id&&m.start!==null&&!['playing','draft','published'].includes(m.status)&&physical(s,e,m.courtId)===key)
   .sort((a,b)=>(b.end??b.start!)-(a.end??a.start!)||b.start!-a.start!||a.id.localeCompare(b.id))[0];
  const justFinished=new Set(previous?[...previous.a,...previous.b]:[]);
  const order=(a:string,b:string)=>Number(justFinished.has(a))-Number(justFinished.has(b))||fairOrder(a,b);
  // Exchange equal game counts. Prefer the bench, but allow one position (one
  // complete team in fixed mode) to mix with the last court when that breaks a
  // repeated cohort. Otherwise 12 players on two courts form three permanent groups.
  const sameTurn=(a:string,b:string)=>justFinished.has(a)===justFinished.has(b)&&appearances(a)===appearances(b);
  // A court may be one game ahead of another. Permit at most that one-game
  // difference when breaking a cohort, with a two-game bound including matches
  // currently in progress. Lower-count waiting players retain queue priority.
  const canMix=(from:string,to:string)=>appearances(to)>=appearances(from)&&appearances(to)<=appearances(from)+(pool.length===courtPlayers(e)*2?1:0);
  const fairMix=(ids:string[])=>{
   const selected=new Set(ids),after=present.map(id=>appearances(id)+(selected.has(id)?1:0));
   return Math.max(...after)-Math.min(...after)<=2;
  };
  const pool=present.filter(id=>!busy.has(id)&&!liveResting(e,id,venue)&&bookingAllowsPlayer(s,e.id,court.id,id,now,now+1)).sort(order);
  let teams:{a:string[];b:string[]}|undefined;
  if(eventFormat(e)==='doubles'&&e.pointsChoice?.selectedMode==='fixed'){
   const fixed=e.pointsChoice.teams??fixedPartnerTeams(s,e);e.pointsChoice.teams=fixed;
   const candidates=fixed.filter(team=>team.length===2&&team.every(id=>pool.includes(id)))
    .sort((a,b)=>Number(a.some(id=>justFinished.has(id)))-Number(b.some(id=>justFinished.has(id)))||Math.max(...a.map(appearances))-Math.max(...b.map(appearances))||order(a[0],b[0]));
   if(candidates.length>=2){
    let chosen=candidates.slice(0,2);
    const cost=(ts:string[][])=>balanceCost([Math.abs(ts[0].reduce((n,id)=>n+rating(id),0)-ts[1].reduce((n,id)=>n+rating(id),0))/2],history.variety(ts[0],ts[1],0),genderMismatches(s,ts[0],ts[1],rating),history.rematches(ts[0],ts[1]),history.cohorts(ts.flat()));
    let bestCost=cost(chosen);
    for(let pass=0;pass<2;pass++)for(let i=0;i<2;i++)for(const candidate of candidates.slice(0,16)){
     if(chosen.includes(candidate)||chosen[i].some((id,j)=>!canMix(id,candidate[j])))continue;
     const next=[...chosen];next[i]=candidate;const nextCost=cost(next);
     const samePriority=chosen[i].every((id,j)=>sameTurn(id,candidate[j]));
     if(!samePriority&&((nextCost.cohorts>=bestCost.cohorts&&history.unmet(next.flat())<=history.unmet(chosen.flat()))||!next.some(t=>t.every(id=>!justFinished.has(id)))||!fairMix(next.flat())))continue;
     if(compareBalance(nextCost,bestCost)<0){chosen=next;bestCost=nextCost}
    }
    teams={a:chosen[0],b:chosen[1]};
   }
  }else if(pool.length>=courtPlayers(e)){
   let chosen=pair(s,e,pool.slice(0,courtPlayers(e)),history,rating);
   const minimumBench=Math.min(pool.filter(id=>!justFinished.has(id)).length,courtPlayers(e)-1);
   for(let pass=0;pass<2;pass++)for(let i=0;i<courtPlayers(e);i++)for(const candidate of pool.slice(0,16)){
    const ids=[...chosen.a,...chosen.b],replaced=ids[i];if(ids.includes(candidate)||!canMix(replaced,candidate))continue;
    ids[i]=candidate;const next=pair(s,e,ids,history,rating);
    if(!sameTurn(replaced,candidate)&&((next.cost.cohorts>=chosen.cost.cohorts&&history.unmet(ids)<=history.unmet([...chosen.a,...chosen.b]))||ids.filter(id=>!justFinished.has(id)).length<minimumBench||!fairMix(ids)))continue;
    if(compareBalance(next.cost,chosen.cost)<0)chosen=next;
   }
   teams={a:chosen.a,b:chosen.b};
  }
  if(!teams)continue;
  const participants=[...teams.a,...teams.b];participants.forEach(id=>busy.add(id));
  const sequence=1+s.matches.filter(m=>m.eventId===e.id&&m.start!==null&&m.status!=='cancelled'&&physical(s,e,m.courtId)===key).length;
  const roundId=crypto.randomUUID();
  s.rounds.push({id:roundId,eventId:e.id,start:now,duration:0,status:'playing',eligible:[...present],rest:present.filter(id=>!participants.includes(id)&&!busy.has(id)),seed:sequence,live:true,liveSequence:sequence});
  const match:Match={...teams,id:crypto.randomUUID(),eventId:e.id,roundId,courtId:court.id,status:'playing',start:now,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};
  decorateMatch(s,e,match);markRanked(match,e);s.matches.push(match);history.add(match);
  for(const id of participants){counts.set(id,appearances(id)+1);lastTurns.set(id,now)}
  clearFilledPointsWaiting(s,e);
  const season=month(now);if(!s.seasons.some(p=>p.id===season))s.seasons.push({id:season,rules:{...s.settings.rules},version:1});
 }
}

/** A requested break lasts until a later-started match at the same venue finishes.
 * With insufficient substitutes the court waits; nobody is forced to play. */
export function finishLiveMatch(s:State,e:Event,m:Match,now:number){
 if(!e.livePlay?.enabled)return;
 const config=e.livePlay,venue=s.bookings.find(b=>b.id===m.courtId)?.venue??e.venue;
 let completion=config.completions.find(c=>c.venue===venue);
 if(!completion){completion={venue,count:0};config.completions.push(completion)}completion.count++;
 config.rest=config.rest.filter(rest=>rest.venue!==venue||m.start===null||m.start<rest.after);
 for(const playerId of [...m.a,...m.b])if(config.preferences.some(p=>p.playerId===playerId&&p.avoidConsecutive)){
  config.rest=config.rest.filter(p=>p.playerId!==playerId||p.venue!==venue);
  config.rest.push({playerId,venue,after:m.end??now});
 }
 fillLiveCourts(s,e,Math.max(now,m.end??now));
}

export async function applyLivePlay(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 const p=command.payload;
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 if(['ended','cancelled','draft'].includes(eventStatusAt(e,now)))fail('请在活动开放后、结束前使用实时排场');
 if(e.tournament)fail('赛事请使用对战表安排比赛');
 if(isPractice(e))fail('练球活动不生成比赛或积分');
 const manager=canManageEvent(a,e)||canEnableEventRanking(s,a);
 if(command.action==='liveStart'||command.action==='livePause'){
  authorizeEventAction(s,a,command.action,p);
  if(!manager)fail('403: 只有活动创建者或管理员可以开始或暂停排场');
 }else{
  const p=command.payload;
  const player=s.players.find(player=>player.id===p.playerId);
  if(!player||!s.registrations.some(r=>r.eventId===e.id&&r.playerId===player.id&&r.status==='confirmed'))fail('只有正式接龙球友可以调整轮休');
  if(!manager&&player.id!==a.playerId&&player.ownerId!==a.id)fail('403: 只能调整自己或代报名朋友的轮休');
 }
 if(action==='liveStart'&&(now<e.start||now>=e.end))fail('请在活动进行时开始实时排场');
 const config=configuration(e);
 if(command.action==='liveStart'){
  cancelPendingScheduling(s,e.id);
  e.schedulingMode='live';
  config.enabled=true;config.paused=false;e.playMode='balanced';
 }else if(command.action==='livePause')config.paused=command.payload.paused;
 else if(command.action==='livePreference'){
  const p=command.payload;
  config.preferences=config.preferences.filter(pref=>pref.playerId!==p.playerId);
  config.preferences.push({playerId:p.playerId,avoidConsecutive:p.avoidConsecutive});
  if(!p.avoidConsecutive)config.rest=config.rest.filter(rest=>rest.playerId!==p.playerId);
 }else config.rest=config.rest.filter(rest=>rest.playerId!==command.payload.playerId);
 fillLiveCourts(s,e,now);
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:action==='livePreference'?'调整连续上场意愿':action==='liveReady'?'轮休后准备上场':'实时公平排场',changes:p});
 return true;
}
