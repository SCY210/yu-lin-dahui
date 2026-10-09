'use client';
import Disclosure from './disclosure';
import type {ClubData} from '../lib/contracts/club';
import {Avatar} from './avatar';
import {useState} from 'react';
import RealmBadge,{PlacementBadge} from './realm-badge';
import {QuarterPicker,YearPicker} from './month-picker';
import {rankingQuarter,quarterLabel} from '../lib/ranking-quarter';
import {seasonPointsPolicy} from '../lib/domain/season-points';
import FeatureGuide from './feature-guide';
import RankingPodium from './ranking-podium';
import './ranking-view.css';

export default function RankingView({data,period,setPeriod,onProfile,rankingPeriod='quarterly',setRankingPeriod,rankingFormat='all',setRankingFormat,year=Number(period.slice(0,4)),setYear}:any) {
 const [detailed,setDetailed]=useState(false);
 const annual=rankingPeriod==='annual',singles=rankingFormat==='singles';
 const quarter=rankingQuarter(period);
 const pendingPeriod=annual?data.rankingYear!==year:data.rankingQuarter!==quarter;
 // Singles and doubles scores are displayed on separate boards.
 const rows=pendingPeriod?[]:((singles?(annual?data.singlesAnnualLeaderboard:data.singlesQuarterlyLeaderboard):(annual?data.annualLeaderboard:data.quarterlyLeaderboard))??[]);
 const scope=annual?year+'年':quarterLabel(quarter);
 const rule=data.seasons.find((s:any)=>s.id===period)?.rules??data.settings.rules;
 const player=(r:any)=>data.players.find((p:any)=>p.id===r.playerId)??{name:r.name};
 const realm=(r:any)=>r.realm??data.social?.stats?.find((s:any)=>s.playerId===r.playerId)?.tier??'炼气';
 const realmScore=(r:any)=>r.realmScore??data.social?.stats?.find((s:any)=>s.playerId===r.playerId)?.realmScore;
 // Placement rows show only the neutral 定级中 chip: no realm, stage or realm progress.
 const placing=(r:Parameters<typeof realmScore>[0])=>!!(r.provisional||realmScore(r)?.placement);
 const leaders=rows.filter((r:ClubData['quarterlyLeaderboard'][number])=>(r.games>0||r.points>0)&&r.rank<=3).slice(0,3);
 const signed=(n:number)=>(n>0?'+':'')+n;
 const upsets=[...seasonPointsPolicy.upsets].sort((x,y)=>x.gap-y.gap);
 return <>
  <div className="heading rv-heading">
   <div className="rv-title"><p className="eyebrow">{(annual?'年度':'季度')+(singles?'单打':'双打')}</p><h1>{(annual?'年度':'季度')+(singles?'单打榜':'双打榜')}</h1></div>
   <div className="rv-period-switch" role="group" aria-label="排行榜周期"><button type="button" aria-pressed={!annual} onClick={()=>setRankingPeriod?.('quarterly')}>季度榜</button><button type="button" aria-pressed={annual} onClick={()=>setRankingPeriod?.('annual')}>年度榜</button></div>
   <div className="rv-period-switch rv-format-switch" role="group" aria-label="排行榜类型"><button type="button" aria-pressed={!singles} onClick={()=>setRankingFormat?.('all')}>双打榜</button><button type="button" aria-pressed={singles} onClick={()=>setRankingFormat?.('singles')}>单打榜</button></div>
   <div className="actions rv-controls">
    {annual?<YearPicker value={year} onChange={value=>setYear?.(value)}/>:<QuarterPicker value={period} onChange={setPeriod}/>}
    <div className="rv-control-actions"><button type="button" className="ghost" aria-pressed={detailed} onClick={()=>setDetailed(!detailed)}>{detailed?'简洁排名':'详细数据'}</button><FeatureGuide topic={annual?'annualRanking':'ranking'} rules={rule} label="积分怎么算"/></div>
   </div>
  </div>
  <RankingPodium leaders={leaders} rankingRows={rows} players={data.players} onProfile={onProfile} loading={pendingPeriod}/>
  <section className="card ranking-card"><div className="section-title"><h2>全部排名</h2><span className="badge">{rows.length} 位球友</span></div>
   {rows.map((r:any)=><div className={'leaderboard-row '+(r.playerId===data.me.playerId?'is-me ':'')} key={r.playerId}>
    <b className={'rank rank-'+(r.rank-1)}>{r.rank}</b>
    {<button type="button" className="pp-rank-avatar-link" aria-label={'查看'+r.name+'的球员档案'} onClick={()=>onProfile?.(r.playerId)}><Avatar p={player(r)} size="ranking-avatar"/></button>}
    <div className="ranking-person"><strong><button type="button" className="rv-name-link" onClick={()=>onProfile?.(r.playerId)} aria-label={'查看'+r.name+'的球员档案'}>{r.name}</button>{r.playerId===data.me.playerId&&<span className="me-label">我</span>}</strong><div className="rv-realm-meta">{placing(r)?<PlacementBadge className="rv-realm-badge" games={realmScore(r)?.ratedGames} total={realmScore(r)?.placementGames} />:<RealmBadge className="rv-realm-badge" realm={realm(r)} stage={realmScore(r)?.stage} />}</div>{detailed&&placing(r)&&realmScore(r)&&<div className="rv-progress"><span>段位分 {realmScore(r).score??1000} · 定级完成后显示境界</span></div>}{detailed&&!placing(r)&&realmScore(r)&&<div className="rv-progress" aria-label={`${realm(r)}段位分 ${realmScore(r).score}，境界进度 ${realmScore(r).progressPercent}%`}><span className="rv-progress-track" aria-hidden="true"><span style={{width:realmScore(r).progressPercent+'%'}}/></span><span>段位分 {realmScore(r).score??1000} · {realmScore(r).progressPercent}%</span></div>}<small>{r.games}局计分 · {r.wins}胜 {r.losses}负</small>{detailed&&r.total!==r.games&&<small>实际比赛 {r.total} 局</small>}</div>
    <div className="ranking-result"><strong>{r.points}<span> 分</span></strong>{!!r.pendingGames&&<small>含进行中 {signed(r.pendingPoints)}</small>}<small>{r.games?Math.round(r.rate*100)+'% 胜率':annual?'本年暂无计分赛':'本季度暂无计分赛'}</small>{detailed&&<small>局均净胜 {r.margin.toFixed(1)}</small>}</div>
   </div>)}
   {!rows.length&&<p className="empty" role={pendingPeriod?'status':undefined}>{pendingPeriod?'正在读取'+(annual?year+'年度':quarterLabel(quarter))+'榜单…':singles?scope+'还没有单打比赛成绩。完成一对一单打后即可在这里排名。':'群组还没有启用的球友。'}</p>}{rows.length>0&&!leaders.length&&<p className="hint">{annual?'本年':quarterLabel(quarter)}{singles?'尚无有效单打计分赛。':'尚无有效计分赛，所有球友已在榜单中。'}</p>}
  </section>
  <Disclosure label="积分规则"><section className="rv-calculation" aria-label={annual?'年度积分计算':'季度积分计算'}><strong>{annual?'年度积分 = 本年每个计分小局的赛季积分之和':'季度积分 = 本季度每个计分小局的赛季积分之和'}</strong><p>每局输 {seasonPointsPolicy.loss} 分、赢 {seasonPointsPolicy.win} 分；赢下赛前平均段位分比自己高 {upsets.map(u=>u.gap+' 分以上的对手另加 '+u.bonus+' 分').join('，高 ')}。积分只用于{annual?'本年':'本季度'}排名，不改变段位分和境界；段位分是长期实力，不随季度、年度重置。{singles?'单打榜只统计每方各 1 人的单打小局；群主手动积分调整只计入双打榜。':'双打榜只统计 2 对 2 的双打小局；群主手动积分调整计入指定月份，并汇总到季度、年度双打榜，不改变胜场；群主单独填写的段位分调整会改变段位分和境界。'}</p><p>进行中活动的小局即时计入榜单并标注“含进行中”，活动结束后与境界一起确认；让分局、友谊赛不计积分，只计入实际比赛数。</p><p>按实际开赛时间归属马德里自然{annual?'年':quarterLabel(quarter)}。同分依次比较{annual?'全年':'本季度'}计分小局胜率、局均净胜分，仍相同则并列。</p></section></Disclosure>
 </>;
}
