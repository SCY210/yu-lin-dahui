'use client';
import {Clock,Plus,Trophy} from 'lucide-react';
import type {Event} from '../lib/domain/types';
import type {ClubData} from '../lib/contracts/club';
import {canManageEvent} from '../lib/domain/permissions';
import {signupClosesAt} from '../lib/domain/event-lifecycle';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {fmt,hm,choice,why} from './ui';
import {Avatar} from './avatar';
import FeatureGuide from './feature-guide';
import EventShare from './event-share';
import type {SchedulingContext} from './event-scheduling';
import './tournament-signup.css';

type Court=ClubData['bookings'][number];

/** A competition's signup (docs/TOURNAMENTS.md): one card for the whole competition. Entrants play when the system
 * schedules them, so nobody picks a court or a time slot; when the field is full, later entrants wait in order. The
 * organisers see the courts below, where they add and change court slots. */
export default function TournamentSignup({e,ctx,rules,courts,editCourt,bookers}:{e:Event;ctx:SchedulingContext&{openProfile?:(id:string)=>void};rules:unknown;courts:Court[];editCourt:(b?:Court)=>void;bookers:(b:Court)=>string}){
 const {data,open}=ctx,manager=canManageEvent(data.me,e),closes=signupClosesAt(e),now=useActivityClock({...e,start:closes}),closed=now>=closes;
 const regs=data.registrations.filter(r=>r.eventId===e.id&&r.status!=='cancelled').sort((a,b)=>a.sequence-b.sequence);
 const entrants=regs.filter(r=>r.status==='confirmed'),waiting=regs.filter(r=>r.status==='waitlist'),mine=regs.find(r=>r.playerId===data.me.playerId);
 const signUp=(playerId=data.me.playerId)=>open('报名参赛','register',{eventId:e.id,playerId,arrival:e.start,departure:e.end,note:''},[],undefined,'报名整场比赛，对阵和上场时间由系统安排。满员后自动候补。');
 const cancel=(playerId:string)=>open('取消报名','cancel',{eventId:e.id,playerId,reason:''},[why],undefined,'取消后名额顺延给候补。已抽签的比赛请先联系组织者。');
 // After the draw the field is fixed (lib/domain/commands.ts refuses new entries and drawn players leaving).
 const drawn=!!e.tournament&&e.tournament.phase!=='setup';
 const others=data.players.filter(p=>p.enabled&&!p.guestEventId&&!regs.some(r=>r.playerId===p.id));
 const row=(r:typeof regs[number],i:number)=>{const p=data.players.find(p=>p.id===r.playerId);return <li key={r.playerId}><button type="button" className="tournament-entrant" onClick={()=>ctx.openProfile?.(r.playerId)}><Avatar p={p??{name:ctx.name(r.playerId)}} size="signup-avatar"/><span className="tournament-entrant-index">{i+1}</span><strong>{ctx.name(r.playerId)}</strong></button>{manager&&<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>cancel(r.playerId)}>取消</button>}</li>};
 return <div className="tournament-signup">
  <section className="card tournament-signup-card">
   <div className="row"><h2><Trophy size={20}/> 比赛报名</h2><FeatureGuide rules={rules as never} topic="signup" iconOnly/></div>
   <p className="hint">{entrants.length} / {e.capacity} 人{waiting.length?' · 候补 '+waiting.length+' 人':''} · {closed?'报名已截止':'报名截止 '+fmt(closes,{month:'numeric',day:'numeric'})+' '+hm(closes)}</p>
   <div className="tournament-signup-me">
    {mine?<><span className={'badge '+(mine.status==='confirmed'?'is-confirmed':'is-waiting')}>{mine.status==='confirmed'?'已报名':'候补第 '+(waiting.findIndex(r=>r.playerId===mine.playerId)+1)+' 位'}</span>{!drawn||manager?<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>cancel(mine.playerId)}>取消报名</button>:<small className="hint">已抽签，退赛请联系组织者</small>}</>
     :drawn?<span className="hint">已抽签，报名已截止</span>:<button type="button" className="primary" disabled={ctx.busy||closed&&!manager||e.status!=='open'&&!manager} onClick={()=>signUp()}>报名参赛</button>}
    <EventShare key={e.id} event={e} clubName={data.settings.name}/>
   </div>
   {manager&&!drawn&&others.length>0&&<button type="button" className="secondary" disabled={ctx.busy} onClick={()=>open('替球友报名','register',{eventId:e.id,playerId:others[0].id,arrival:e.start,departure:e.end,note:''},[choice('playerId','球友',others.map(p=>[p.id,p.name]))],undefined,'替球友报名整场比赛。')}><Plus size={16}/>替球友报名</button>}
   {entrants.length>0&&<ol className="tournament-entrants">{entrants.map(row)}</ol>}
   {waiting.length>0&&<><h3>候补</h3><ol className="tournament-entrants is-waiting">{waiting.map(row)}</ol></>}
  </section>
  {manager&&<section className="card tournament-courts"><div className="row"><h3>比赛场地</h3><button type="button" className="secondary" onClick={()=>editCourt()}><Plus size={16}/>添加场地</button></div>
   <p className="hint">系统在这些场地上安排对阵；场地费计入报名费。</p>
   {courts.map(b=><div key={b.id} className="row small-line"><div className="grow"><strong>{b.name}</strong><small><Clock size={13}/> {hm(b.start)}–{hm(b.end)}{b.advancedBy?' · 约场 '+bookers(b):''}</small></div><button type="button" className="ghost" onClick={()=>editCourt(b)}>修改</button></div>)}
  </section>}
 </div>;
}
