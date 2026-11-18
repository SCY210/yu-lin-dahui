'use client';
import {Check,Moon} from 'lucide-react';
import {canManageParticipation} from '../lib/domain/permissions';
import {matchingStopped,stoppedPendingMatches} from '../lib/domain/matching-participation';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {useActivityClock} from '../lib/client/use-activity-clock';
import type {Event,Player} from '../lib/domain/types';
import type {SchedulingContext} from './event-scheduling';
import './points-participation.css';

/** 上场意愿, above 锁组 on the rounds tab: everyone confirmed as a chip. Members tap their own chip (and their signed-up
 * friends'); 宗主, 副宗主, 长老 and the organiser tap anyone's, switches between still playing and 本次不再上场; later
 * scheduling skips those who stopped, the current game and finished scores stay, nothing is deducted. */
export default function PointsParticipation({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const now=useActivityClock(e),data=ctx.data,manager=!ctx.readOnly&&canManageParticipation(data.me,e);
 const active=!ctx.readOnly&&['open','locked','live'].includes(eventStatusAt(e,now));
 const roster=data.players.filter(p=>p.enabled&&data.registrations.some(r=>r.eventId===e.id&&r.playerId===p.id&&r.status==='confirmed'));
 const own=(p:Pick<Player,'id'|'ownerId'>)=>p.id===data.me.playerId||p.ownerId===data.me.id;
 const stoppedCount=roster.filter(p=>matchingStopped(e,p.id)).length;
 if(!roster.length||(!active&&!stoppedCount))return null;
 const pending=stoppedPendingMatches(data,e);
 const pendingIds=[...new Set(pending.flatMap(m=>[...m.a,...m.b]).filter(id=>matchingStopped(e,id)))];
 // One's own players first, then the rest; the roster order otherwise.
 const ordered=[...roster.filter(own),...roster.filter(p=>!own(p))];
 const chip=(p:Pick<Player,'id'|'ownerId'>)=>{
  const stopped=matchingStopped(e,p.id),playing=data.matches.some(m=>m.eventId===e.id&&m.status==='playing'&&[...m.a,...m.b].includes(p.id));
  const label=ctx.name(p.id)+(p.id===data.me.playerId?'（我）':'');
  const state=stopped?(playing&&active?'本局后歇战':'本次不再上场'):'继续上场';
  const content=<>{stopped?<Moon size={14} aria-hidden="true"/>:<Check size={14} aria-hidden="true"/>}<span>{label}</span></>;
  const className='participation-chip'+(stopped?' is-stopped':'')+(own(p)?' is-own':'');
  return active&&(manager||own(p))
   ?<button type="button" key={p.id} className={className} aria-pressed={!stopped} title={state+'，点按'+(stopped?'恢复排场':'改为不再上场')} aria-label={label+'：'+state+'，点按'+(stopped?'恢复排场':'改为不再上场')} disabled={ctx.busy} onClick={()=>ctx.send('pointsParticipation',{eventId:e.id,playerId:p.id,playing:stopped})}>{content}</button>
   :<span key={p.id} className={className} title={state} aria-label={label+'：'+state}>{content}</span>;
 };
 return <section className="card points-participation" aria-label="上场意愿">
  <header><h3>上场意愿</h3><span className="participation-count">{roster.length-stoppedCount} 人在排{stoppedCount?' · '+stoppedCount+' 人歇战':''}</span></header>
  <div className="participation-chips">{ordered.map(chip)}</div>
  {active&&<p className="hint">{manager?'点名字切换':'点自己的名字切换'}：不再上场的人后续排场会跳过，本局和已完成比分保留，不扣分，随时可以恢复。</p>}
  {!!pending.length&&<p className="hint points-participation-warning" role="status">{pendingIds.map(id=>ctx.name(id)).join('、')} 已选择不再上场，仍有 {pending.length} 场预排涉及这些球友。开赛前请组织者调整阵容或重新预排；不会自动判负。</p>}
 </section>;
}
