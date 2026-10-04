'use client';
import {CalendarDays,ChevronLeft,ChevronRight,Sparkles} from 'lucide-react';
import {cultivationRealms} from '@/lib/domain/cultivation';
import {Avatar} from './social-hub';
import MonthPicker from './month-picker';
import FeatureGuide from './feature-guide';
import RankingPodium from './ranking-podium';
import './ranking-view.css';

export default function RankingView({data,period,setPeriod,onProfile,rankingPeriod='monthly',setRankingPeriod,year=Number(period.slice(0,4)),setYear}:any) {
 const annual=rankingPeriod==='annual';
 const pendingPeriod=annual?data.rankingYear!==year:data.period!==period;
 const rows=pendingPeriod?[]:((annual?data.annualLeaderboard:data.leaderboard)??[]);
 const rule=data.seasons.find((s:any)=>s.id===period)?.rules??data.settings.rules;
 const yearRules=Array.from({length:12},(_,i)=>({month:i+1,rules:data.seasons.find((s:any)=>s.id===`${year}-${String(i+1).padStart(2,'0')}`)?.rules??data.settings.rules}));
 const player=(r:any)=>data.players.find((p:any)=>p.id===r.playerId)??{name:r.name};
 const realm=(r:any)=>r.realm??data.social?.stats?.find((s:any)=>s.playerId===r.playerId)?.tier??'炼气';
 const leaders=rows.filter((r:any)=>r.games>0&&r.rank<=3).slice(0,3);
 const capText=(r:any)=>r.cap?`每人前 ${r.cap} 场`:'场数不限';
 return <>
  <div className="heading rv-heading">
   <div><p className="eyebrow">{annual?'ANNUAL LEADERBOARD':'MONTHLY LEADERBOARD'}</p><h1>{annual?'年度排行榜':'月度排行榜'}</h1><p className="muted">修仙有境界，球场见实力。全部球友同榜，没有最低场数要求。</p></div>
   <div className="actions rv-controls">
    {annual?<div className="rv-year-picker"><button type="button" aria-label="上一年排名" disabled={year<=2000} onClick={()=>setYear?.(year-1)}><ChevronLeft size={18}/></button><label><CalendarDays size={18}/><span className="sr-only">选择排名年份</span><select aria-label="选择排名年份" value={year} onChange={e=>setYear?.(Number(e.target.value))}>{Array.from({length:101},(_,i)=>2000+i).map(y=><option key={y} value={y}>{y}年</option>)}</select></label><button type="button" aria-label="下一年排名" disabled={year>=2100} onClick={()=>setYear?.(year+1)}><ChevronRight size={18}/></button></div>:<MonthPicker value={period} onChange={setPeriod}/>}
    <FeatureGuide topic={annual?'annualRanking':'ranking'} rules={rule} label="积分怎么算"/>
   </div>
  </div>
  <div className="rv-period-switch" role="group" aria-label="排行榜周期"><button type="button" aria-pressed={!annual} onClick={()=>setRankingPeriod?.('monthly')}>月度榜</button><button type="button" aria-pressed={annual} onClick={()=>setRankingPeriod?.('annual')}>年度榜</button></div>
  <section className="rv-realm-card" aria-label="修仙境界说明"><div className="rv-realm-intro"><Sparkles size={20} aria-hidden="true"/><div><strong>球场修仙境界</strong><p>境界由当前 Elo 实力决定；榜单按{annual?'年度':'月度'}积分排名，境界不额外加分。</p></div><FeatureGuide topic="rating" rules={rule} label="境界说明"/></div><div className="rv-realm-ladder">{cultivationRealms.map((r,i)=><div className={`rv-realm-level rv-realm-${i}`} key={r.name}><span>{String(i+1).padStart(2,'0')}</span><strong>{r.name}</strong><small>Elo {r.range}</small></div>)}</div></section>
  <RankingPodium leaders={leaders} players={data.players} onProfile={onProfile}/>
  <section className="card ranking-card"><div className="section-title"><h2>全部排名</h2><span className="badge">{rows.length} 位球友</span></div>
   {rows.map((r:any)=><div className={'leaderboard-row '+(r.playerId===data.me.playerId?'is-me':'')} key={r.playerId}>
    <b className={'rank rank-'+(r.rank-1)}>{r.rank}</b>
    <button type="button" className="pp-rank-avatar-link" aria-label={'查看'+r.name+'的球员档案'} onClick={()=>onProfile?.(r.playerId)}><Avatar p={player(r)} size="ranking-avatar"/></button>
    <div className="ranking-person"><strong>{r.name}{r.playerId===data.me.playerId&&<span className="me-label">我</span>}</strong><div className="rv-realm-meta"><span className={`rv-realm-badge rv-realm-${cultivationRealms.findIndex(x=>x.name===realm(r))}`}>{realm(r)}</span>{r.provisional&&<span className="rv-provisional">暂定境界</span>}</div><small>{r.games}场计分 · {r.wins}胜 {r.losses}负</small>{r.total!==r.games&&<small>实际比赛 {r.total} 场</small>}</div>
    <div className="ranking-result"><strong>{r.points}<span> 分</span></strong><small>{r.games?Math.round(r.rate*100)+'% 胜率':annual?'本年暂无计分赛':'本月暂无计分赛'}</small><small>场均净胜 {r.margin.toFixed(1)}</small></div>
   </div>)}
   {!rows.length&&<p className="empty" role={pendingPeriod?'status':undefined}>{pendingPeriod?'正在读取'+(annual?year+'年度':period+'月度')+'榜单…':'群组还没有启用的球友。'}</p>}{rows.length>0&&!leaders.length&&<p className="hint">{annual?'本年':'本月'}尚无有效计分赛，所有球友已在榜单中。</p>}
  </section>
  <section className="rv-calculation" aria-label={annual?'年度积分计算':'月度积分计算'}><strong>{annual?'年度积分 = 1 至 12 月积分之和':'月度积分 = 胜场 × '+rule.win+' + 负场 × '+rule.loss}</strong><p>{annual?'每个月分别按当月规则取有效计分赛，再累加积分、胜负和计分场数。每月上限重新计算，不另设全年场数上限。':`胜利 ${rule.win} 分 · 失败 ${rule.loss} 分 · ${capText(rule)}有效计分赛。`}</p><p>按实际开赛时间归属马德里自然{annual?'年和月':'月'}。同分依次比较{annual?'全年计分赛':'计分赛'}胜率、场均净胜分，仍相同则并列。</p>{annual&&<details><summary>查看 {year} 年各月计分规则</summary><div className="rv-year-rules">{yearRules.map(({month,rules})=><div key={month}><b>{month}月</b><span>胜 {rules.win} / 负 {rules.loss} 分</span><span>{capText(rules)}</span></div>)}</div><p className="rv-rule-note">已保存赛季采用其历史规则；尚无赛季记录的月份采用群组当前规则。</p></details>}</section>
 </>;
}
