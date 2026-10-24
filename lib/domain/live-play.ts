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
import {authorizeEventAction,canManageEvent,canRecordScore} from './permissions';
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
 liveNext:z.object({eventId:id,courtId:id,allowSame:z.boolean().optional()}),
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
 // Old deployed win-limit records must not lock people out after this rule is retired.
 return !!e.livePlay?.rest.some(rest=>rest.reason!=='win-limit'&&rest.playerId===playerId&&(!venue||rest.venue===venue));
}
const winners=(m:Match)=>m.status==='complete'&&m.scoreA!==null&&m.scoreB!==null&&m.scoreA!==m.scoreB?(m.scoreA>m.scoreB?m.a:m.b):[];
/** Personal wins follow the retained-player marker, not teams or simultaneous court timings.
 * A new turn from the bench starts at one; changing partners on court preserves the personal run. */
export function liveWinStreaks(s:Pick<State,'matches'|'rounds'>,e:Event){
 const rounds=new Map(s.rounds.filter(r=>r.eventId===e.id&&r.live).map(r=>[r.id,r]));
 const runs=new Map<string,number>();
 const games=s.matches.filter(m=>m.eventId===e.id&&rounds.has(m.roundId)&&m.start!==null&&['complete','forfeit'].includes(m.status)).sort((a,b)=>(a.end??a.start!)-(b.end??b.start!)||a.start!-b.start!);
 for(const m of games){const won=new Set(winners(m)),retained=new Set(rounds.get(m.roundId)!.liveRetained??[]);for(const id of [...m.a,...m.b])runs.set(id,won.has(id)?(retained.has(id)?runs.get(id)??0:0)+1:0)}
 return runs;
}
/** Cheap no-work guard for read maintenance; use the same physical-court identity as fillLiveCourts. */
export function hasEmptyLiveCourt(s:Pick<State,'bookings'|'matches'>,e:Event,now:number){
 const busy=new Set<string>(),used=new Set<string>();
 for(const m of s.matches)if(m.eventId===e.id){if(playing(m))busy.add(physical(s,e,m.courtId));else if(m.start!==null&&!['draft','published'].includes(m.status))used.add(physical(s,e,m.courtId))}
 // A court that has finished a game waits for 开始组队, so it is not work for the clock.
 return s.bookings.some(b=>b.eventId===e.id&&b.start<=now&&b.end>now&&!busy.has(physical(s,e,b.id))&&!used.has(physical(s,e,b.id)));
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

/** Courts that have not had a game yet start on their own (activity start, a court slot opening, an arrival). A court
 * that has finished a game waits until someone presses 开始组队 (liveNext, `next`), so the next game can mix the
 * retained winners with waiting players using the existing pairing algorithm. Attendance/court times
 * constrain availability internally; no duration is guessed. Returns the started matches. */
export function fillLiveCourts(s:State,e:Event,now:number,next?:{courtId?:string;allowSame?:boolean}){
 const started:Match[]=[];
 const winnerRotation=eventFormat(e)==='doubles';
 const config=e.livePlay;
 if(e.tournament||isPractice(e)||!config?.enabled||config.paused||e.deletedAt!==undefined||['draft','ended','cancelled'].includes(e.status)||now<e.start||now>=e.end)return started;
 // A manual request (liveNext for one court, or the organiser starting live play for every free court) also fills
 // courts that have already had a game.
 const target=next?.courtId?physical(s,e,next.courtId):null,manual=!!next;
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
 const liveRounds=new Set(s.rounds.filter(r=>r.eventId===e.id&&r.live).map(r=>r.id));
 const previousByCourt=new Map<string,Match>();
 for(const m of s.matches)if(m.eventId===e.id&&m.start!==null&&!['playing','draft','published'].includes(m.status)){
  const key=physical(s,e,m.courtId),old=previousByCourt.get(key);
  if(!old||(m.end??m.start)>(old.end??old.start!)||((m.end??m.start)===(old.end??old.start!)&&(m.start>old.start!||(m.start===old.start&&m.id.localeCompare(old.id)<0))))previousByCourt.set(key,m);
 }
 // A winner waiting for their own court must not be consumed as a substitute for another court.
 const reserved=new Map<string,string>();
 for(const [key,m] of previousByCourt)if(winnerRotation&&liveRounds.has(m.roundId)&&!s.matches.some(x=>x.eventId===e.id&&playing(x)&&physical(s,e,x.courtId)===key))for(const id of winners(m)){
  if((lastTurns.get(id)??0)<=m.start!&&present.includes(id)&&!busy.has(id)&&!liveResting(e,id)&&courts.some(b=>physical(s,e,b.id)===key&&bookingAllowsPlayer(s,e.id,b.id,id,now,now+1)))reserved.set(id,key);
 }
 for(const court of courts){
  const key=physical(s,e,court.id),venue=court.venue??e.venue;
  if(handled.has(key))continue;handled.add(key);
  if(target!==null&&key!==target)continue;
  if(s.matches.some(m=>m.eventId===e.id&&playing(m)&&physical(s,e,m.courtId)===key))continue;
  // Bench players get the next turn before this court's just-finished players,
  // even when the latter have fewer games or started their previous game earlier.
  // Derive this from stored matches so pause/resume and concurrent retries keep the same order.
  const previous=previousByCourt.get(key);
  if(previous&&!manual)continue;
  const justFinished=new Set(previous?[...previous.a,...previous.b]:[]);
  const won=previous&&liveRounds.has(previous.roundId)&&winnerRotation?winners(previous):[];
  const retained=new Set(won.filter(id=>reserved.get(id)===key));
  const otherCourt=(id:string)=>reserved.has(id)&&reserved.get(id)!==key;
  const order=(a:string,b:string)=>Number(otherCourt(a))-Number(otherCourt(b))||Number(!retained.has(a))-Number(!retained.has(b))||Number(justFinished.has(a))-Number(justFinished.has(b))||fairOrder(a,b);
  // Keep retained winners locked in; vary only equal-appearance bench candidates using the existing pairing cost.
  const sameTurn=(a:string,b:string)=>!retained.has(a)&&!retained.has(b)&&otherCourt(a)===otherCourt(b)&&justFinished.has(a)===justFinished.has(b)&&appearances(a)===appearances(b);
  // Retention/bench order is a preference, not an eligibility lock. When short, any available
  // player can fill the court, including recent losers or winners waiting at another idle court.
  const pool=present.filter(id=>!busy.has(id)&&!liveResting(e,id,venue)&&bookingAllowsPlayer(s,e.id,court.id,id,now,now+1)).sort(order);
  let teams:{a:string[];b:string[]}|undefined;
  if(eventFormat(e)==='doubles'&&e.pointsChoice?.selectedMode==='fixed'){
   const fixed=e.pointsChoice.teams??fixedPartnerTeams(s,e);e.pointsChoice.teams=fixed;
   const candidates=fixed.filter(team=>team.length===2&&team.every(id=>pool.includes(id)))
    .sort((a,b)=>Number(a.some(otherCourt))-Number(b.some(otherCourt))||Number(!a.some(id=>retained.has(id)))-Number(!b.some(id=>retained.has(id)))||Number(a.some(id=>justFinished.has(id)))-Number(b.some(id=>justFinished.has(id)))||Math.max(...a.map(appearances))-Math.max(...b.map(appearances))||order(a[0],b[0]));
   if(candidates.length>=2){
    let chosen=candidates.slice(0,2);
    const cost=(ts:string[][])=>balanceCost([Math.abs(ts[0].reduce((n,id)=>n+rating(id),0)-ts[1].reduce((n,id)=>n+rating(id),0))/2],history.variety(ts[0],ts[1],0),genderMismatches(s,ts[0],ts[1],rating),history.rematches(ts[0],ts[1]),history.cohorts(ts.flat()));
    let bestCost=cost(chosen);
    for(let pass=0;pass<2;pass++)for(let i=0;i<2;i++)for(const candidate of candidates.slice(0,16)){
     if(chosen.includes(candidate)||chosen[i].some((id,j)=>!sameTurn(id,candidate[j])))continue;
     const next=[...chosen];next[i]=candidate;const nextCost=cost(next);
     if(compareBalance(nextCost,bestCost)<0){chosen=next;bestCost=nextCost}
    }
    teams={a:chosen[0],b:chosen[1]};
   }
  }else if(pool.length>=courtPlayers(e)){
   let chosen=pair(s,e,pool.slice(0,courtPlayers(e)),history,rating);
   for(let pass=0;pass<2;pass++)for(let i=0;i<courtPlayers(e);i++)for(const candidate of pool.slice(0,16)){
    const ids=[...chosen.a,...chosen.b],replaced=ids[i];if(ids.includes(candidate)||!sameTurn(replaced,candidate))continue;
    ids[i]=candidate;const next=pair(s,e,ids,history,rating);
    if(compareBalance(next.cost,chosen.cost)<0)chosen=next;
   }
   teams={a:chosen.a,b:chosen.b};
  }
  if(!teams)continue;
  const participants=[...teams.a,...teams.b];
  if(!winnerRotation&&previous&&target!==null&&!next?.allowSame&&participants.every(id=>justFinished.has(id)))fail('409: 场下暂时没有可换的人，请等待其他球友或选择继续原班人马');
  participants.forEach(id=>busy.add(id));
  const sequence=1+s.matches.filter(m=>m.eventId===e.id&&m.start!==null&&m.status!=='cancelled'&&physical(s,e,m.courtId)===key).length;
  const roundId=crypto.randomUUID();
  s.rounds.push({id:roundId,eventId:e.id,start:now,duration:0,status:'playing',eligible:[...present],rest:present.filter(id=>!participants.includes(id)&&!busy.has(id)),seed:sequence,live:true,liveSequence:sequence,liveRetained:participants.filter(id=>retained.has(id))});
  const match:Match={...teams,id:crypto.randomUUID(),eventId:e.id,roundId,courtId:court.id,status:'playing',start:now,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};
  decorateMatch(s,e,match);markRanked(match,e);s.matches.push(match);history.add(match);started.push(match);
  for(const id of participants){counts.set(id,appearances(id)+1);lastTurns.set(id,now)}
  clearFilledPointsWaiting(s,e);
  const season=month(now);if(!s.seasons.some(p=>p.id===season))s.seasons.push({id:season,rules:{...s.settings.rules},version:1});
 }
 return started;
}

/** A requested break lasts until a later-started match at the same venue finishes.
 * With insufficient substitutes the court waits; nobody is forced to play. */
export function finishLiveMatch(s:State,e:Event,m:Match,now:number){
 if(!e.livePlay?.enabled)return;
 const config=e.livePlay,venue=s.bookings.find(b=>b.id===m.courtId)?.venue??e.venue;
 let completion=config.completions.find(c=>c.venue===venue);
 if(!completion){completion={venue,count:0};config.completions.push(completion)}completion.count++;
 config.rest=config.rest.filter(rest=>rest.reason!=='win-limit'&&(rest.venue!==venue||m.start===null||m.start<rest.after));
 for(const playerId of [...m.a,...m.b])if(config.preferences.some(p=>p.playerId===playerId&&p.avoidConsecutive)){
  config.rest=config.rest.filter(p=>p.playerId!==playerId||p.venue!==venue);config.rest.push({playerId,venue,after:m.end??now});
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
 if(command.action==='liveNext'){
  // Like score entry: anyone signed up for the activity, its organiser or an administrator.
  if(!manager&&!canRecordScore(s,a,e))fail('403: 只有本活动已接龙的球友、创建者或管理员可以开始组队');
  if(!e.livePlay?.enabled||e.livePlay.paused||now<e.start||now>=e.end)fail('实时排场未开启、已暂停或不在活动时间内');
  const started=fillLiveCourts(s,e,now,{courtId:command.payload.courtId,allowSame:command.payload.allowSame});
  if(!started.length)fail('这片场地正在比赛，或可上场的人数不足，暂时无法组队');
  s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'录分后开始组队',changes:{eventId:e.id,courtId:command.payload.courtId,matchIds:started.map(m=>m.id)}});
  return true;
 }
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
 fillLiveCourts(s,e,now,command.action==='liveStart'?{allowSame:true}:undefined);
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:action==='livePreference'?'调整连续上场意愿':action==='liveReady'?'轮休后准备上场':'实时公平排场',changes:p});
 return true;
}
