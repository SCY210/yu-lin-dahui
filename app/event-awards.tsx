'use client';
import {useState} from 'react';
import {Trophy,CheckCircle2,Undo2} from 'lucide-react';
import {Avatar} from './avatar';
import {awardCandidateIds,canCastAwardVote,isAwardVotingOpen} from '../lib/domain/activity-voting';
import {hm} from './form-fields';
import {awardSummary} from '../lib/client/award-ballot';
import type {ClubData} from '../lib/contracts/club';
import './event-awards.css';
type Vote=ClubData['awardVotes'][number];
type Player=ClubData['players'][number];
type Match=ClubData['matches'][number];
export default function EventAwards({e,ctx,now}:any){
 const {data}=ctx,[pending,setPending]=useState(''),[notice,setNotice]=useState('');
 const candidates=awardCandidateIds(data,e.id,now),open=isAwardVotingOpen(data,e,now),canVote=canCastAwardVote(data,e,data.me,now),locked=!!pending||ctx.busy;
 const mine=data.awardVotes.find((v:Vote)=>v.eventId===e.id&&v.category==='mvp'&&v.voterId===data.me.id),summary=awardSummary(data.awardVotes,e.id,'mvp');
 const person=(id:string)=>data.players.find((p:Player)=>p.id===id)??{id,name:'已移除球友'};
 const playing=data.matches.some((m:Match)=>m.eventId===e.id&&m.status==='playing'),cancelled=e.status==='cancelled';
 async function vote(playerId:string,active=true){if(locked||!canVote)return;setPending(playerId);setNotice('');try{await ctx.action('awardVote',{eventId:e.id,playerId,category:'mvp',active},false);setNotice(active?`已将 MVP 投给${person(playerId).name}`:'已撤回 MVP 选票')}catch{/* The shared action displays the server error. */}finally{setPending('')}}
 return <section className="card award-card" aria-label="本场MVP投票">
  <div className="award-header"><div><p className="award-eyebrow">把掌声留给球友</p><h3>本场 MVP 投票</h3></div><span className="badge">{cancelled?'已关闭':open?'投票进行中':now<e.start?'尚未开始':'等待收官'}</span></div>
  <div className="award-progress"><span>你的选票</span><strong>{mine?'已投票':'尚未投票'}</strong></div>
  {!open&&<div className="award-status" role="status"><p>{cancelled?'活动已取消，已有票数仍可查看。':e.status==='draft'?'活动尚未开放。':`本活动将在 ${hm(e.end)} 自动结束并开放 MVP 投票。`}</p></div>}
  {open&&playing&&<p className="hint">活动时间已结束，MVP 投票已开放。还有比分待录入，可在「分组 / 比赛」中补录，照常计分。</p>}
  {open&&!canVote&&<p className="hint">正式报名或实际参加本活动的球友、活动创建者及管理员可以投票。</p>}
  <div className="award-selected"><Trophy size={27} aria-hidden="true"/><div><h4>MVP · 最佳球员</h4><p>综合表现最亮眼的球友</p></div><span className="badge">{summary.total} 票</span></div>
  {summary.max>0&&<p className="award-leading">{summary.leaders.length>1?'并列领先':'当前领先'}：{summary.leaders.map(id=>person(id).name).join('、')} · {summary.max} 票</p>}
  <div className="award-candidates">{candidates.map(id=>{const p=person(id),self=id===data.me.playerId,chosen=mine?.playerId===id,count=summary.counts.get(id)??0;return <button type="button" key={id} className={'award-person'+(chosen?' is-chosen':'')} aria-pressed={chosen} aria-label={self?`${p.name}，不能投给自己`:`将 MVP 的一票投给${p.name}，当前${count}票`} disabled={!canVote||self||locked} onClick={()=>{if(!chosen)void vote(id)}}><Avatar p={p} size="award-avatar"/><span className="award-person-main"><strong>{p.name}</strong><small>{pending===id?'正在保存…':self?'自己 · 不可自投':chosen?'你已投给这位球友':!open?'赛后开放投票':!canVote?'本场参与者可投票':'点击投给这位球友'}</small><span className="award-vote-track" aria-hidden="true"><i style={{width:summary.total?count/summary.total*100+'%':'0%'}}/></span></span><span className="award-person-count"><b>{count}</b><small>票</small>{chosen&&<CheckCircle2 size={16} aria-hidden="true"/>}</span></button>})}</div>
  {!candidates.length&&<p className="muted">还没有正式参加或已出场的候选球友。</p>}
  {mine&&<div className="award-my-vote"><span>MVP 已投给 <strong>{person(mine.playerId).name}</strong></span><button type="button" className="ghost" disabled={!canVote||locked} onClick={()=>void vote(mine.playerId,false)}><Undo2 size={15} aria-hidden="true"/>撤回 MVP</button></div>}
  <p className="award-notice" role="status" aria-live="polite">{notice}</p>
  <p className="hint">每个账号一票，不能投给自己。点击其他球友可改投，也可以撤回；本页只展示汇总票数及你自己的选择。</p>
 </section>;
}
