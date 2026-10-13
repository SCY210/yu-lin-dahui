'use client';
import {useEffect,useState} from 'react';
import {canManageEvent} from '../lib/domain/permissions';
import {canVotePointsMode,pointsVotingOpen,pointsChoiceCounts,pointsModeLabels,type PointsMode} from '../lib/domain/points-voting';
import type {Event} from '../lib/domain/types';
import {eventFormat} from '../lib/domain/match-format';
import './event-points-plan.css';

export default function EventPointsPlan({e,ctx,planning=false}:{e:Event;ctx:any;planning?:boolean}){
 const {data,open,send,busy,name}=ctx,[now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[e.id]);
 const manager=canManageEvent(data.me,e),editable=manager&&!['ended','cancelled','draft'].includes(e.status);
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
  <p className="hint">仅正式接龙成员每个账号一票，候补成员不能投票，可改投或撤回。未确认搭档方式时默认开放投票；投票仅供参考，创建者确认后关闭投票并按现场可上场人数安排比赛。</p>
  {editable&&!started&&now<e.start&&<button type="button" className="secondary" disabled={busy} onClick={()=>send('pointsModeVoting',{eventId:e.id,open:!votingOpen})}>{votingOpen?'关闭搭档投票':'开放搭档投票'}</button>}
  {!canVote&&<p className="hint" role="status">{waiting?'你目前是候补，转为正式接龙后才能投票。':now>=e.start?'活动已开始，搭档投票已关闭。':votingOpen?'请使用本人账号正式接龙后再投票。':e.pointsChoice?.selectedMode?'创建者已确认搭档方式，投票已关闭。':'创建者已关闭搭档投票。'}</p>}
  {planning&&e.pointsChoice?.teams&&<details><summary>查看固定搭档</summary><div className="points-fixed-teams">{e.pointsChoice.teams.map((team,i)=><p key={i}>第 {i+1} 队 · {team.map(name).join(' / ')}</p>)}</div><p className="hint">两人均在参加时段内才安排上场；人数为奇数或搭档未到场时需要轮休。</p></details>}
  {planning&&unmatched.length>0&&e.pointsChoice?.teams&&<p className="hint">未配成固定搭档：{unmatched.map((r:any)=>name(r.playerId)).join('、')}。希望每个人都轮流上场时，建议选择每轮换搭档。</p>}
 </section>;
}
