'use client';
import {useState} from 'react';
import {LockKeyhole,Medal,Check,ChevronRight} from 'lucide-react';
import {achievementCatalog,achievementTargets,achievementRanks,achievementLevel,achievementGoal,badgeImage,rankImage,type AchievementId,type AchievementSummary} from '../lib/achievement-catalog';
import './achievements.css';

const date=(at:number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',dateStyle:'medium'}).format(at);
function Badge({id,level,locked=false}:{id:AchievementId;level:number;locked?:boolean}){
 return <span className={'achievement-art tier-'+level+(locked?' art-locked':'')}><img className="achievement-emblem" src={badgeImage(id)} width={256} height={256} alt="" loading="lazy" decoding="async"/><img className="achievement-frame" src={rankImage(level)} width={384} height={384} alt="" loading="lazy" decoding="async"/>{locked?<LockKeyhole className="achievement-lock" size={15} aria-hidden="true"/>:<span className="achievement-level-seal">{level}</span>}</span>;
}

export default function AchievementCollection({summary,own=false,players=[]}:{summary?:AchievementSummary;own?:boolean;players?:{id:string;name:string}[]}){
 const [earnedOnly,setEarnedOnly]=useState(false),[selected,setSelected]=useState<AchievementId|null>(null);
 const chosen=achievementCatalog.find(a=>a.id===selected),chosenProgress=chosen&&summary?.progress[chosen.id];
 const totalLevels=summary?achievementCatalog.reduce((total,a)=>total+achievementLevel(a.id,summary.progress[a.id].current),0):0;
 return <section className="achievement-book" aria-label={own?'我的成就':'球友成就'}>
  <header className="achievement-heading"><div><p className="achievement-eyebrow">羽林成就簿 · 每项五级</p><h3><Medal size={20} aria-hidden="true"/>{own?'我的成就':'球友成就'}</h3></div><span className="achievement-count">{totalLevels}<small> / 40 阶段</small></span></header>
  <p className="achievement-intro">青铜 → 白银 → 黄金 → 铂金 → 钻石，达成目标后自动升级徽章。</p>
  {!summary?<p className="hint" role="status">正在同步成就记录…</p>:<>
   <div className="achievement-filters" aria-label="成就筛选"><button type="button" aria-pressed={!earnedOnly} onClick={()=>{setEarnedOnly(false);setSelected(null)}}>全部成就</button><button type="button" aria-pressed={earnedOnly} onClick={()=>{setEarnedOnly(true);setSelected(null)}}>已点亮 {summary.unlockedCount}</button></div>
   <ul className="achievement-grid">{achievementCatalog.filter(a=>!earnedOnly||summary.progress[a.id].unlockedAt!==null).map(a=>{
    const p=summary.progress[a.id],level=achievementLevel(a.id,p.current),max=level===5,target=achievementTargets[a.id][Math.min(level,4)],value=Math.min(p.current,target),percent=Math.min(100,p.current/target*100);
    return <li key={a.id}><button type="button" className={'achievement-card'+(level?' is-earned':' is-locked')+(selected===a.id?' is-selected':'')} aria-expanded={selected===a.id} aria-controls="achievement-detail" onClick={()=>setSelected(selected===a.id?null:a.id)} aria-label={a.name+'，'+(level?achievementRanks[level-1].name+' Lv.'+level:'未解锁')+'，'+(max?'已满级':'下一级目标 '+target+' '+a.unit+'，当前 '+p.current)}>
     <Badge id={a.id} level={Math.max(1,level)} locked={!level}/><strong>{a.name}</strong><span className="achievement-rarity">{level?achievementRanks[level-1].name+' · Lv.'+level:'未解锁 · Lv.0'}</span><span className="achievement-short-rule">{max?'全部阶段已达成':achievementGoal(a.id,target)}</span>
     <span className="achievement-track" role="progressbar" aria-label={a.name+'下一阶段进度'} aria-valuemin={0} aria-valuemax={target} aria-valuenow={value}><span style={{width:percent+'%'}}/></span><span className="achievement-progress-text">{max?'钻石满级':value+' / '+target+' '+a.unit+' · 还差 '+Math.max(0,target-p.current)}</span>
    </button></li>;
   })}</ul>
   {earnedOnly&&summary.unlockedCount===0&&<p className="achievement-empty">完成第一场比赛，就能点亮第一枚徽章。</p>}
   {chosen&&chosenProgress&&<div className="achievement-detail" id="achievement-detail" role="region" aria-label={chosen.name+'成就等级与目标'}>
    <div className="achievement-detail-heading"><h4>{chosen.name} · 等级路线</h4><p>{chosen.description} 当前累计：{chosenProgress.current} {chosen.unit}。</p>{chosen.metric==='partnerWins'&&chosenProgress.partnerId&&<p>当前记录搭档：{players.find(p=>p.id===chosenProgress.partnerId)?.name??'球友'} · {chosenProgress.current} 胜</p>}</div>
    <ol className="achievement-roadmap">{achievementTargets[chosen.id].map((target,index)=>{
     const level=index+1,earned=chosenProgress.current>=target,at=chosenProgress.levelUnlockedAt?.[index];
     return <li key={level} className={earned?'stage-earned':'stage-locked'}><Badge id={chosen.id} level={level} locked={!earned}/><div><strong>{achievementRanks[index].name} · Lv.{level}</strong><p>{achievementGoal(chosen.id,target)}</p><small>{earned?(at!=null?'达成于 '+date(at):'已达成'):'还差 '+(target-chosenProgress.current)+' '+chosen.unit}</small></div>{earned?<Check size={18} aria-label="已达成"/>:<ChevronRight size={18} aria-hidden="true"/>}</li>;
    })}</ol>
   </div>}
  </>}
  <p className="achievement-note">按全部生涯的已完成比赛自动计算，历史记录直接换算等级；取消、弃权和未来比赛不计入。连胜按生涯最高连胜计算。修正或作废比赛会重新计算等级，成就不影响积分或实力分。</p>
 </section>;
}
