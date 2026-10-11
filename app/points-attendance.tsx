'use client';
import type {Event,Match} from '../lib/domain/types';
import type {CardContext} from './match-card';
import type {SchedulingContext} from './event-scheduling';
import {canManageEvent} from '../lib/domain/permissions';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {pendingSchedulingIds,schedulingMode} from '../lib/domain/scheduling';
import {choice} from './form-fields';
import Disclosure from './disclosure';
import './points-attendance.css';

export function MatchArrival({m,ctx}:{m:Match;ctx:CardContext}){
 const e=ctx.data.events.find(e=>e.id===m.eventId);
 if(!e||e.tournament||e.matchFormat==='practice'||ctx.readOnly||!canManageEvent(ctx.data.me,e)||!['draft','published','playing'].includes(m.status)||m.games.length)return null;
 return <ArrivalControl e={e} m={m} ctx={ctx}/>;
}
function ArrivalControl({e,m,ctx}:{e:Event;m:Match;ctx:CardContext}){
 const now=useActivityClock(e);if(!['open','locked','live'].includes(eventStatusAt(e,now)))return null;
 const playing=ctx.data.matches.some(m=>m.eventId===e.id&&m.status==='playing'),round=ctx.data.rounds.find(r=>r.id===m.roundId);
 return <div className="points-match-arrival"><button type="button" className="secondary" disabled={ctx.busy||now<e.start||!playing&&!e.pointsSession?.startedAt||!!round&&round.start>now} onClick={()=>ctx.open('标记迟到并重新排场','pointsLate',{matchId:m.id,playerId:m.a[0],replacement:'player',expectedA:m.a,expectedB:m.b},[
  choice('playerId','哪位球友迟到',[...m.a,...m.b].map(id=>[id,ctx.name(id)])),choice('replacement','重新安排方式',[['group','当前整组换下，重新安排一组'],['player','只替换迟到者，其余成员保留']])
 ],undefined,'本活动首次标记迟到扣 1 积分，不扣修为。原对局撤销，不计胜负；按场地、参加时段和轮休规则补位。场下人数不足时场地等待，不会伪造比分。固定搭档如选择单人替补，仅临时调整这一局。')}>到场确认 / 标记迟到换人</button></div>;
}
export default function PointsAttendance({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const now=useActivityClock(e),manager=!ctx.readOnly&&canManageEvent(ctx.data.me,e),active=['open','locked','live'].includes(eventStatusAt(e,now))&&now>=e.start&&now<e.end,session=e.pointsSession;
 const regs=ctx.data.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed'),late=session?.attendance.filter(row=>row.late)??[];
 return <section className="card points-attendance">
  <div className="row"><h2>积分赛</h2><span className="badge">{session?.startedAt?'已开始':'待开始'}</span></div>
  {manager&&!session?.startedAt&&<button type="button" className="primary" disabled={ctx.busy||!active} onClick={()=>ctx.open('开始积分赛','pointsStart',{eventId:e.id,expectedMode:schedulingMode(ctx.data,e),expectedPendingIds:pendingSchedulingIds(ctx.data,e.id)},[],undefined,'按当前排场方式开始：预排赛程直接发布并开始首轮；逐轮模式生成或开始当前轮；实时模式开始自动排场。时间自动记录，已有当前对局会保留。')}>开始积分赛</button>}
  <p className="hint">由创建者或管理员确认到场。每人每次活动迟到扣 1 积分，只影响本活动单打或双打对应榜单。迟到者到场前跳过，恢复到场后可重新安排。</p>
  {late.length>0&&<div className="points-late-list">{late.map(row=><div className="row" key={row.playerId}><strong>{ctx.name(row.playerId)} · 迟到 −1 分</strong><span>{row.available?'已到场':'暂不排场'}</span>{manager&&active&&<div className="actions">{!row.available&&<button type="button" className="secondary" disabled={ctx.busy} onClick={()=>ctx.send('pointsPresence',{eventId:e.id,playerId:row.playerId,status:'arrived'})}>已到场，恢复排场</button>}<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>ctx.open('撤销误标迟到','pointsPresence',{eventId:e.id,playerId:row.playerId,status:'clear-late'},[],undefined,'返还这次迟到扣除的 1 积分，并恢复可排场状态。已完成比分保持不变。')}>撤销误标</button></div>}</div>)}</div>}
  {(session?.waiting??[]).map(row=><div className="points-waiting" key={row.matchId}><strong>{ctx.data.bookings.find(b=>b.id===ctx.data.matches.find(m=>m.id===row.matchId)?.courtId)?.name??'场地'} · 等待补位</strong><p className="hint">场下可上场人数不足，原对局已撤销且不计胜负。人员准备好后可重新补排。</p>{manager&&active&&<button type="button" className="secondary" disabled={ctx.busy} onClick={()=>ctx.open('重新补排','pointsReplace',{eventId:e.id,matchId:row.matchId,replacement:row.replacement},[choice('replacement','补排方式',[['group','重新安排整组'],['player','只替换迟到者']])],undefined,'重新检查同球馆可上场的成员及其他场地占用。不会再次扣分。')}>重新补排</button>}</div>)}
  {manager&&<Disclosure label={'到场名单 · '+regs.length+'人'}><div className="points-roster">{regs.map(r=>{const row=session?.attendance.find(row=>row.playerId===r.playerId);return <div className="row" key={r.playerId}><span>{ctx.name(r.playerId)}</span><span className="muted">{row?.late?'迟到':row?'准时到场':'未确认'}</span>{!row?.late&&active&&<button type="button" className="ghost" disabled={ctx.busy||!!row} onClick={()=>ctx.send('pointsPresence',{eventId:e.id,playerId:r.playerId,status:'on-time'})}>{row?'已确认':'准时到场'}</button>}</div>})}</div></Disclosure>}
 </section>;
}
