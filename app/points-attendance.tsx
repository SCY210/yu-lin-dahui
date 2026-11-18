'use client';
import {Clock,UserCheck} from 'lucide-react';
import {eventRankingEnabled} from '../lib/domain/event-ranking';
import type {Event,Match} from '../lib/domain/types';
import type {CardContext} from './match-card';
import type {SchedulingContext} from './event-scheduling';
import {canManageEvent} from '../lib/domain/permissions';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {choice} from './form-fields';
import './points-attendance.css';

export function MatchArrival({m,ctx}:{m:Match;ctx:CardContext}){
 const e=ctx.data.events.find(e=>e.id===m.eventId);
 // Everyone confirmed for the activity may use it, not only the players of this match (the server checks the details).
 const confirmed=!!e&&(canManageEvent(ctx.data.me,e)||ctx.data.registrations.some(r=>r.eventId===e.id&&r.playerId===ctx.data.me.playerId&&r.status==='confirmed'));
 if(!e||e.tournament||e.matchFormat==='practice'||ctx.readOnly||!confirmed||!['draft','published','playing'].includes(m.status)||m.games.length)return null;
 return <ArrivalControl e={e} m={m} ctx={ctx} candidates={[...m.a,...m.b].filter(id=>canManageEvent(ctx.data.me,e)||id!==ctx.data.me.playerId)}/>;
}
function ArrivalControl({e,m,ctx,candidates}:{e:Event;m:Match;ctx:CardContext;candidates:string[]}){
 const now=useActivityClock(e);if(!['open','locked','live'].includes(eventStatusAt(e,now)))return null;
 const playing=ctx.data.matches.some(m=>m.eventId===e.id&&m.status==='playing'),round=ctx.data.rounds.find(r=>r.id===m.roundId);
 // Before the match or the round has begun there is nobody to replace yet, so the button stays out of the way.
 if(now<e.start||!playing&&!e.pointsSession?.startedAt||!!round&&round.start>now)return null;
 return <div className="points-match-arrival"><button type="button" className="secondary" disabled={ctx.busy} onClick={()=>ctx.open('有人迟到，先换人打','pointsLate',{matchId:m.id,playerId:candidates[0],replacement:'player',expectedA:m.a,expectedB:m.b},[
  choice('playerId','哪位球友迟到',candidates.map(id=>[id,ctx.name(id)])),choice('replacement','重新安排方式',[['group','当前整组换下，重新安排一组'],['player','只替换迟到者，其余道友保留']])
 ],undefined,'用于人会晚点到：积分赛中的正式道友本活动首次迟到扣 1 积分，普通活动不扣分，均不扣修为；临时来宾不计积分或修为。原对局撤销，不计胜负，先换场下的人打；TA 到了以后点“已到场”恢复排场。如果人不来了或联系不上，请改用“有人不来了？”判负。')}>有人迟到？先换人打</button></div>;
}
function useAttendance(e:Event,ctx:SchedulingContext){
 const now=useActivityClock(e),manager=!ctx.readOnly&&canManageEvent(ctx.data.me,e),active=['open','locked','live'].includes(eventStatusAt(e,now))&&now>=e.start&&now<e.end,session=e.pointsSession;
 const own=(id:string)=>id===ctx.data.me.playerId||ctx.data.players.find(p=>p.id===id)?.ownerId===ctx.data.me.id;
 const late=session?.attendance.filter(row=>row.late)??[];
 return {manager,active,own,late,waiting:session?.waiting??[]};
}
/** Never folded, on top of the rounds tab: whoever is still missing with the button that puts them back into scheduling,
 * everyone's late record for all to see with 撤销误标 for the activity's managers (宗主, 副宗主 and the organiser), and games waiting for a
 * replacement. Nothing shows while nobody is late. */
export default function PointsAttendance({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const {manager,active,own,late,waiting}=useAttendance(e,ctx),me=ctx.data.me.playerId;
 const guest=(id:string)=>{const p=ctx.data.players.find(p=>p.id===id);return !!(p?.guest||p?.guestEventId)};
 const rows=active?late:[],missing=rows.filter(row=>!row.available);
 return <>
 {rows.length>0&&<section className="card points-arrival-alert" role="status">
  <strong><Clock size={18} aria-hidden="true"/>{!manager&&missing.some(row=>row.playerId===me)?'你被报告迟到，暂时不会排你上场':missing.length?`迟到未到场 · ${missing.length} 人`:`迟到记录 · ${rows.length} 人`}</strong>
  {missing.length>0&&<p className="hint">到了球馆就点“已到场”，马上恢复排场，按场数正常轮换上场。</p>}
  <div className="points-late-list">{rows.map(row=><div className="row" key={row.playerId}><span className="points-late-name">{ctx.name(row.playerId)} · {row.available?'已到场':'暂不排场'}{' · '+(guest(row.playerId)?'来宾不计积分':eventRankingEnabled(e)?'迟到 −1 分':'不扣分')}</span><div className="actions">{!row.available&&(manager||own(row.playerId))&&<button type="button" className="primary" disabled={ctx.busy} onClick={()=>ctx.send('pointsPresence',{eventId:e.id,playerId:row.playerId,status:'arrived'})}><UserCheck size={17} aria-hidden="true"/>{row.playerId===me?'我已到场':'已到场'}</button>}{manager&&<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>ctx.open('撤销误标迟到','pointsPresence',{eventId:e.id,playerId:row.playerId,status:'clear-late'},[],undefined,'撤销迟到标记并恢复可排场状态；积分赛中的正式道友返还本次扣除的 1 积分，普通活动和来宾不计积分。已完成比分保持不变。')}>撤销误标</button>}</div></div>)}</div>
 </section>}
 {waiting.map(row=><section className="card points-waiting" key={row.matchId} role="status"><strong>{ctx.data.bookings.find(b=>b.id===ctx.data.matches.find(m=>m.id===row.matchId)?.courtId)?.name??'场地'} · 等待补位</strong><p className="hint">场下可上场人数不足，原对局已撤销且不计胜负。人员准备好后可重新补排。</p>{manager&&active&&<button type="button" className="secondary" disabled={ctx.busy} onClick={()=>ctx.open('重新补排','pointsReplace',{eventId:e.id,matchId:row.matchId,replacement:row.replacement},[choice('replacement','补排方式',[['group','重新安排整组'],['player','只替换迟到者']])],undefined,'重新检查同球馆可上场的道友及其他场地占用。不会再次扣分。')}>重新补排</button>}</section>)}
 </>;
}
