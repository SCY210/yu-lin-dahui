'use client';
import {canManageEvent} from '../lib/domain/permissions';
import {matchingStopped,stoppedPendingMatches} from '../lib/domain/matching-participation';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {useActivityClock} from '../lib/client/use-activity-clock';
import type {Event,Player} from '../lib/domain/types';
import type {SchedulingContext} from './event-scheduling';

export default function PointsParticipation({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const now=useActivityClock(e),data=ctx.data,manager=!ctx.readOnly&&canManageEvent(data.me,e);
 const active=!ctx.readOnly&&['open','locked','live'].includes(eventStatusAt(e,now));
 const roster=data.players.filter(p=>p.enabled&&data.registrations.some(r=>r.eventId===e.id&&r.playerId===p.id&&r.status==='confirmed'));
 const own=(p:Pick<Player,'id'|'ownerId'>)=>p.id===data.me.playerId||p.ownerId===data.me.id;
 const pending=stoppedPendingMatches(data,e);
 const pendingIds=[...new Set(pending.flatMap(m=>[...m.a,...m.b]).filter(id=>matchingStopped(e,id)))];
 const row=(p:Pick<Player,'id'|'ownerId'>)=>{const stopped=matchingStopped(e,p.id),playing=data.matches.some(m=>m.eventId===e.id&&m.status==='playing'&&[...m.a,...m.b].includes(p.id));return <div className="row points-participation-row" key={p.id}><strong>{ctx.name(p.id)}</strong><span className="badge">{stopped?'本次不再上场':'继续参与排场'}</span>{stopped&&playing&&<small className="hint">本局正常结束后生效</small>}{active&&(manager||own(p))&&<button type="button" className="secondary" disabled={ctx.busy} onClick={()=>ctx.send('pointsParticipation',{eventId:e.id,playerId:p.id,playing:stopped})}>{stopped?'恢复排场':'不再上场'}</button>}</div>};
 return <section className="points-participation">
  <h3>上场意愿</h3><p className="hint">不想继续打可选“不再上场”，后续匹配会跳过你；本局和已完成比分保留，不扣分、不影响接龙与费用。随时可以恢复。</p>
  {roster.filter(own).map(row)}
  {roster.some(p=>!own(p))&&<details><summary>{manager?'管理球友上场意愿':'其他球友上场意愿'} · {roster.filter(p=>!own(p)).length} 人</summary>{roster.filter(p=>!own(p)).map(row)}</details>}
  {!!pending.length&&<p className="hint points-participation-warning" role="status">{pendingIds.map(id=>ctx.name(id)).join('、')} 已选择不再上场，仍有 {pending.length} 场预排涉及这些球友。开赛前请组织者调整阵容或重新预排；不会自动判负。</p>}
 </section>;
}
