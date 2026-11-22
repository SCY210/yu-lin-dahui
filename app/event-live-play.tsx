'use client';
import {eventRankingEnabled} from '../lib/domain/event-ranking';
import {liveActivityAvailable,liveAvailabilityTime} from '../lib/domain/live-window';
import {eventFormat,courtPlayers} from '../lib/domain/match-format';
import {useEffect,useState} from 'react';
import {Clock,Play,Pause,RefreshCw,Swords} from 'lucide-react';
import {canRecordScore,canScheduleEvent,canSwapLivePlayers} from '../lib/domain/permissions';
import {livePresentIds,liveResting} from '../lib/domain/live-play';
import {liveLineupSnapshot} from '../lib/domain/live-lineup';
import {editableLiveLineup} from '../lib/domain/round-lineup';
import {plannedPlayStarted} from '../lib/domain/scheduling';
import type {Event,State,Match,Round} from '../lib/domain/types';
import MatchCard from './match-card';
import GroupPlayer from './group-player';
import Disclosure from './disclosure';
import PointsParticipation from './points-participation';
import './event-live-play.css';
import {matchIncludesPlayer} from '../lib/client/match-player-filter';

export default function EventLivePlay({e,ctx}:{e:Event;ctx:any}){
 const {data,send,busy}=ctx,[now,setNow]=useState(Date.now),[selected,setSelected]=useState<{playerId:string;lineup:string}|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),3000);return()=>clearInterval(timer)},[]);
 const manager=!ctx.readOnly&&canScheduleEvent(data.me,e),lineupEditor=!ctx.readOnly&&canSwapLivePlayers(data.me,e),config=e.livePlay;
 const eventMatches:Match[]=data.matches.filter((m:Match)=>m.eventId===e.id);
 const playerId:string=ctx.matchPlayerId??'';
 const current=eventMatches.filter(m=>m.status==='playing');
 const present=livePresentIds(data as State,e,now);
 const active=liveActivityAvailable(e,now),hasStarted=now>=e.start,at=liveAvailabilityTime(e,now);
 // 开始比赛 (pointsPlay) starts every court's first game at once; until then nobody's 开始组队 starts one (docs/LIVE_PLAY.md).
 const started=plannedPlayStarted(data,e),canStart=!ctx.readOnly&&(manager||canRecordScore(data,data.me,e));
 // Courts keep their place (1号场 left, 2号场 right) whether they are playing or waiting for the next game.
 type Court=State['bookings'][number];
 const courtKey=(b?:Court)=>b?(b.venue??e.venue)+'/'+b.name:'';
 const courtOrder=(a:Court,b:Court)=>(a.venue??e.venue).localeCompare(b.venue??e.venue,'zh-CN')||a.name.localeCompare(b.name,'zh-CN',{numeric:true});
 const courts:Court[]=data.bookings.filter((b:Court)=>b.eventId===e.id&&b.start<=at&&b.end>at)
  .filter((b:Court,i:number,all:Court[])=>all.findIndex(c=>courtKey(c)===courtKey(b))===i).sort(courtOrder);
 const matchCourt=(m:Match)=>data.bookings.find((b:Court)=>b.id===m.courtId);
 const waitingCourts:State['bookings']=playerId?[]:courts.filter((booking:State['bookings'][number])=>!current.some(match=>{const court=data.bookings.find((item:State['bookings'][number])=>item.id===match.courtId);return court?.name===booking.name&&(court.venue??e.venue)===(booking.venue??e.venue)}));
 const history=eventMatches.filter(m=>['complete','forfeit'].includes(m.status)&&m.start!==null&&matchIncludesPlayer(m,playerId)).slice().reverse();
 // Games withdrawn on their own (a late player, a no-show). Those of a whole cancelled round, for example when the way
 // of scheduling changed, are listed once under 已撤销轮次 (app/event-scheduling.tsx).
 const cancelledRounds=new Set(data.rounds.filter((r:Round)=>r.eventId===e.id&&r.status==='cancelled').map((r:Round)=>r.id));
 const cancelled=eventMatches.filter(m=>m.status==='cancelled'&&!cancelledRounds.has(m.roundId)&&matchIncludesPlayer(m,playerId));
 const playingIds=new Set(current.flatMap(m=>[...m.a,...m.b]));
 // Swapping works like a planned round: tap a player, then the one to trade places with (partner, waiting player or
 // a player on another court). The selection belongs to the exact lineup it was made on.
 const lineup=JSON.stringify(liveLineupSnapshot(data,e.id)),fixed=e.pointsChoice?.selectedMode==='fixed';
 const changeable=lineupEditor&&!!config?.enabled&&active&&hasStarted&&!fixed;
 const bench=present.filter(id=>!playingIds.has(id));
 const swappableBench=bench.filter(id=>!liveResting(e,id));
 const onCourt=(id:string)=>current.some(m=>[...m.a,...m.b].includes(id)&&editableLiveLineup(e,data.rounds.find((r:Round)=>r.id===m.roundId),m));
 const currentSelected=changeable&&selected&&selected.lineup===lineup&&(onCourt(selected.playerId)||swappableBench.includes(selected.playerId))?selected:null;
 // 开始组队 on a court that is waiting (liveNext): anyone signed up, the organiser or an administrator; after the scheduled
 // end only the organisers (overtime). When only the players of the last game here are available, the button keeps them
 // on purpose instead.
 const scorer=!ctx.readOnly&&active&&hasStarted&&!!config?.enabled&&!config.paused&&(lineupEditor||now<e.end&&canRecordScore(data,data.me,e));
 const nextGame=(b:State['bookings'][number])=>{
  const same=(m:Match)=>{const c=data.bookings.find((x:State['bookings'][number])=>x.id===m.courtId);return c?.name===b.name&&(c.venue??e.venue)===(b.venue??e.venue)};
  const last=eventMatches.filter(m=>same(m)&&m.start!==null&&['complete','forfeit','cancelled'].includes(m.status)).sort((x,y)=>(y.end??y.start!)-(x.end??x.start!))[0];
  const previous=new Set(last?[...last.a,...last.b]:[]);
  const available=present.filter(id=>!playingIds.has(id)&&!liveResting(e,id,b.venue??e.venue));
  return {can:scorer,first:!last,enough:available.length>=courtPlayers(e),onlySame:eventFormat(e)==='singles'&&!!last&&available.length>=courtPlayers(e)&&available.every(id=>previous.has(id))};
 };
 const swap=(id:string)=>{
  if(!currentSelected||currentSelected.playerId===id||(!onCourt(id)&&!onCourt(currentSelected.playerId))){setSelected(currentSelected?.playerId===id?null:{playerId:id,lineup});return}
  send('liveSwap',{eventId:e.id,p1:currentSelected.playerId,p2:id,expectedLineup:JSON.parse(lineup)});setSelected(null);
 };
 return <div className="live-play">
  {selected&&!currentSelected&&<p className="connection-note" role="status">上场人员已更新，请重新选择要交换的两位球友。</p>}
  {playerId&&!current.some(m=>matchIncludesPlayer(m,playerId))&&!history.length&&<p className="match-filter-empty">这位球友暂时没有对局，轮休不算参赛。</p>}
  {active&&hasStarted&&now<e.end&&!started&&canStart&&<section className="card planned-play-start" aria-label="开始比赛"><div><strong>场地已备好，静候开战</strong><p className="hint">道友到齐后点「开始比赛」，各片场同时开打第一局；之后每片场打完再点「开始组队」。</p></div><button type="button" className="primary" disabled={busy} onClick={()=>send('pointsPlay',{eventId:e.id})}><Swords size={17}/>开始比赛</button></section>}
  {/* 对局台: always open and unlike the folding sections around it. Before the start time it is calm, not the red
      in-progress style, so it does not look like play has begun. */}
  <section className={'live-board-card'+(active&&started?' is-playing':active?' is-waiting':' is-ended')} aria-label="当前对局">
   <header className="live-board-head"><strong>{active&&started?'当前对局':active?'对局':'活动已结束'}</strong><span className="live-board-state">{active&&!hasStarted?<><Clock size={14} aria-hidden="true"/>未到开始时间</>:active&&!started?'等待开始比赛':active?<>{current.length>0&&<i className="live-board-dot" aria-hidden="true"/>}{current.length} 场待录分</>:current.length?current.length+' 场未录分':'全部已录分'}</span></header>
   <p className="hint">{!current.length&&!courts.length?'目前没有可用场地。活动进行期间，创建者可安排空闲场地。':courts.length+' 片场地 · '+current.length+' 场进行中'+(waitingCourts.length?' · '+waitingCourts.length+' 片等待下一局':'')}</p>
   <div className="courts-grid live-current-courts">{[...courts.map(b=>({key:courtKey(b),booking:b as Court|undefined,match:current.find(m=>courtKey(matchCourt(m))===courtKey(b))})),...current.filter(m=>!courts.some(b=>courtKey(b)===courtKey(matchCourt(m)))).map(m=>({key:m.id,booking:undefined,match:m as Match|undefined}))].map(({key,booking:b,match:m})=>m?(matchIncludesPlayer(m,playerId)&&<MatchCard key={key} m={m} ctx={ctx} interactive={changeable} selected={currentSelected?.playerId??''} onSelect={swap}/>):b&&waitingCourts.includes(b)&&(()=>{const next=nextGame(b);return <section className="card live-court-waiting" key={key}><h3>{b.name}</h3><strong>{config?.paused?'已暂停排场':!started?'等待开始比赛':next.first?'等待开局':'等待下一局'}</strong><p className="hint">{!started?'点上面的「开始比赛」后，各片场同时开打第一局。':next.first?'第一局也由人点“开始组队”开打，不会自动开始。':eventFormat(e)==='doubles'?'四人都下场，等得最久的先上；没有替补也可由原班人马继续打。':'场下球友优先；仅剩原班人马时可选择继续。'}</p>{next.can&&started&&<div className="actions"><button type="button" className="primary" disabled={busy||!next.enough} onClick={()=>send('liveNext',{eventId:e.id,courtId:b.id,...(next.onlySame?{allowSame:true}:{})})}>{next.onlySame?'继续原班人马':'开始组队'}</button></div>}{next.can&&started&&!next.enough&&<p className="hint">可上场的人数不足 {courtPlayers(e)} 人。</p>}</section>})())}</div>
   {!playerId&&bench.length>0&&<div className="rest"><strong>场下球友 · {bench.length} 人</strong><div className="actions">{bench.map(id=><GroupPlayer key={id} id={id} ctx={ctx} interactive={changeable&&swappableBench.includes(id)} selected={currentSelected?.playerId??''} onSelect={swap}/>)}</div></div>}
  </section>
  {/* The organiser's live controls, then 上场意愿, sit above the finished games like the planned schedule's (app/event-scheduling.tsx). */}
  {manager&&active&&hasStarted&&(started||now>=e.end)&&<section className="schedule-scroll" aria-label="实时排场">
   <header><strong>实时排场</strong><span className="badge">{config?.paused?'排场暂停':config?.enabled?'自动同步':'尚未开始排场'}</span></header>
   <div className="schedule-scroll-actions">{!config?.enabled&&<button type="button" className="primary" disabled={busy} onClick={()=>send('liveStart',{eventId:e.id})}><Play size={17}/>开始实时排场</button>}
    {config?.enabled&&<>
     <button type="button" className="secondary" disabled={busy} onClick={()=>send('livePause',{eventId:e.id,paused:!config.paused})}>{config.paused?<Play size={17}/>:<Pause size={17}/>} {config.paused?'恢复自动排场':'暂停自动排场'}</button>
     {!config.paused&&<button type="button" className="ghost" disabled={busy} onClick={()=>send('liveStart',{eventId:e.id})}><RefreshCw size={16}/>安排空闲场地</button>}
    </>}</div>
   {now>=e.end&&<p className="hint">已过预约结束时间，仍可手动组队；沿用最后时段的接龙名单，预约和费用时长保持不变。</p>}
  </section>}
  <PointsParticipation e={e} ctx={ctx}/>
  <Disclosure label={`已完成${eventRankingEnabled(e)?'积分赛':'普通对局'} · ${history.length} 局`} defaultOpen={!!playerId||!active}>{()=><><div className="courts-grid completed-points-matches">{history.map(m=><MatchCard key={m.id} m={m} ctx={ctx}/>)}</div>{!history.length&&<p className="hint">暂无已完成对局。</p>}</>}</Disclosure>
  {!!cancelled.length&&<Disclosure label={`已撤销对局 · ${cancelled.length} 局`}>{()=><div className="courts-grid">{cancelled.map(m=><MatchCard key={m.id} m={m} ctx={ctx}/>)}</div>}</Disclosure>}
 </div>;
}
