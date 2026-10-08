'use client';
import {useState} from 'react';
import {Trophy,Shield,Feather,Flame,CheckCircle2,Undo2} from 'lucide-react';
import {Avatar} from './avatar';
import {awardNames} from '../lib/domain/social';
import {awardCandidateIds,canCastAwardVote,isAwardVotingOpen} from '../lib/domain/activity-voting';
import {hm} from './form-fields';
import {awardCategories,awardSummary,type AwardCategory} from '../lib/client/award-ballot';
import './event-awards.css';

const details={mvp:{icon:Trophy,text:'综合表现最亮眼的球友'},defense:{icon:Shield,text:'稳稳接住关键来球'},net:{icon:Feather,text:'封网与小球处理最出彩'},effort:{icon:Flame,text:'每一分都拼到底'}};
export default function EventAwards({e,ctx,now}:any){
 const {data}=ctx,[selected,setSelected]=useState<AwardCategory>('mvp'),[pending,setPending]=useState(''),[notice,setNotice]=useState('');
 const candidates=awardCandidateIds(data,e.id,now),open=isAwardVotingOpen(data,e,now),canVote=canCastAwardVote(data,e,data.me,now),locked=!!pending||ctx.busy;
 const owned=data.awardVotes.filter((v:any)=>v.eventId===e.id&&v.voterId===data.me.id),completed=awardCategories.filter(c=>owned.some((v:any)=>v.category===c)).length;
 const mine=owned.find((v:any)=>v.category===selected),summary=awardSummary(data.awardVotes,e.id,selected),Icon=details[selected].icon;
 const person=(id:string)=>data.players.find((p:any)=>p.id===id)??{id,name:'已移除球友'};
 const playing=data.matches.some((m:any)=>m.eventId===e.id&&m.status==='playing'),cancelled=e.status==='cancelled';
 async function vote(playerId:string,active=true){if(locked||!canVote)return;setPending(playerId);setNotice('');try{await ctx.action('awardVote',{eventId:e.id,playerId,category:selected,active},false);setNotice(active?`已将${awardNames[selected]}投给${person(playerId).name}`:`已撤回${awardNames[selected]}的选票`)}catch{/* The shared action displays the server error. */}finally{setPending('')}}
 return <section className="card award-card" aria-label="赛后球友评选">
  <div className="award-header"><div><p className="award-eyebrow">把掌声留给球友</p><h3>本场球友评选</h3></div><span className="badge">{cancelled?'已关闭':open?'投票进行中':now<e.start?'尚未开始':'等待收官'}</span></div>
  <div className="award-progress"><span>你的评选进度</span><strong>{completed}<small> / 4</small></strong><span className="award-progress-track" aria-hidden="true"><i style={{width:completed*25+'%'}}/></span></div>
  {!open&&<div className="award-status" role="status"><p>{cancelled?'活动已取消，已有票数仍可查看。':e.status==='draft'?'活动尚未开放。':`本活动将在 ${hm(e.end)} 自动结束并开放评选，无需手动结束。`}</p></div>}
  {open&&playing&&<p className="hint">活动时间已结束，评选已开放。还有比分待录入，可在「分组 / 比赛」中补录，照常计分。</p>}
  {open&&!canVote&&<p className="hint">参加本活动的球友、活动创建者及管理员可以投票。</p>}
  <div className="award-categories" role="group" aria-label="选择评选奖项">{awardCategories.map(category=>{const Mark=details[category].icon,voted=owned.some((v:any)=>v.category===category);return <button type="button" key={category} className={'award-category '+(selected===category?'is-active':'')} aria-pressed={selected===category} disabled={locked} onClick={()=>{setSelected(category);setNotice('')}}><Mark size={19} aria-hidden="true"/><span>{awardNames[category]}<small>{voted?'已完成':'待评选'}</small></span>{voted&&<CheckCircle2 className="award-done" size={15} aria-hidden="true"/>}</button>})}</div>
  <div className="award-selected"><Icon size={27} aria-hidden="true"/><div><h4>{awardNames[selected]}</h4><p>{details[selected].text}</p></div><span className="badge">{summary.total} 票</span></div>
  {summary.max>0&&<p className="award-leading">{summary.leaders.length>1?'并列领先':'当前领先'}：{summary.leaders.map(id=>person(id).name).join('、')} · {summary.max} 票</p>}
  <div className="award-candidates">{candidates.map(id=>{const p=person(id),self=id===data.me.playerId,chosen=mine?.playerId===id,count=summary.counts.get(id)??0;return <button type="button" key={id} className={'award-person '+(chosen?'is-chosen':'')} aria-pressed={chosen} aria-label={self?`${p.name}，不能投给自己`:`将${awardNames[selected]}的一票投给${p.name}，当前${count}票`} disabled={!canVote||self||locked} onClick={()=>{if(!chosen)void vote(id)}}><Avatar p={p} size="award-avatar"/><span className="award-person-main"><strong>{p.name}</strong><small>{pending===id?'正在保存…':self?'自己 · 不可自投':chosen?'你已投给这位球友':!open?'赛后开放投票':!canVote?'本场参与者可投票':'点击投给这位球友'}</small><span className="award-vote-track" aria-hidden="true"><i style={{width:summary.total?count/summary.total*100+'%':'0%'}}/></span></span><span className="award-person-count"><b>{count}</b><small>票</small>{chosen&&<CheckCircle2 size={16} aria-hidden="true"/>}</span></button>})}</div>
  {!candidates.length&&<p className="muted">还没有正式参加或已出场的候选球友。</p>}
  {mine&&<div className="award-my-vote"><span>本项已投给 <strong>{person(mine.playerId).name}</strong></span><button type="button" className="ghost" disabled={!canVote||locked} onClick={()=>void vote(mine.playerId,false)}><Undo2 size={15} aria-hidden="true"/>撤回本项</button></div>}
  <p className="award-notice" role="status" aria-live="polite">{notice}</p>
  <details className="award-results"><summary>查看四项当前结果</summary><div className="award-result-grid">{awardCategories.map(category=>{const result=awardSummary(data.awardVotes,e.id,category),Mark=details[category].icon;return <div className="award-result" key={category}><div><Mark size={17} aria-hidden="true"/><strong>{awardNames[category]}</strong></div>{result.max?<><p>{result.leaders.map(id=>person(id).name).join('、')}</p><small>{result.max} 票 · {result.leaders.length>1?'并列领先':'当前领先'}</small></>:<p className="muted">暂无选票</p>}</div>})}</div></details>
  <p className="hint">每项一票，不能投给自己。点击其他球友可改投；本页只展示汇总票数及你自己的选择。</p>
 </section>;
}
