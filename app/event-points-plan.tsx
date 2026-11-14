'use client';
import {useEffect,useState} from 'react';
import {canScheduleEvent} from '../lib/domain/permissions';
import {canVotePointsMode,pointsVotingOpen,pointsChoiceCounts,pointsModeLabels,type PointsMode} from '../lib/domain/points-voting';
import type {Event} from '../lib/domain/types';
import {eventFormat} from '../lib/domain/match-format';
import {Lock} from 'lucide-react';
import AppSelect from './app-select';
import './event-points-plan.css';

export default function EventPointsPlan({e,ctx,planning=false}:{e:Event;ctx:any;planning?:boolean}){
 const {data,open,send,busy,name}=ctx,[now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[e.id]);
 const manager=canScheduleEvent(data.me,e),editable=manager&&!['ended','cancelled','draft'].includes(e.status);
 const fixedIds=new Set(e.pointsChoice?.teams?.flat()??[]);
 const unmatched=e.pointsChoice?.selectedMode==='fixed'?data.registrations.filter((r:any)=>r.eventId===e.id&&r.status==='confirmed'&&!fixedIds.has(r.playerId)):[];
 const counts=pointsChoiceCounts(data,e),mine=e.pointsChoice?.votes.find(v=>v.voterId===data.me.id),canVote=canVotePointsMode(data,e,data.me,now);
 const votingOpen=pointsVotingOpen(e,now);
 const waiting=data.registrations.some((r:any)=>r.eventId===e.id&&r.playerId===data.me.playerId&&r.status==='waitlist');
 const started=data.matches.some((m:any)=>m.eventId===e.id&&['playing','complete','forfeit'].includes(m.status));
 function confirm(mode:PointsMode){open('确认搭档方式','pointsModeSelect',{eventId:e.id,mode},[],undefined,`确认「${pointsModeLabels[mode]}」并关闭投票。更换方式会取消尚未开始的分组，需要重新分配。`)}
 if(eventFormat(e)==='singles')return <section className="card event-points-plan"><h3>单打轮转</h3><p className="hint">每方一人，按上场次数和轮休意愿安排下一局；单打比分进入单打榜。</p></section>;
 return <section className="card event-points-plan" aria-label="搭档方式投票">
  <div className="row"><h3>搭档方式</h3></div>
  <h4>搭档方式投票{e.pointsChoice?.selectedMode?' · 已确认'+pointsModeLabels[e.pointsChoice.selectedMode]:''}</h4>
  <div className="points-mode-options">{(['rotate','fixed'] as const).map(mode=><div className={'points-mode-option'+(e.pointsChoice?.selectedMode===mode?' is-selected':'')} key={mode}>
   <strong>{pointsModeLabels[mode]}</strong><p className="hint">{mode==='rotate'?'把同一时段球友混合搭配，兼顾上场机会和实力平衡。':'优先将参加时间相近的人组成固定搭档；落单或搭档离场时需要轮休。'}</p><span className="points-vote-count">{counts[mode]} 票</span>
   <div className="actions"><button type="button" className={'tag-button'+(mine?.mode===mode?' active':'')} aria-pressed={mine?.mode===mode&&canVote} disabled={!canVote||busy} onClick={()=>send('pointsModeVote',{eventId:e.id,mode:mine?.mode===mode?null:mode})}>{mine?.mode===mode?'撤回投票':'投这一种'}</button>
   {editable&&!started&&e.pointsChoice?.selectedMode!==mode&&<button type="button" className="ghost" disabled={busy} onClick={()=>confirm(mode)}>确认此方式</button>}</div>
  </div>)}</div>
  <p className="hint">仅正式接龙道友每个账号一票，候补道友不能投票，可改投或撤回。未确认搭档方式时默认开放投票；投票仅供参考，创建者确认后关闭投票并按现场可上场人数安排比赛。</p>
  {editable&&!started&&now<e.start&&<button type="button" className="secondary" disabled={busy} onClick={()=>send('pointsModeVoting',{eventId:e.id,open:!votingOpen})}>{votingOpen?'关闭搭档投票':'开放搭档投票'}</button>}
  {!canVote&&<p className="hint" role="status">{waiting?'你目前是候补，转为正式接龙后才能投票。':now>=e.start?'活动已开始，搭档投票已关闭。':votingOpen?'请使用本人账号正式接龙后再投票。':e.pointsChoice?.selectedMode?'创建者已确认搭档方式，投票已关闭。':'创建者已关闭搭档投票。'}</p>}
  {planning&&e.pointsChoice?.teams&&<details><summary>查看固定搭档</summary><div className="points-fixed-teams">{e.pointsChoice.teams.map((team,i)=><p key={i}>第 {i+1} 队 · {team.map(name).join(' / ')}</p>)}</div><p className="hint">两人均在参加时段内才安排上场；人数为奇数或搭档未到场时需要轮休。</p></details>}
  <LockedPairs e={e} ctx={ctx} editable={editable&&now<e.end}/>
  {planning&&unmatched.length>0&&e.pointsChoice?.teams&&<p className="hint">未配成固定搭档：{unmatched.map((r:any)=>name(r.playerId)).join('、')}。希望每个人都轮流上场时，建议选择每轮换搭档。</p>}
 </section>;
}

/** 锁组 (docs/LOCKED_PAIRS.md): everyone sees the locked pairs; the activity's organisers lock and unlock them. */
type LockContext={data:{registrations:{eventId:string;playerId:string;status:string}[]};send:(action:string,payload:Record<string,unknown>)=>void;busy:boolean;name:(id:string)=>string};
function LockedPairs({e,ctx,editable}:{e:Event;ctx:LockContext;editable:boolean}){
 const {data,send,busy,name}=ctx,[first,setFirst]=useState(''),[second,setSecond]=useState('');
 const pairs=e.lockedPairs??[],locked=new Set(pairs.flat());
 const choices=[...new Set(data.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed').map(r=>r.playerId))].filter(id=>!locked.has(id));
 if(!pairs.length&&!editable)return null;
 function lock(){send('pairLock',{eventId:e.id,playerIds:[first,second]});setFirst('');setSecond('')}
 return <div className="locked-pairs" aria-label="锁组">
  <h4>锁组</h4>
  <p className="hint">锁组的两人都在场时，总是一起上场、同一边搭档，一人在场上或轮休时另一人等他；只来一人时照常轮换。手动换人不受限制。{e.playMode==='arena'?'擂台玩法暂不使用锁组。':''}</p>
  {pairs.length>0?<ul className="locked-pair-list">{pairs.map(([a,b])=><li key={a+':'+b}><span><Lock size={16} aria-hidden="true"/>{name(a)} + {name(b)}</span>{editable&&<button type="button" className="ghost" disabled={busy} onClick={()=>send('pairUnlock',{eventId:e.id,playerId:a})}>取消锁定</button>}</li>)}</ul>:<p className="hint">还没有锁组。</p>}
  {editable&&(choices.length>=2?<div className="locked-pair-form">
   <AppSelect aria-label="锁组第一位球友" value={first} disabled={busy} onChange={ev=>setFirst(ev.target.value)}><option value="">选择球友</option>{choices.filter(id=>id!==second).map(id=><option key={id} value={id}>{name(id)}</option>)}</AppSelect>
   <span aria-hidden="true">+</span>
   <AppSelect aria-label="锁组第二位球友" value={second} disabled={busy} onChange={ev=>setSecond(ev.target.value)}><option value="">选择球友</option>{choices.filter(id=>id!==first).map(id=><option key={id} value={id}>{name(id)}</option>)}</AppSelect>
   <button type="button" className="secondary" disabled={busy||!first||!second} onClick={lock}>锁定</button>
  </div>:<p className="hint">正式接龙且未锁组的球友不足两位。</p>)}
 </div>;
}
