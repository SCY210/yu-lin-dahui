'use client';
import {useState} from 'react';
import {Play,Check,Shuffle,CalendarDays} from 'lucide-react';
import type {ClubData} from '../lib/contracts/club';
import type {Event,Match,Round} from '../lib/domain/types';
import type {Field} from './form-fields';
import {dt,epoch,hm,labels,halfTimed,number,choice} from './form-fields';
import {ceilHalfHour} from '../lib/time-planning';
import {roundStartTime} from '../lib/client/round-start';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {canManageEvent} from '../lib/domain/permissions';
import {isPractice,eventFormat} from '../lib/domain/match-format';
import {pointsWindow} from '../lib/domain/points-window';
import {pendingSchedulingIds,schedulingMode,schedulingLabels,type SchedulingMode} from '../lib/domain/scheduling';
import EventLivePlay from './event-live-play';
import EventPointsPlan from './event-points-plan';
import MatchCard from './match-card';
import GroupPlayer from './group-player';
import Disclosure from './disclosure';
import './event-scheduling.css';
type FormOpen=(title:string,action:string,values:Record<string,unknown>,fields:Field[],convert?:(v:Record<string,unknown>)=>Record<string,unknown>,description?:string)=>void;
type Context={data:ClubData;name:(id:string)=>string;admin:boolean;busy:boolean;readOnly?:boolean;open:FormOpen;send:(action:string,payload:Record<string,unknown>)=>void;openProfile?:(id:string)=>void;setDanger:(value:{action:string;payload:Record<string,unknown>;title:string;description:string;reason:string})=>void};
const compareRounds=(a:Round,b:Round)=>a.start-b.start||(a.pointsSlot??0)-(b.pointsSlot??0)||a.id.localeCompare(b.id);
export default function EventScheduling({e,ctx}:{e:Event;ctx:Context}){
 const now=useActivityClock(e),active=!['ended','cancelled','draft'].includes(eventStatusAt(e,now)),mode=schedulingMode(ctx.data,e),manager=!ctx.readOnly&&canManageEvent(ctx.data.me,e);
 if(isPractice(e))return null;
 const change=(next:SchedulingMode)=>ctx.open('切换排场方式','schedulingMode',{eventId:e.id,mode:next,expectedMode:mode,expectedPendingIds:pendingSchedulingIds(ctx.data,e.id)},[],undefined,
  '切换为「'+schedulingLabels[next]+'」。已完成比分和正在打的对局保持不变；尚未开打的旧安排会撤销，再按新方式安排。');
 return <div className="event-scheduling"><section className="card scheduling-selector"><h2>排场方式</h2><div className="scheduling-options" role="group" aria-label="排场方式">{(['planned','round','live'] as const).map(value=><button type="button" key={value} className={mode===value?'primary':'secondary'} aria-pressed={mode===value} disabled={ctx.busy||!manager||!active||mode===value} onClick={()=>change(value)}>{schedulingLabels[value]}</button>)}</div><p className="hint">{mode==='planned'?'提前分配多轮，检查草稿后发布，再逐轮开赛、录分。':mode==='round'?'当前轮全部打完并录分后，再手动生成下一轮。':'每片场地录分后立即安排下一局，其他场地继续比赛。'}{!active?' 活动已结束或未开放，当前仅查看记录。':''}</p></section>
  {mode==='live'?<EventLivePlay e={e} ctx={ctx}/>:<EventRounds e={e} ctx={ctx} mode={mode} now={now}/>}
  {ctx.data.rounds.some(r=>r.eventId===e.id&&r.status==='cancelled')&&<Disclosure label={'已撤销轮次 · '+ctx.data.rounds.filter(r=>r.eventId===e.id&&r.status==='cancelled').length}>{ctx.data.rounds.filter(r=>r.eventId===e.id&&r.status==='cancelled').slice().sort(compareRounds).map(r=><section key={r.id}><h3>{hm(r.start)} · 已撤销</h3><div className="courts-grid">{ctx.data.matches.filter(m=>m.roundId===r.id).map(m=><MatchCard key={m.id} m={m} ctx={{...ctx,readOnly:true}}/>)}</div></section>)}</Disclosure>}
 </div>;
}
export function EventRounds({e,ctx,mode,now}:{e:Event;ctx:Context;mode:'planned'|'round';now:number}){
 const {data,name,send,busy,open,setDanger}=ctx,[selected,setSelected]=useState<{roundId:string;playerId:string}|null>(null);
 const manager=!ctx.readOnly&&canManageEvent(data.me,e),active=!['ended','cancelled','draft'].includes(eventStatusAt(e,now)),editable=manager&&active;
 const rounds=data.rounds.filter(r=>r.eventId===e.id&&r.status!=='cancelled').slice().sort(compareRounds),pending=rounds.filter(r=>['draft','published'].includes(r.status)),next=pending[0];
 const playing=data.matches.some(m=>m.eventId===e.id&&m.status==='playing'),fixed=e.pointsChoice?.selectedMode==='fixed';
 const hasStarted=data.matches.some(m=>m.eventId===e.id&&['playing','complete','forfeit'].includes(m.status));
 const remaining=Math.floor((e.end-Math.max(e.start,now))/60000),canGenerate=editable&&!busy&&!playing&&!pending.length&&remaining>=5;
 const generate=()=>open('生成下一轮','generate',{eventId:e.id,at:Math.max(e.start,now),duration:Math.min(e.pointsPlan?.roundMinutes??15,remaining,90),seed:Math.floor(Math.random()*1000000)+1},[{...number('duration','每轮预计时长 · 分钟'),min:5,max:Math.min(90,remaining)}],undefined,'生成后可交换球友、调整场地、锁定分组，再确认发布。开赛时间自动记录。');
 const arrange=()=>{const window=pointsWindow(e),at=ceilHalfHour(Math.max(e.start,now)),max=Math.min(720,Math.floor((e.end-at)/60000));open('预排剩余赛程','planPoints',{eventId:e.id,at:dt(at),pointsMinutes:Math.max(5,Math.min(max,Math.round((window.end-at)/60000))),roundMinutes:window.roundMinutes,pairing:eventFormat(e)==='singles'?'rotate':e.pointsChoice?.selectedMode??'rotate',seed:Math.floor(Math.random()*1000000)+1},[
  halfTimed('at','赛程开始'),{...number('pointsMinutes','赛程时长 · 分钟'),min:5,max},{...number('roundMinutes','每轮预计时长 · 分钟'),min:5,max:60},...(eventFormat(e)==='singles'||hasStarted?[]:[choice('pairing','搭档方式',[['rotate','每轮换搭档'],['fixed','固定搭档']])])
 ],v=>({...v,at:epoch(String(v.at))}),'按接龙参加时段和可用场地预排剩余对局，不修改已完成比分。重新预排会替换尚未开打的轮次。')};
 const swap=(r:Round,id:string)=>{if(!selected||selected.roundId!==r.id){setSelected({roundId:r.id,playerId:id});return}if(selected.playerId!==id)send('swap',{roundId:r.id,p1:selected.playerId,p2:id});setSelected(null)};
 return <>
  <section className="card scheduling-controls"><div className="row"><h2>{mode==='planned'?'预排赛程':'逐轮安排'}</h2><span className="badge">{rounds.length} 轮</span></div>{editable&&<div className="actions">{mode==='planned'?<><button type="button" className="primary" disabled={busy||playing||Math.floor((e.end-ceilHalfHour(Math.max(e.start,now)))/60000)<5} onClick={arrange}><CalendarDays size={17}/> {rounds.length?'重新预排剩余赛程':'预排赛程'}</button>{pending.some(r=>r.status==='draft')&&<button type="button" className="secondary" disabled={busy||playing} onClick={()=>send('publishPoints',{eventId:e.id})}><Check size={17}/>发布全部预排</button>}</>:<button type="button" className="primary" disabled={!canGenerate} onClick={generate}><Shuffle size={17}/>生成下一轮</button>}</div>}
   <p className="hint">{playing?'请先录完当前轮全部对局；切换排场方式不会打断当前比赛。':mode==='round'&&pending.length?'当前已有未开打轮次，请先发布、开赛或取消。':mode==='planned'?'草稿支持换人、换场和锁定；发布后按赛程顺序开始。':'每轮结束后再生成，保留公平轮休与实力平衡。'}</p>
  </section>
  {!rounds.length&&<p className="empty">{mode==='planned'?'正式接龙后即可预排赛程。':'正式接龙后可生成第一轮。'}</p>}
  {rounds.map((r,index)=>{const matches:Match[]=data.matches.filter(m=>m.roundId===r.id);return <Disclosure key={r.id+':'+r.status} defaultOpen={r.status==='playing'||r.id===next?.id} label={'第 '+(index+1)+' 轮 · '+labels[r.status]+' · '+hm(r.start)}>
   <p className="hint">{r.live?'实时对局记录':'预计 '+r.duration+' 分钟'}{r.status==='draft'&&!fixed?' · 点击两位球友旁的交换图标调整位置，也可与场下成员交换。':''}</p>
   <div className="courts-grid">{matches.map(m=><MatchCard key={m.id} m={m} ctx={ctx} interactive={editable&&r.status==='draft'&&!fixed} selected={selected?.roundId===r.id?selected.playerId:''} onSelect={id=>swap(r,id)}/>)}</div>
   <div className="rest"><strong>本轮轮休 · {r.rest.length} 人</strong><div className="actions">{r.rest.map(id=><GroupPlayer key={id} id={id} ctx={ctx} interactive={editable&&r.status==='draft'&&!fixed} selected={selected?.roundId===r.id?selected.playerId:''} onSelect={id=>swap(r,id)}/>)}</div></div>
   <Disclosure label="上场与等待机会">{r.eligible.map(id=>{const prior=rounds.filter(x=>['published','playing','complete'].includes(x.status)&&x.eligible.includes(id)),played=prior.filter(x=>data.matches.some(m=>m.roundId===x.id&&m.status!=='cancelled'&&[...m.a,...m.b].includes(id)));return <div className="row small-line" key={id}><span>{name(id)}</span><span>{played.length}/{prior.length} 轮上场</span></div>})}</Disclosure>
   {editable&&<div className="actions">{r.status==='draft'&&<button type="button" className="primary" disabled={busy} onClick={()=>send('publish',{roundId:r.id})}><Check size={17}/>确认发布</button>}{r.status==='published'&&<button type="button" className="primary" disabled={busy||playing||r.id!==next?.id||now<e.start||now<r.start} onClick={()=>send('start',{roundId:r.id,at:roundStartTime(e,r,now),monthly:true,elo:true})}><Play size={17}/>开始本轮</button>}{['draft','published'].includes(r.status)&&<button type="button" className="ghost danger" disabled={busy} onClick={()=>setDanger({action:'cancelRound',payload:{roundId:r.id},title:'取消未开始的轮次',description:'仅撤销本轮尚未开始的对局，不修改历史比分。',reason:''})}>取消本轮</button>}</div>}
  </Disclosure>})}
  <Disclosure label="搭档方式与投票"><EventPointsPlan e={e} ctx={ctx} planning/></Disclosure>
 </>;
}
