'use client';
import {eventRankingEnabled} from '../lib/domain/event-ranking';
import type {Event,Match} from '../lib/domain/types';
import type {CardContext} from './match-card';
import type {SchedulingContext} from './event-scheduling';
import {canManageEvent} from '../lib/domain/permissions';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {pointsWindow} from '../lib/domain/points-window';
import PointsParticipation from './points-participation';
import {choice} from './form-fields';
import './points-attendance.css';

export function MatchArrival({m,ctx}:{m:Match;ctx:CardContext}){
 const e=ctx.data.events.find(e=>e.id===m.eventId);
 const me=ctx.data.me.playerId,manager=!!e&&canManageEvent(ctx.data.me,e);
 if(!e||e.tournament||e.matchFormat==='practice'||ctx.readOnly||!(manager||[...m.a,...m.b].includes(me))||!['draft','published','playing'].includes(m.status)||m.games.length)return null;
 return <ArrivalControl e={e} m={m} ctx={ctx} candidates={[...m.a,...m.b].filter(id=>manager||id!==me)}/>;
}
function ArrivalControl({e,m,ctx,candidates}:{e:Event;m:Match;ctx:CardContext;candidates:string[]}){
 const now=useActivityClock(e);if(!['open','locked','live'].includes(eventStatusAt(e,now)))return null;
 const playing=ctx.data.matches.some(m=>m.eventId===e.id&&m.status==='playing'),round=ctx.data.rounds.find(r=>r.id===m.roundId);
 return <div className="points-match-arrival"><button type="button" className="secondary" disabled={ctx.busy||now<e.start||!playing&&!e.pointsSession?.startedAt||!!round&&round.start>now} onClick={()=>ctx.open('有人迟到，先换人打','pointsLate',{matchId:m.id,playerId:candidates[0],replacement:'player',expectedA:m.a,expectedB:m.b},[
  choice('playerId','哪位球友迟到',candidates.map(id=>[id,ctx.name(id)])),choice('replacement','重新安排方式',[['group','当前整组换下，重新安排一组'],['player','只替换迟到者，其余成员保留']])
 ],undefined,'用于人会晚点到：积分赛中的正式成员本活动首次迟到扣 1 积分，普通活动不扣分，均不扣修为；临时来宾不计积分或修为。原对局撤销，不计胜负，先换场下的人打；TA 到了以后点“已到场”恢复排场。如果人不来了或联系不上，请改用“有人不来了？”判负。')}>有人迟到？先换人打</button></div>;
}
export default function PointsAttendance({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const now=useActivityClock(e),manager=!ctx.readOnly&&canManageEvent(ctx.data.me,e),active=['open','locked','live'].includes(eventStatusAt(e,now))&&now>=e.start&&now<e.end,session=e.pointsSession;
 const own=(id:string)=>id===ctx.data.me.playerId||ctx.data.players.find(p=>p.id===id)?.ownerId===ctx.data.me.id;
 const guest=(id:string)=>{const p=ctx.data.players.find(p=>p.id===id);return !!(p?.guest||p?.guestEventId)};
 const late=session?.attendance.filter(row=>row.late)??[];
 const lifecycle=eventStatusAt(e,now),window=pointsWindow(e),due=now>=Math.max(e.start,window.start);
 const status=lifecycle==='cancelled'?'已取消':lifecycle==='draft'?'未开放':lifecycle==='ended'?'已结束':session?.startedAt||due?'进行中':'未到开赛时间';
 return <details className="card points-attendance">
  <summary className="points-attendance-summary"><strong>{eventRankingEnabled(e)?'积分赛':'普通对局'}</strong><span className="badge">{status}</span><span>上场意愿 / 到场管理</span></summary>
  <p className="hint">到活动对局时段自动开始；预排草稿确认发布后，到时自动开赛。</p>
  <PointsParticipation e={e} ctx={ctx}/>
  <p className="hint">正式报名的球友默认都已到场，不用逐个确认。有人迟到（会来）或不来了，同场球友或组织者在对应对局上报告：迟到先换人打，积分赛中的正式成员本活动扣 1 积分，普通活动不扣分；不来了判本局负。临时来宾不计积分或修为。</p>
  {late.length>0&&<div className="points-late-list">{late.map(row=><div className="row" key={row.playerId}><strong>{ctx.name(row.playerId)} · {guest(row.playerId)?'来宾迟到（不计积分）':eventRankingEnabled(e)?'迟到 −1 分':'迟到（不扣分）'}</strong><span>{row.available?'已到场':'暂不排场'}</span>{active&&(manager||own(row.playerId))&&<div className="actions">{!row.available&&<button type="button" className="secondary" disabled={ctx.busy} onClick={()=>ctx.send('pointsPresence',{eventId:e.id,playerId:row.playerId,status:'arrived'})}>已到场，恢复排场</button>}{manager&&<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>ctx.open('撤销误标迟到','pointsPresence',{eventId:e.id,playerId:row.playerId,status:'clear-late'},[],undefined,'撤销迟到标记并恢复可排场状态；积分赛中的正式成员返还本次扣除的 1 积分，普通活动和来宾不计积分。已完成比分保持不变。')}>撤销误标</button>}</div>}</div>)}</div>}
  {(session?.waiting??[]).map(row=><div className="points-waiting" key={row.matchId}><strong>{ctx.data.bookings.find(b=>b.id===ctx.data.matches.find(m=>m.id===row.matchId)?.courtId)?.name??'场地'} · 等待补位</strong><p className="hint">场下可上场人数不足，原对局已撤销且不计胜负。人员准备好后可重新补排。</p>{manager&&active&&<button type="button" className="secondary" disabled={ctx.busy} onClick={()=>ctx.open('重新补排','pointsReplace',{eventId:e.id,matchId:row.matchId,replacement:row.replacement},[choice('replacement','补排方式',[['group','重新安排整组'],['player','只替换迟到者']])],undefined,'重新检查同球馆可上场的成员及其他场地占用。不会再次扣分。')}>重新补排</button>}</div>)}
 </details>;
}
