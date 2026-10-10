import type {Account,AwardVote,Booking,Event,Match,Registration,Round,State} from '../domain/types';
import {eventStatusAt} from '../domain/event-lifecycle';
import {canCastAwardVote} from '../domain/activity-voting';
import {homeLiveMatches} from './home-live-matches';
import {pendingOwnScores} from './score-reminder';

/** How long a finished activity stays on the home page (and keeps prompting for the MVP vote). */
export const recentlyEndedHours=5;
/** Signup reminders start this long before the deadline. */
export const signupSoonHours=24;
/** A waitlist promotion is announced on the home page for this long. */
export const promotionNoticeHours=24;
const hour=3600000;

type HomeData=Pick<State,'events'|'matches'|'rounds'|'bookings'|'registrations'|'attendance'|'awardVotes'>&{me:Account;players:{id:string;enabled:boolean}[]};
const visible=(e:Event)=>e.deletedAt===undefined&&!['draft','cancelled'].includes(e.status);
const myRegistration=(regs:Registration[],e:Event,playerId:string)=>regs.find(r=>r.eventId===e.id&&r.playerId===playerId&&r.status!=='cancelled');

export type LiveActivity={event:Event;matches:{match:Match;round:Round;court?:Booking}[];myMatch?:{match:Match;court?:Booking;partners:string[];opponents:string[]};registered:boolean};
/** One entry per running activity (not per court), with the viewer's own game if they are on court. */
export function liveActivities(data:HomeData,now:number):LiveActivity[]{
 const games=homeLiveMatches(data,now);
 return data.events.filter(e=>visible(e)&&e.start<=now&&now<e.end&&eventStatusAt(e,now)!=='ended').sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id)).map(event=>{
  const matches=games.filter(g=>g.event.id===event.id).map(({match,round,court})=>({match,round,court}));
  const mine=matches.find(g=>[...g.match.a,...g.match.b].includes(data.me.playerId));
  const side=mine?.match.a.includes(data.me.playerId)?'a':'b';
  return {event,matches,registered:!!myRegistration(data.registrations,event,data.me.playerId),
   myMatch:mine&&{match:mine.match,court:mine.court,partners:mine.match[side].filter(id=>id!==data.me.playerId),opponents:mine.match[side==='a'?'b':'a']}};
 });
}

/** "You are playing on court X", with a space where the court name meets Chinese text with a digit or Latin letter. */
export const courtLine=(court?:string)=>!court?'你正在场上比赛':'你正在'+(/^[0-9A-Za-z]/.test(court)?' ':'')+court+(/[0-9A-Za-z]$/.test(court)?' ':'')+'比赛';

export type EndedActivity={event:Event;canVote:boolean;voted:boolean};
/** Activities that ended within the last few hours; the MVP prompt shows while the viewer may still vote. */
export function recentlyEnded(data:HomeData,now:number):EndedActivity[]{
 return data.events.filter(e=>visible(e)&&e.end<=now&&now<e.end+recentlyEndedHours*hour||visible(e)&&eventStatusAt(e,now)==='ended'&&e.end>now)
  .sort((a,b)=>b.end-a.end||a.id.localeCompare(b.id)).map(event=>({event,canVote:canCastAwardVote(data,event,data.me,now),
   voted:(data.awardVotes as AwardVote[]).some(v=>v.eventId===event.id&&v.voterId===data.me.id)}));
}

export type HomeTodo={kind:'score'|'signup'|'promoted';eventId:string;title:string;detail:string;tab:'overview'|'rounds'};
/** Things the viewer should act on now, besides unpaid fees and the MVP vote (shown with their own cards). */
export function homeTodos(data:HomeData,now:number):HomeTodo[]{
 const events=new Map(data.events.map(e=>[e.id,e])),todos:HomeTodo[]=[];
 for(const m of pendingOwnScores(data,now)){const e=events.get(m.eventId);if(e)todos.push({kind:'score',eventId:e.id,title:'比分待录入',detail:e.title,tab:'rounds'})}
 for(const e of data.events){
  if(!visible(e)||e.status!=='open'||e.end<=now)continue;
  const mine=myRegistration(data.registrations,e,data.me.playerId);
  if(!mine&&e.signupDeadline>now&&e.signupDeadline-now<=signupSoonHours*hour)todos.push({kind:'signup',eventId:e.id,title:'报名即将截止',detail:e.title+' · '+Math.max(1,Math.ceil((e.signupDeadline-now)/hour))+' 小时后截止',tab:'overview'});
 }
 for(const r of data.registrations){
  const e=events.get(r.eventId);
  if(!e||!visible(e)||e.end<=now||r.playerId!==data.me.playerId||r.status!=='confirmed'||!r.promotedAt||now-r.promotedAt>promotionNoticeHours*hour)continue;
  todos.push({kind:'promoted',eventId:e.id,title:'候补转正',detail:e.title+' · 你已从候补转为正式报名',tab:'overview'});
 }
 // One line per activity and kind, scores first.
 const order={score:0,promoted:1,signup:2};
 return todos.filter((t,i)=>todos.findIndex(x=>x.kind===t.kind&&x.eventId===t.eventId)===i).sort((a,b)=>order[a.kind]-order[b.kind]);
}

export type EventGroups<E extends Event=Event>={mine:E[];open:E[];other:E[];past:E[]};
/** Activities page: upcoming activities split by the viewer's sign-up, then the rest and the history. */
export function groupEvents<E extends Event>(data:Pick<State,'registrations'>&{events:E[];me:Account},now:number):EventGroups<E>{
 const upcoming=data.events.filter(e=>e.end>=now&&!['ended','cancelled'].includes(e.status)).sort((a,b)=>a.start-b.start);
 const mine=upcoming.filter(e=>myRegistration(data.registrations,e,data.me.playerId));
 const open=upcoming.filter(e=>!mine.includes(e)&&eventStatusAt(e,now)==='open'&&e.signupDeadline>now);
 return {mine,open,other:upcoming.filter(e=>!mine.includes(e)&&!open.includes(e)),
  past:data.events.filter(e=>e.end<now||['ended','cancelled'].includes(e.status)).sort((a,b)=>b.start-a.start)};
}
