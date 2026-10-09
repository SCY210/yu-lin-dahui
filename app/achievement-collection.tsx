'use client';
import {useState} from 'react';
import {LockKeyhole,Medal,Check,ChevronRight} from 'lucide-react';
import {achievementCatalog,achievementTargets,achievementParticipationDays,achievementRanks,achievementLevel,achievementGoal,badgeImage,rankImage,type AchievementId,type AchievementSummary} from '../lib/achievement-catalog';
import './achievements.css';

const date=(at:number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',dateStyle:'medium'}).format(at);
function Badge({id,level,locked=false,eager=false}:{id:AchievementId;level:number;locked?:boolean;eager?:boolean}){
 return <span className={'achievement-art tier-'+level+(locked?' art-locked':'')}><img className="achievement-emblem" src={badgeImage(id)} width={256} height={256} alt="" loading={eager?'eager':'lazy'} decoding="async"/><img className="achievement-frame" src={rankImage(level)} width={384} height={384} alt="" loading={eager?'eager':'lazy'} decoding="async"/>{locked?<LockKeyhole className="achievement-lock" size={15} aria-hidden="true"/>:<span className="achievement-level-seal">{level}</span>}</span>;
}

export default function AchievementCollection({summary,own=false,players=[]}:{summary?:AchievementSummary;own?:boolean;players?:{id:string;name:string}[]}){
 const [earnedOnly,setEarnedOnly]=useState(false),[selected,setSelected]=useState<AchievementId|null>(null);
 const chosen=achievementCatalog.find(a=>a.id===selected),chosenProgress=chosen&&summary?.progress[chosen.id];
 const matchDays=summary?.matchDays??0;
 const totalLevels=summary?achievementCatalog.reduce((total,a)=>total+achievementLevel(a.id,summary.progress[a.id].current,matchDays),0):0;
 return <section className="achievement-book" aria-label={own?'我的成就':'球友成就'}>
  <header className="achievement-heading"><div><p className="achievement-eyebrow">羽林成就簿 · 每项五级</p><h3><Medal size={20} aria-hidden="true"/>{own?'我的成就':'球友成就'}</h3></div><span className="achievement-count">{totalLevels}<small> / 40 阶段</small></span></header>
  <p className="achievement-intro">青铜 → 白银 → 黄金 → 铂金 → 钻石，目标与累计打球日同时达标，才会点亮或升级徽章；同一天多场只计一天。初阶徽章首个打球日即可点亮，进阶与珍稀徽章分别至少需要 2 个和 3 个打球日。</p>
  {!summary?<p className="hint" role="status">正在同步成就记录…</p>:<>
   <div className="achievement-filters" aria-label="成就筛选"><button type="button" aria-pressed={!earnedOnly} onClick={()=>{setEarnedOnly(false);setSelected(null)}}>全部成就</button><button type="button" aria-pressed={earnedOnly} onClick={()=>{setEarnedOnly(true);setSelected(null)}}>已点亮 {summary.unlockedCount}</button></div>
   <ul className="achievement-grid">{achievementCatalog.filter(a=>!earnedOnly||summary.progress[a.id].unlockedAt!==null).map(a=>{
    const p=summary.progress[a.id],level=achievementLevel(a.id,p.current,matchDays),max=level===5,index=Math.min(level,4),target=achievementTargets[a.id][index],daysTarget=achievementParticipationDays[a.id][index],value=Math.min(p.current,target),percent=Math.min(100,p.current/target*100,matchDays/daysTarget*100);
    return <li key={a.id}><button type="button" className={'achievement-card'+(level?' is-earned':' is-locked')+(selected===a.id?' is-selected':'')} aria-expanded={selected===a.id} aria-controls="achievement-detail" onClick={()=>setSelected(selected===a.id?null:a.id)} aria-label={a.name+'，'+(level?achievementRanks[level-1].name+' · '+level+'级':'未解锁')+'，'+(max?'已满级':'下一级目标 '+target+' '+a.unit+'，当前 '+p.current+'，累计打球日 '+matchDays+' / '+daysTarget+' 天')}>
     <Badge id={a.id} level={Math.max(1,level)} locked={!level} eager={own}/><strong>{a.name}</strong><span className="achievement-rarity">{level?achievementRanks[level-1].name+' · '+level+'级':'未解锁'}</span><span className="achievement-short-rule">{max?'全部阶段已达成':achievementGoal(a.id,target)}</span>
     <span className="achievement-track" role="progressbar" aria-label={a.name+'下一阶段进度'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(percent)} aria-valuetext={value+' / '+target+' '+a.unit+'；累计打球日 '+matchDays+' / '+daysTarget+' 天'}><span style={{width:percent+'%'}}/></span><span className="achievement-progress-text">{max?'钻石满级':value+' / '+target+' '+a.unit+(p.current>=target?' · 目标已达成':' · 还差 '+(target-p.current))}</span>{!max&&<span className="achievement-days-progress">打球日 {Math.min(matchDays,daysTarget)} / {daysTarget} 天{matchDays<daysTarget?' · 还差 '+(daysTarget-matchDays)+' 天':' · 已达标'}</span>}
    </button></li>;
   })}</ul>
   {earnedOnly&&summary.unlockedCount===0&&<p className="achievement-empty">完成第一场比赛，就能点亮第一枚徽章。</p>}
   {chosen&&chosenProgress&&<div className="achievement-detail" id="achievement-detail" role="region" aria-label={chosen.name+'成就等级与目标'}>
    <div className="achievement-detail-heading"><h4>{chosen.name} · 等级路线</h4><p>{chosen.description} 当前累计：{chosenProgress.current} {chosen.unit}。</p>{chosen.metric==='partnerWins'&&chosenProgress.partnerId&&<p>当前记录搭档：{players.find(p=>p.id===chosenProgress.partnerId)?.name??'球友'} · {chosenProgress.current} 胜</p>}</div>
    <ol className="achievement-roadmap">{achievementTargets[chosen.id].map((target,index)=>{
     const level=index+1,daysTarget=achievementParticipationDays[chosen.id][index],earned=chosenProgress.current>=target&&matchDays>=daysTarget,at=chosenProgress.levelUnlockedAt?.[index],remaining=[chosenProgress.current<target?(target-chosenProgress.current)+' '+chosen.unit:'',matchDays<daysTarget?(daysTarget-matchDays)+' 个打球日':''].filter(Boolean).join('、');
     return <li key={level} className={earned?'stage-earned':'stage-locked'}><Badge id={chosen.id} level={level} locked={!earned} eager={own}/><div><strong>{achievementRanks[index].name} · {level}级</strong><p>{achievementGoal(chosen.id,target)} · 累计打球 {daysTarget} 天</p><small>{earned?(at!=null?'达成于 '+date(at):'已达成'):'还差 '+remaining}</small></div>{earned?<Check size={18} aria-label="已达成"/>:<ChevronRight size={18} aria-hidden="true"/>}</li>;
    })}</ol>
   </div>}
  </>}
  <p className="achievement-note">按全部生涯的已完成比赛自动计算，历史记录按当前门槛重算等级；每级同时要求累计指标与打球日期数，同一天多场只计一天，无需连续出勤。取消、弃权和未来比赛不计入。连胜按生涯最高连胜计算。修正或作废比赛会重新计算等级，成就不影响积分或实力分。</p>
 </section>;
}
