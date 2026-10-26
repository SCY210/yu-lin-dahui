'use client';
import {useState} from 'react';
import {Trophy,CheckCircle2,Lock} from 'lucide-react';
import {Avatar} from './avatar';
import {awardCandidateIds,awardVotingClosesAt,canCastAwardVote,isAwardVotingOpen,mvpPoints,mvpWinners,mvpVotes,canAwardMvpPoints} from '../lib/domain/activity-voting';
import {fmt,hm} from './form-fields';
import {awardSummary} from '../lib/client/award-ballot';
import type {ClubData} from '../lib/contracts/club';
import './event-awards.css';
type Vote=ClubData['awardVotes'][number];
type Player=ClubData['players'][number];
type Match=ClubData['matches'][number];
export default function EventAwards({e,ctx,now}:any){
 const {data}=ctx,[pending,setPending]=useState(''),[notice,setNotice]=useState(''),[choice,setChoice]=useState('');
 const candidates=awardCandidateIds(data,e.id,now),open=isAwardVotingOpen(data,e,now),canVote=canCastAwardVote(data,e,data.me,now),locked=!!pending||ctx.busy;
 const counted=mvpVotes(data,e),earnsPoints=canAwardMvpPoints(e);
 const mine=counted.find((v:Vote)=>v.eventId===e.id&&v.category==='mvp'&&v.voterId===data.me.id),summary=awardSummary(counted,e.id,'mvp');
 const person=(id:string)=>data.players.find((p:Player)=>p.id===id)??{id,name:'已移除球友'};
 const playing=data.matches.some((m:Match)=>m.eventId===e.id&&m.status==='playing'),cancelled=e.status==='cancelled';
 const closesAt=awardVotingClosesAt(e),closed=!cancelled&&now>=closesAt,winners=closed?mvpWinners(data,e,now):[],canViewNamedVotes=data.me.role==='admin'||!!data.me.isOwner;
 const named=canViewNamedVotes?(counted as (Vote&{voterPlayerId?:string})[]).filter(v=>v.eventId===e.id&&v.category==='mvp'&&v.voterPlayerId):[];
 // A vote is final once cast, so picking a player only selects them; the confirmation button casts the vote.
 async function vote(playerId:string){if(locked||!canVote||mine)return;setPending(playerId);setNotice('');try{await ctx.action('awardVote',{eventId:e.id,playerId,category:'mvp'},false);setChoice('');setNotice(`已将 MVP 投给${person(playerId).name}`)}catch{/* The shared action displays the server error. */}finally{setPending('')}}
 return <section className="card award-card" aria-label="本场MVP投票">
  <div className="award-header"><div><p className="award-eyebrow">把掌声留给球友</p><h3>本场 MVP 投票</h3></div><span className="badge">{cancelled?'已关闭':closed?'投票已截止':open?'投票进行中':now<e.start?'尚未开始':'等待收官'}</span></div>
  {open&&<p className="hint award-deadline">投票截止：{fmt(closesAt)}。{earnsPoints&&<>截止后票数最多的球友获得 {mvpPoints} 积分，并列第一都得分。</>}</p>}
  {closed&&<div className="award-final" role="status"><Trophy size={20} aria-hidden="true"/>{winners.length?<span>本场 MVP：<strong>{winners.map(id=>person(id).name).join('、')}</strong>{earnsPoints&&<> · 获得 {mvpPoints} 积分</>}</span>:<span>投票已截止，本场没有人获得 MVP 票。</span>}</div>}
  <div className="award-progress"><span>你的选票</span><strong>{mine?'已投票':'尚未投票'}</strong></div>
  {!open&&!closed&&<div className="award-status" role="status"><p>{cancelled?'活动已取消，已有票数仍可查看。':e.status==='draft'?'活动尚未开放。':`本活动将在 ${hm(e.end)} 自动结束并开放 MVP 投票。`}</p></div>}
  {open&&playing&&<p className="hint">活动时间已结束，MVP 投票已开放。还有比分待录入，可在「分组 / 比赛」中补录，照常计分。</p>}
  {open&&!canVote&&<p className="hint">正式报名或实际参加本活动的球友、活动创建者及管理员可以投票。</p>}
  <div className="award-selected"><Trophy size={27} aria-hidden="true"/><div><h4>MVP · 最佳球员</h4><p>综合表现最亮眼的球友</p></div><span className="badge">{summary.total} 票</span></div>
  {summary.max>0&&<p className="award-leading">{summary.leaders.length>1?'并列领先':'当前领先'}：{summary.leaders.map(id=>person(id).name).join('、')} · {summary.max} 票</p>}
  <div className="award-candidates">{candidates.map(id=>{const p=person(id),self=id===data.me.playerId,chosen=mine?.playerId===id,picked=!mine&&choice===id,count=summary.counts.get(id)??0;return <button type="button" key={id} className={'award-person'+(chosen||picked?' is-chosen':'')} aria-pressed={chosen||picked} aria-label={self?`${p.name}，不能投给自己`:mine?`${p.name}，当前${count}票`:`选择${p.name}作为 MVP，当前${count}票`} disabled={!canVote||self||locked||!!mine} onClick={()=>setChoice(picked?'':id)}><Avatar p={p} size="award-avatar"/><span className="award-person-main"><strong>{p.name}</strong><small>{pending===id?'正在保存…':self?'自己 · 不可自投':chosen?'你已投给这位球友':mine?'已投票，不能改投':picked?'已选中，点下方确认投出':!open?(closed?'投票已截止':cancelled?'活动已取消':'赛后开放投票'):!canVote?'本场参与者可投票':'点击选择这位球友'}</small><span className="award-vote-track" aria-hidden="true"><i style={{width:summary.total?count/summary.total*100+'%':'0%'}}/></span></span><span className="award-person-count"><b>{count}</b><small>票</small>{chosen&&<CheckCircle2 size={16} aria-hidden="true"/>}</span></button>})}</div>
  {!candidates.length&&<p className="muted">还没有正式参加或已出场的候选球友。</p>}
  {!mine&&choice&&canVote&&<div className="award-confirm" role="group" aria-label="确认 MVP 选票"><p>确认把 MVP 投给 <strong>{person(choice).name}</strong>？<small>投出后不能改投或撤回。</small></p><div className="actions"><button type="button" className="primary" disabled={locked} onClick={()=>void vote(choice)}>{pending?'正在投出…':'确认投出'}</button><button type="button" className="ghost" disabled={locked} onClick={()=>setChoice('')}>再想想</button></div></div>}
  {mine&&<div className="award-my-vote"><Lock size={15} aria-hidden="true"/><span>MVP 已投给 <strong>{person(mine.playerId).name}</strong> · 选票已锁定</span></div>}
  <p className="award-notice" role="status" aria-live="polite">{notice}</p>
  {canViewNamedVotes&&<details className="award-named"><summary>投票明细 · {named.length} 票（仅管理员和群主可见）</summary>{named.length?named.map(v=><p key={v.id}><strong>{person(v.voterPlayerId!).name}</strong> → {person(v.playerId).name}</p>):<p className="muted">还没有人投票。</p>}</details>}
  <p className="hint">每个账号一票，不能投给自己；投出后不能改投或撤回。</p>
 </section>;
}
