'use client';
import {eventRankingEnabled} from '../lib/domain/event-ranking';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {matchingStopped} from '../lib/domain/matching-participation';
import {eventFormat,courtPlayers} from '../lib/domain/match-format';
import {useEffect,useState} from 'react';
import {Play,Pause,RefreshCw} from 'lucide-react';
import {canRecordScore,canScheduleEvent} from '../lib/domain/permissions';
import {liveAppearances,livePresentIds,liveResting} from '../lib/domain/live-play';
import {liveLineupSnapshot} from '../lib/domain/live-lineup';
import {editableLiveLineup} from '../lib/domain/round-lineup';
import type {Event,State,Match,Registration,Player,Round} from '../lib/domain/types';
import MatchCard from './match-card';
import GroupPlayer from './group-player';
import Disclosure from './disclosure';
import Deferred from './deferred';
import EventPointsPlan from './event-points-plan';
import './event-live-play.css';
import {matchIncludesPlayer} from '../lib/client/match-player-filter';

export default function EventLivePlay({e,ctx}:{e:Event;ctx:any}){
 const {data,name,send,busy}=ctx,[now,setNow]=useState(Date.now),[selected,setSelected]=useState<{playerId:string;lineup:string}|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),3000);return()=>clearInterval(timer)},[]);
 const manager=canScheduleEvent(data.me,e),config=e.livePlay;
 const eventMatches:Match[]=data.matches.filter((m:Match)=>m.eventId===e.id);
 const playerId:string=ctx.matchPlayerId??'';
 const current=eventMatches.filter(m=>m.status==='playing');
 const present=livePresentIds(data as State,e,now);
 const roster:Registration[]=data.registrations.filter((r:Registration)=>r.eventId===e.id&&r.status==='confirmed'&&data.players.some((p:Player)=>p.id===r.playerId&&p.enabled));
 // The clock ends an activity without rewriting its stored status, so judge by the clock.
 const active=!['ended','cancelled','draft'].includes(eventStatusAt(e,now)),inWindow=now>=e.start&&now<e.end;
 const courts=data.bookings.filter((b:any)=>b.eventId===e.id&&b.start<=now&&b.end>now)
  .filter((b:any,i:number,all:any[])=>all.findIndex(c=>c.name===b.name&&(c.venue??e.venue)===(b.venue??e.venue))===i);
 const waitingCourts:State['bookings']=playerId?[]:courts.filter((booking:State['bookings'][number])=>!current.some(match=>{const court=data.bookings.find((item:State['bookings'][number])=>item.id===match.courtId);return court?.name===booking.name&&(court.venue??e.venue)===(booking.venue??e.venue)}));
 const history=eventMatches.filter(m=>['complete','forfeit'].includes(m.status)&&m.start!==null&&matchIncludesPlayer(m,playerId)).slice().reverse();
 const cancelled=eventMatches.filter(m=>m.status==='cancelled'&&matchIncludesPlayer(m,playerId));
 const playingIds=new Set(current.flatMap(m=>[...m.a,...m.b]));
 // Swapping works like a planned round: tap a player, then the one to trade places with (partner, waiting player or
 // a player on another court). The selection belongs to the exact lineup it was made on.
 const lineup=JSON.stringify(liveLineupSnapshot(data,e.id)),fixed=e.pointsChoice?.selectedMode==='fixed';
 const changeable=manager&&!!config?.enabled&&active&&inWindow&&!fixed;
 const bench=present.filter(id=>!playingIds.has(id)&&!liveResting(e,id));
 const onCourt=(id:string)=>current.some(m=>[...m.a,...m.b].includes(id)&&editableLiveLineup(e,data.rounds.find((r:Round)=>r.id===m.roundId),m));
 const currentSelected=selected&&selected.lineup===lineup&&(onCourt(selected.playerId)||bench.includes(selected.playerId))?selected:null;
 // 开始组队 on a court that is waiting (liveNext): anyone signed up, the organiser or an administrator. When only the
 // players of the last game here are available, the button keeps them on purpose instead.
 const scorer=active&&inWindow&&!!config?.enabled&&!config.paused&&(manager||canRecordScore(data,data.me,e));
 const nextGame=(b:State['bookings'][number])=>{
  const same=(m:Match)=>{const c=data.bookings.find((x:State['bookings'][number])=>x.id===m.courtId);return c?.name===b.name&&(c.venue??e.venue)===(b.venue??e.venue)};
  const last=eventMatches.filter(m=>same(m)&&m.start!==null&&['complete','forfeit','cancelled'].includes(m.status)).sort((x,y)=>(y.end??y.start!)-(x.end??x.start!))[0];
  const available=present.filter(id=>!playingIds.has(id)&&!liveResting(e,id,b.venue??e.venue)),previous=new Set(last?[...last.a,...last.b]:[]);
  return {can:scorer,enough:available.length>=courtPlayers(e),onlySame:!!last&&available.length>=courtPlayers(e)&&available.every(id=>previous.has(id))};
 };
 const swap=(id:string)=>{
  if(!currentSelected||currentSelected.playerId===id||(!onCourt(id)&&!onCourt(currentSelected.playerId))){setSelected(currentSelected?.playerId===id?null:{playerId:id,lineup});return}
  send('liveSwap',{eventId:e.id,p1:currentSelected.playerId,p2:id,expectedLineup:JSON.parse(lineup)});setSelected(null);
 };
 const playerRow=(r:Registration)=>{
    const player=data.players.find((p:Player)=>p.id===r.playerId),own=manager||r.playerId===data.me.playerId||player?.ownerId===data.me.id;
    const stopped=matchingStopped(e,r.playerId),resting=liveResting(e,r.playerId),preference=config?.preferences.find(p=>p.playerId===r.playerId)?.avoidConsecutive??false;
    return <div className="live-player-row" key={r.playerId}><div><strong>{name(r.playerId)}</strong><span>{liveAppearances(data,e.id,r.playerId)} 次上场 · {playingIds.has(r.playerId)?(stopped?'本局后不再上场':'场上对局'):stopped?'本次不再上场':!present.includes(r.playerId)?'尚未到参加时段':resting?'轮休中':'等待上场'}</span></div><div className="live-player-controls">{own&&active&&<button className="secondary" type="button" disabled={busy} onClick={()=>send('pointsParticipation',{eventId:e.id,playerId:r.playerId,playing:stopped})}>{stopped?'恢复排场':'不再上场'}</button>}<label><input type="checkbox" checked={preference} disabled={!own||busy||!active} onChange={ev=>send('livePreference',{eventId:e.id,playerId:r.playerId,avoidConsecutive:ev.target.checked})}/>不连续上场</label>{!stopped&&resting&&own&&!playingIds.has(r.playerId)&&active&&<button className="secondary" type="button" disabled={busy} onClick={()=>send('liveReady',{eventId:e.id,playerId:r.playerId})}>休息好了</button>}</div></div>; };
 return <div className="live-play">
  <details className="card scheduling-controls live-play-header" open><summary className="scheduling-controls-summary"><strong>实时排场</strong><span className="badge">{!active?'活动已结束':config?.paused?'排场暂停':config?.enabled?'自动同步':'尚未开始排场'}</span><span>管理</span></summary>
   <p className="hint">每片场地独立推进，录入比分即结束本局并安排下一局。优先让场下可上场的球友替换刚打完的人，再按上场次数和等待时间均衡安排。每场{courtPlayers(e)}人。</p>
   {manager&&active&&<div className="actions">
    {config?.enabled&&<>
     <button type="button" className="secondary" disabled={busy} onClick={()=>send('livePause',{eventId:e.id,paused:!config.paused})}>{config.paused?<Play size={17}/>:<Pause size={17}/>} {config.paused?'恢复自动排场':'暂停自动排场'}</button>
     {!config.paused&&<button type="button" className="ghost" disabled={busy||!inWindow} onClick={()=>send('liveStart',{eventId:e.id})}><RefreshCw size={16}/>安排空闲场地</button>}
    </>}
   </div>}
   {!config?.enabled&&<p className="hint">到活动开始时间自动排场。已有正在打的比赛会继续，人数不足时等待可上场球友。</p>}
   {!inWindow&&active&&<p className="hint">到活动开始时间自动排场。已开始的对局仍可正常录入结果。</p>}
  </details>
  {selected&&!currentSelected&&<p className="connection-note" role="status">上场人员已更新，请重新选择要交换的两位球友。</p>}
  {playerId&&!current.some(m=>matchIncludesPlayer(m,playerId))&&!history.length&&<p className="match-filter-empty">这位球友暂时没有对局，轮休不算参赛。</p>}
  <Disclosure className={'round-disclosure live-current'+(active?' is-playing':'')} defaultOpen label={active?'当前对局 · '+current.length+' 场待录分':'活动已结束'+(current.length?' · '+current.length+' 场未录分':'')}>
   <p className="hint">{courts.length} 片场地 · {current.length} 场进行中{waitingCourts.length?' · '+waitingCourts.length+' 片等待下一局':''}</p>
   <div className="courts-grid live-current-courts">{current.filter(m=>matchIncludesPlayer(m,playerId)).map(m=><MatchCard key={m.id} m={m} ctx={ctx} interactive={changeable} selected={currentSelected?.playerId??''} onSelect={swap}/>)}{waitingCourts.map(b=>{const next=nextGame(b);return <section className="card live-court-waiting" key={b.id}><h3>{b.name}</h3><strong>{config?.paused?'已暂停排场':'等待下一局'}</strong><p className="hint">{!config?.enabled?'到活动开始时间自动显示对局。':next.onlySame?'场下暂时没有可换的人，可以等另一片场地打完再组队；确实没人可换时再继续原班人马。':'录完分后点“开始组队”：先安排场下等待的人，不够再用刚下场的人，避免同一批人互相换队打。'}</p>{next.can&&<div className="actions"><button type="button" className={next.onlySame?'secondary':'primary'} disabled={busy||!next.enough} onClick={()=>send('liveNext',{eventId:e.id,courtId:b.id,...(next.onlySame?{allowSame:true}:{})})}>{next.onlySame?'继续原班人马':'开始组队'}</button></div>}{next.can&&!next.enough&&<p className="hint">可上场的人数不足 {courtPlayers(e)} 人。</p>}</section>})}</div>
   <details className="round-lineup-help"><summary>实时对局{changeable?' · 换人说明':' · 说明'}</summary><p className="hint">{changeable?'点击两位球友旁的交换图标换人：可交换同场搭档、与场下球友交换，或与另一片场地的球友交换。录入比分前随时可换，只调整当前对局，下一局仍自动轮换。':fixed?'固定搭档不能单局交换成员。':'录入比分即结束本局，并自动安排下一局。'}</p></details>
   {!playerId&&<div className="rest"><strong>场下球友 · {bench.length} 人</strong><div className="actions">{bench.map(id=><GroupPlayer key={id} id={id} ctx={ctx} interactive={changeable} selected={currentSelected?.playerId??''} onSelect={swap}/>)}</div></div>}
  </Disclosure>
  {!current.length&&!courts.length&&<p className="empty">目前没有可用场地。活动进行期间，创建者可安排空闲场地。</p>}
  {roster.some(r=>r.playerId===data.me.playerId)&&<section className="card live-my-rest"><h3>我的上场与轮休</h3>{roster.filter(r=>r.playerId===data.me.playerId).map(playerRow)}</section>}
  <Disclosure label={'其他球友上场与轮休 · '+roster.filter(r=>r.playerId!==data.me.playerId).length+'人'}><section className="card live-rotation-roster"><p className="hint">不连续上场的球友先轮休一局，休息好后可以恢复。</p>{roster.filter(r=>r.playerId!==data.me.playerId).map(playerRow)}</section></Disclosure>
  <Disclosure label={`已完成${eventRankingEnabled(e)?'积分赛':'普通对局'} · ${history.length} 局`} defaultOpen={!!playerId||!active}><div className="courts-grid completed-points-matches">{history.map(m=><MatchCard key={m.id} m={m} ctx={ctx}/>)}</div>{!history.length&&<p className="hint">暂无已完成对局。</p>}</Disclosure>
  {!!cancelled.length&&<Disclosure label={`已撤销对局 · ${cancelled.length} 局`}><div className="courts-grid">{cancelled.map(m=><MatchCard key={m.id} m={m} ctx={ctx}/>)}</div></Disclosure>}
  <Disclosure label={eventFormat(e)==='singles'?'单打轮转':'搭档方式与投票'}><Deferred><EventPointsPlan e={e} ctx={ctx} planning/></Deferred></Disclosure>
 </div>;
}
