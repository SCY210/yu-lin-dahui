'use client';
import {useEffect,useState} from 'react';
import {CalendarDays,Check,Shuffle} from 'lucide-react';
import {canManageEvent} from '../lib/domain/permissions';
import {pointsWindow} from '../lib/domain/points-plan';
import {canVotePointsMode,pointsChoiceCounts,pointsModeLabels,type PointsMode} from '../lib/domain/points-choice';
import {dt,epoch,hm,halfTimed,choice} from './ui';
import type {Event} from '../lib/domain/types';
import './event-points-plan.css';

export default function EventPointsPlan({e,ctx,planning=false}:{e:Event;ctx:any;planning?:boolean}){
 const {data,open,send,busy,name}=ctx,[now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[e.id]);
 const manager=canManageEvent(data.me,e),editable=manager&&!['ended','cancelled','draft'].includes(e.status);
 const window=pointsWindow(e),minutes=Math.round((window.end-window.start)/60000),free=Math.max(0,Math.round((e.end-window.end)/60000));
 const counts=pointsChoiceCounts(data,e),mine=e.pointsChoice?.votes.find(v=>v.voterId===data.me.id),canVote=canVotePointsMode(data,e,data.me,now);
 const started=data.matches.some((m:any)=>m.eventId===e.id&&['playing','complete','forfeit'].includes(m.status));
 const rounds=data.rounds.filter((r:any)=>r.eventId===e.id&&r.pointsSlot!==undefined&&r.status!=='cancelled'),drafts=rounds.filter((r:any)=>r.status==='draft');
 const recommend=e.pointsChoice?.selectedMode??(counts.fixed>counts.rotate?'fixed':'rotate');
 function arrange(){open('提前分配积分赛','planPoints',{eventId:e.id,at:dt(window.start),pointsMinutes:minutes||Math.min(30,Math.floor((e.end-e.start)/60000)),roundMinutes:window.roundMinutes,pairing:recommend,seed:Math.floor(Math.random()*1000000)+1},[
  halfTimed('at','积分赛开始'),{key:'pointsMinutes',label:'积分赛时长 · 分钟',type:'number',min:5,max:Math.min(720,Math.floor((e.end-e.start)/60000))},
  {key:'roundMinutes',label:'每轮预计时长 · 分钟',type:'number',min:5,max:60},choice('pairing','确认搭档方式',[['rotate',pointsModeLabels.rotate],['fixed',pointsModeLabels.fixed]])
 ],(v:any)=>({...v,at:epoch(v.at)}),'按正式接龙名单和各自参加时间一次排好全部积分赛。会替换尚未开打的分组；检查后再发布，现场逐轮开赛、录入比分。')}
 function confirm(mode:PointsMode){open('确认搭档方式','pointsModeSelect',{eventId:e.id,mode},[],undefined,`确认「${pointsModeLabels[mode]}」并关闭投票。更换方式会取消尚未开始的分组，需要重新分配。`)}
 return <section className="card event-points-plan" aria-label="积分赛时段与搭档投票">
  <div className="row"><h3>积分赛安排</h3>{rounds.length>0&&<span className="badge">已预排 {rounds.length} 轮</span>}</div>
  <div className="points-phase-grid"><div><span>积分赛 · {minutes} 分钟</span><strong>{hm(window.start)}–{hm(window.end)}</strong></div>{free>0&&<div><span>自由打 · {free} 分钟</span><strong>{hm(window.end)}–{hm(e.end)}</strong></div>}</div>
  <p className="hint">默认留最后半小时自由打，其他时间打积分赛。创建者可调整时长；进入自由打时段后，新开赛的比赛不计月积分或实力分。</p>
  <h4>搭档方式投票{e.pointsChoice?.selectedMode?' · 已确认'+pointsModeLabels[e.pointsChoice.selectedMode]:''}</h4>
  <div className="points-mode-options">{(['rotate','fixed'] as const).map(mode=><div className={'points-mode-option'+(e.pointsChoice?.selectedMode===mode?' is-selected':'')} key={mode}>
   <strong>{pointsModeLabels[mode]}</strong><p className="hint">{mode==='rotate'?'每轮重新搭配，兼顾上场机会和实力平衡。':'整场保持同一搭档，轮换对手和轮休队伍。'}</p><span className="points-vote-count">{counts[mode]} 票</span>
   <div className="actions"><button type="button" className={'tag-button'+(mine?.mode===mode?' active':'')} aria-pressed={mine?.mode===mode&&canVote} disabled={!canVote||busy} onClick={()=>send('pointsModeVote',{eventId:e.id,mode:mine?.mode===mode?null:mode})}>{mine?.mode===mode?'撤回投票':'投这一种'}</button>
   {editable&&!started&&e.pointsChoice?.selectedMode!==mode&&<button type="button" className="ghost" disabled={busy} onClick={()=>confirm(mode)}>确认此方式</button>}</div>
  </div>)}</div>
  <p className="hint">正式接龙和候补成员每个账号一票，可改投或撤回。投票仅供参考，创建者确认后安排比赛。</p>
  {editable&&!started&&now<e.start&&<button type="button" className="secondary" disabled={busy} onClick={()=>send('pointsModeVoting',{eventId:e.id,open:!e.pointsChoice?.votingOpen})}>{e.pointsChoice?.votingOpen?'关闭搭档投票':'开放搭档投票'}</button>}
  {!canVote&&<p className="hint" role="status">{now>=e.start?'活动已开始，搭档投票已关闭。':e.pointsChoice?.votingOpen?'参加本次接龙后即可投票。':'搭档投票尚未开放或已确认。'}</p>}
  {planning&&editable&&<div className="actions points-plan-actions">
   <button type="button" className="primary" disabled={busy||started||e.playMode==='arena'} onClick={arrange}><CalendarDays size={17} aria-hidden="true"/>{rounds.length?'重新分配积分赛':'一次分配积分赛'}</button>
   {drafts.length>0&&<button type="button" className="secondary" disabled={busy||started} onClick={()=>open('发布全部积分赛分组','publishPoints',{eventId:e.id},[],undefined,`发布 ${drafts.length} 轮草稿，成员可按时间查看搭档、对手与轮休安排。`)}><Check size={17} aria-hidden="true"/>发布全部分组</button>}
   <p className="hint"><Shuffle size={15} aria-hidden="true"/>也可使用下方“生成下一轮”，逐轮安排比赛。已有预排轮次时先完成或取消预排。</p>
  </div>}
  {planning&&e.playMode==='arena'&&<p className="hint">擂台按上一轮胜负安排，继续使用“生成下一轮”；提前排积分赛请先切换为公平轮转玩法。</p>}
  {planning&&e.pointsChoice?.teams&&<details><summary>查看固定搭档</summary><div className="points-fixed-teams">{e.pointsChoice.teams.map((team,i)=><p key={i}>第 {i+1} 队 · {team.map(name).join(' / ')}</p>)}</div><p className="hint">两人均在参加时段内才安排上场；人数为奇数或搭档未到场时需要轮休。</p></details>}
 </section>;
}
