'use client';
import {useState} from 'react';
import {LockKeyhole,Medal,Check} from 'lucide-react';
import {achievementCatalog,badgeImage,type AchievementId,type AchievementSummary} from '../lib/achievement-catalog';
import './achievements.css';

const date=(at:number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',dateStyle:'medium'}).format(at);

export default function AchievementCollection({summary,own=false}:{summary?:AchievementSummary;own?:boolean}){
 const [earnedOnly,setEarnedOnly]=useState(false),[selected,setSelected]=useState<AchievementId|null>(null);
 const chosen=achievementCatalog.find(a=>a.id===selected),chosenProgress=chosen&&summary?.progress[chosen.id];
 return <section className="achievement-book" aria-label={own?'我的成就':'球友成就'}>
  <header className="achievement-heading"><div><p className="achievement-eyebrow">羽林成就簿</p><h3><Medal size={20} aria-hidden="true"/>{own?'我的成就':'球友成就'}</h3></div><span className="achievement-count">{summary?.unlockedCount??0}<small> / {achievementCatalog.length} 已解锁</small></span></header>
  {!summary?<p className="hint" role="status">正在同步成就记录…</p>:<>
   <div className="achievement-filters" aria-label="成就筛选"><button type="button" aria-pressed={!earnedOnly} onClick={()=>{setEarnedOnly(false);setSelected(null)}}>全部成就</button><button type="button" aria-pressed={earnedOnly} onClick={()=>{setEarnedOnly(true);setSelected(null)}}>已解锁 {summary.unlockedCount}</button></div>
   <ul className="achievement-grid">{achievementCatalog.filter(a=>!earnedOnly||summary.progress[a.id].unlockedAt!==null).map(a=>{
    const p=summary.progress[a.id],earned=p.unlockedAt!==null,value=Math.min(p.current,a.target),percent=Math.min(100,p.current/a.target*100);
    return <li key={a.id}><button type="button" className={'achievement-card'+(earned?' is-earned':' is-locked')+(selected===a.id?' is-selected':'')} aria-expanded={selected===a.id} aria-controls="achievement-detail" onClick={()=>setSelected(selected===a.id?null:a.id)} aria-label={a.name+'，'+(earned?'已解锁':`进度 ${value} / ${a.target}`)}>
     <span className="achievement-art"><img src={badgeImage(a.id)} width={256} height={256} alt="" loading="lazy" decoding="async"/>{earned?<span className="achievement-earned-mark"><Check size={12} aria-hidden="true"/></span>:<LockKeyhole className="achievement-lock" size={15} aria-hidden="true"/>}</span>
     <strong>{a.name}</strong><span className="achievement-rarity">{a.rarity}</span><span className="achievement-short-rule">{a.requirement}</span>
     <span className="achievement-track" role="progressbar" aria-label={a.name+'进度'} aria-valuemin={0} aria-valuemax={a.target} aria-valuenow={value}><span style={{width:percent+'%'}}/></span>
     <span className="achievement-progress-text">{earned?'已达成':value+' / '+a.target+' '+a.unit}</span>
    </button></li>;
   })}</ul>
   {earnedOnly&&summary.unlockedCount===0&&<p className="achievement-empty">完成第一场比赛，就能点亮第一枚徽章。</p>}
   {chosen&&chosenProgress&&<div className="achievement-detail" id="achievement-detail" role="region" aria-label={chosen.name+'成就详情'}><img src={badgeImage(chosen.id)} width={256} height={256} alt=""/><div><h4>{chosen.name}</h4><p>{chosen.description}</p><p>{chosen.requirement} · 当前 {chosenProgress.current} {chosen.unit}</p><span>{chosenProgress.unlockedAt!==null?'解锁于 '+date(chosenProgress.unlockedAt):'尚未解锁，继续积累真实比赛记录。'}</span></div></div>}
  </>}
  <p className="achievement-note">按全部生涯的已完成比赛自动计算；取消、弃权和未来比赛不计入。修正或作废记录后会同步更新，成就不会改变积分或实力分。</p>
 </section>;
}
