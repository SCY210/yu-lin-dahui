'use client';
import Disclosure from './disclosure';
import {Avatar} from './avatar';
import {useState} from 'react';
import RealmBadge from './realm-badge';
import {QuarterPicker,YearPicker} from './month-picker';
import {rankingQuarter,quarterMonths,quarterLabel} from '../lib/ranking-quarter';
import FeatureGuide from './feature-guide';
import RankingPodium from './ranking-podium';
import './ranking-view.css';

export default function RankingView({data,period,setPeriod,onProfile,rankingPeriod='quarterly',setRankingPeriod,year=Number(period.slice(0,4)),setYear}:any) {
 const [detailed,setDetailed]=useState(false);
 const annual=rankingPeriod==='annual';
 const quarter=rankingQuarter(period);
 const pendingPeriod=annual?data.rankingYear!==year:data.rankingQuarter!==quarter;
 const rows=pendingPeriod?[]:((annual?data.annualLeaderboard:data.quarterlyLeaderboard)??[]);
 const rule=data.seasons.find((s:any)=>s.id===period)?.rules??data.settings.rules;
 const periods=annual?Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`):quarterMonths(quarter);
 const periodRules=periods.map(value=>({month:Number(value.slice(5)),rules:data.seasons.find((s:any)=>s.id===value)?.rules??data.settings.rules}));
 const player=(r:any)=>data.players.find((p:any)=>p.id===r.playerId)??{name:r.name};
 const realm=(r:any)=>r.realm??data.social?.stats?.find((s:any)=>s.playerId===r.playerId)?.tier??'炼气';
 const cultivation=(r:any)=>r.cultivation??data.social?.stats?.find((s:any)=>s.playerId===r.playerId)?.cultivation;
 const leaders=rows.filter((r:any)=>(r.games>0||r.points>0)&&r.rank<=3).slice(0,3);
 const capText=(r:any)=>r.cap?`每人前 ${r.cap} 局`:'小局数不限';
 return <>
  <div className="heading rv-heading">
   <div className="rv-title"><p className="eyebrow">{annual?'年度群榜':'季度群榜'}</p><h1>{annual?'年度排行榜':'季度排行榜'}</h1></div>
   <div className="rv-period-switch" role="group" aria-label="排行榜周期"><button type="button" aria-pressed={!annual} onClick={()=>setRankingPeriod?.('quarterly')}>季度榜</button><button type="button" aria-pressed={annual} onClick={()=>setRankingPeriod?.('annual')}>年度榜</button></div>
   <div className="actions rv-controls">
    {annual?<YearPicker value={year} onChange={value=>setYear?.(value)}/>:<QuarterPicker value={period} onChange={setPeriod}/>}
    <button type="button" className="ghost" aria-pressed={detailed} onClick={()=>setDetailed(!detailed)}>{detailed?'简洁排名':'详细数据'}</button><FeatureGuide topic={annual?'annualRanking':'ranking'} rules={rule} label="积分怎么算"/>
   </div>
  </div>
  <RankingPodium leaders={leaders} rankingRows={rows} players={data.players} onProfile={onProfile} loading={pendingPeriod}/>
  <section className="card ranking-card"><div className="section-title"><h2>全部排名</h2><span className="badge">{rows.length} 位球友</span></div>
   {rows.map((r:any)=><div className={'leaderboard-row '+(r.playerId===data.me.playerId?'is-me ':'')} key={r.playerId}>
    <b className={'rank rank-'+(r.rank-1)}>{r.rank}</b>
    {<button type="button" className="pp-rank-avatar-link" aria-label={'查看'+r.name+'的球员档案'} onClick={()=>onProfile?.(r.playerId)}><Avatar p={player(r)} size="ranking-avatar"/></button>}
    <div className="ranking-person"><strong><button type="button" className="rv-name-link" onClick={()=>onProfile?.(r.playerId)} aria-label={'查看'+r.name+'的球员档案'}>{r.name}</button>{r.playerId===data.me.playerId&&<span className="me-label">我</span>}</strong><div className="rv-realm-meta"><RealmBadge className="rv-realm-badge" realm={realm(r)} stage={cultivation(r)?.stage} />{r.provisional&&<span className="rv-provisional">暂定</span>}</div>{detailed&&cultivation(r)&&<div className="rv-progress" aria-label={`${realm(r)}修为 ${cultivation(r).progressPercent}%`}><span className="rv-progress-track" aria-hidden="true"><span style={{width:cultivation(r).progressPercent+'%'}}/></span><span>{cultivation(r).experience??0} 修为 · {cultivation(r).progressPercent}%</span></div>}<small>{r.games}局计分 · {r.wins}胜 {r.losses}负</small>{detailed&&r.total!==r.games&&<small>实际比赛 {r.total} 局</small>}</div>
    <div className="ranking-result"><strong>{r.points}<span> 分</span></strong>{r.manualPoints>0&&<small>含群主加分 +{r.manualPoints}</small>}<small>{r.games?Math.round(r.rate*100)+'% 胜率':annual?'本年暂无计分赛':'本季度暂无计分赛'}</small>{detailed&&<small>局均净胜 {r.margin.toFixed(1)}</small>}</div>
   </div>)}
   {!rows.length&&<p className="empty" role={pendingPeriod?'status':undefined}>{pendingPeriod?'正在读取'+(annual?year+'年度':quarterLabel(quarter))+'榜单…':'群组还没有启用的球友。'}</p>}{rows.length>0&&!leaders.length&&<p className="hint">{annual?'本年':quarterLabel(quarter)}尚无有效计分赛，所有球友已在榜单中。</p>}
  </section>
  <Disclosure label="积分规则与各月明细"><section className="rv-calculation" aria-label={annual?'年度积分计算':'季度积分计算'}><strong>{annual?'年度积分 = 1 至 12 月积分之和':'季度积分 = 本季度三个月的计分积分之和'}</strong><p>每个月分别按当月规则取有效计分赛，再累加积分、胜负和计分局数。群主手动加分计入指定月份，并汇总到季度、年度榜，不增加胜场、修为或实力分。默认无月度上限，自定义上限按月重新计算，不另设{annual?'全年':'全季度'}小局上限。</p><p>按实际开赛时间归属马德里自然{annual?'年':quarterLabel(quarter)}。同分依次比较{annual?'全年':'本季度'}计分赛胜率、局均净胜分，仍相同则并列。</p><details><summary>查看 {annual?year+'年':quarterLabel(quarter)} 各月计分规则</summary><div className="rv-year-rules">{periodRules.map(({month,rules})=><div key={month}><b>{month}月</b><span>胜 {rules.win} / 负 {rules.loss} 分</span><span>{capText(rules)}</span></div>)}</div><p className="rv-rule-note">已保存赛季采用其历史规则；尚无赛季记录的月份采用群组当前规则。</p></details></section></Disclosure>
 </>;
}
