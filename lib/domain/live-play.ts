import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {eventStatusAt} from './event-lifecycle';
import {bookingAllowsPlayer,registrationSpans} from './booking-signups';
import {fixedPartnerTeams} from './fixed-partners';
import {balanceCost,compareBalance} from './match-balance';
import {canManageEvent} from './permissions';
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
 return s.matches.filter(m=>m.eventId===eventId&&m.start!==null&&['playing','complete','forfeit'].includes(m.status)&&[...m.a,...m.b].includes(playerId)).length;
}
export function livePresentIds(s:Pick<State,'players'|'registrations'|'bookings'|'attendance'>,e:Event,now:number){
 const enabled=new Set(s.players.filter(p=>p.enabled).map(p=>p.id));
 return s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed'&&enabled.has(r.playerId)&&
  registrationSpans(s as State,e,r).some(span=>span.start<=now&&(span.end??e.end)>now)&&
  !s.attendance.some(at=>at.eventId===e.id&&at.playerId===r.playerId&&at.state==='paused'&&at.end===null))
  .sort((a,b)=>a.sequence-b.sequence||a.playerId.localeCompare(b.playerId)).map(r=>r.playerId);
}
export function liveResting(e:Event,playerId:string,venue?:string){
 return !!e.livePlay?.rest.some(rest=>rest.playerId===playerId&&(!venue||rest.venue===venue));
}
function configuration(e:Event):LivePlay{
 return e.livePlay??={enabled:false,paused:false,preferences:[],completions:[],rest:[]};
}
function pair(s:State,e:Event,ids:string[]){
 if(eventFormat(e)==='singles')return {a:[ids[0]],b:[ids[1]]};
 const rating=(id:string)=>s.players.find(p=>p.id===id)?.rating??1000;
 const recent=s.matches.filter(m=>m.eventId===e.id&&m.start!==null&&!['draft','cancelled'].includes(m.status));
 const cost=(order:string[])=>{
  const a=order.slice(0,2),b=order.slice(2);
  const repeats=recent.reduce((n,m)=>n+[a,b].filter(t=>[m.a,m.b].some(team=>t.every(id=>team.includes(id)))).length,0);
  return balanceCost([Math.abs((rating(a[0])+rating(a[1])-rating(b[0])-rating(b[1]))/2)],repeats);
 };
 let best=ids;
 for(const candidate of [[ids[0],ids[2],ids[1],ids[3]],[ids[0],ids[3],ids[1],ids[2]]])if(compareBalance(cost(candidate),cost(best))<0)best=candidate;
 return {a:best.slice(0,2),b:best.slice(2)};
}

/** The score and its replacement matches are saved in the same state transaction.
 * Attendance/court times constrain availability internally; no duration is guessed. */
export function fillLiveCourts(s:State,e:Event,now:number){
 const config=e.livePlay;
 if(isPractice(e)||!config?.enabled||config.paused||e.deletedAt!==undefined||['draft','ended','cancelled'].includes(e.status)||now<e.start||now>=e.end)return;
 const present=livePresentIds(s,e,now),busy=new Set(s.matches.filter(playing).flatMap(m=>[...m.a,...m.b]));
 const courts=s.bookings.filter(b=>b.eventId===e.id&&b.start<=now&&b.end>now)
  .sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 const handled=new Set<string>();
 const lastTurn=(id:string)=>Math.max(0,...s.matches.filter(m=>m.eventId===e.id&&m.start!==null&&[...m.a,...m.b].includes(id)).map(m=>m.start!));
 const fairOrder=(a:string,b:string)=>liveAppearances(s,e.id,a)-liveAppearances(s,e.id,b)||lastTurn(a)-lastTurn(b)||present.indexOf(a)-present.indexOf(b)||a.localeCompare(b);
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
  const pool=present.filter(id=>!busy.has(id)&&!liveResting(e,id,venue)&&bookingAllowsPlayer(s,e.id,court.id,id,now,now+1)).sort(order);
  let teams:{a:string[];b:string[]}|undefined;
  if(eventFormat(e)==='doubles'&&e.pointsChoice?.selectedMode==='fixed'){
   const fixed=e.pointsChoice.teams??fixedPartnerTeams(s,e);e.pointsChoice.teams=fixed;
   const candidates=fixed.filter(team=>team.length===2&&team.every(id=>pool.includes(id)))
    .sort((a,b)=>Number(a.some(id=>justFinished.has(id)))-Number(b.some(id=>justFinished.has(id)))||Math.max(...a.map(id=>liveAppearances(s,e.id,id)))-Math.max(...b.map(id=>liveAppearances(s,e.id,id)))||order(a[0],b[0]));
   if(candidates.length>=2)teams={a:candidates[0],b:candidates[1]};
  }else if(pool.length>=courtPlayers(e))teams=pair(s,e,pool.slice(0,courtPlayers(e)));
  if(!teams)continue;
  const participants=[...teams.a,...teams.b];participants.forEach(id=>busy.add(id));
  const sequence=1+s.matches.filter(m=>m.eventId===e.id&&m.start!==null&&m.status!=='cancelled'&&physical(s,e,m.courtId)===key).length;
  const roundId=crypto.randomUUID();
  s.rounds.push({id:roundId,eventId:e.id,start:now,duration:0,status:'playing',eligible:[...present],rest:present.filter(id=>!participants.includes(id)&&!busy.has(id)),seed:sequence,live:true,liveSequence:sequence});
  const match:Match={...teams,id:crypto.randomUUID(),eventId:e.id,roundId,courtId:court.id,status:'playing',start:now,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};
  decorateMatch(s,e,match);markRanked(match);s.matches.push(match);
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
 if(isPractice(e))fail('练球活动不生成比赛或积分');
 const manager=canManageEvent(a,e);
 if(command.action==='liveStart'||command.action==='livePause'){
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
  const pending=new Set(s.rounds.filter(r=>r.eventId===e.id&&['draft','published'].includes(r.status)).map(r=>r.id));
  s.rounds.filter(r=>pending.has(r.id)).forEach(r=>r.status='cancelled');
  s.matches.filter(m=>pending.has(m.roundId)).forEach(m=>m.status='cancelled');
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
