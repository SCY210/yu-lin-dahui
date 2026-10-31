'use client';
import {eventRankingEnabled} from '../lib/domain/event-ranking';
import {liveActivityAvailable,liveAvailabilityTime} from '../lib/domain/live-window';
import {matchingStopped} from '../lib/domain/matching-participation';
import {eventFormat,courtPlayers} from '../lib/domain/match-format';
import {useEffect,useState} from 'react';
import {Play,Pause,RefreshCw} from 'lucide-react';
import {canRecordScore,canScheduleEvent,canSwapLivePlayers} from '../lib/domain/permissions';
import {liveAppearances,livePresentIds,liveResting,liveMandatoryRest} from '../lib/domain/live-play';
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
 const manager=!ctx.readOnly&&canScheduleEvent(data.me,e),lineupEditor=!ctx.readOnly&&canSwapLivePlayers(data,data.me,e),config=e.livePlay;
 const eventMatches:Match[]=data.matches.filter((m:Match)=>m.eventId===e.id);
 const playerId:string=ctx.matchPlayerId??'';
 const current=eventMatches.filter(m=>m.status==='playing');
 const present=livePresentIds(data as State,e,now);
 const roster:Registration[]=data.registrations.filter((r:Registration)=>r.eventId===e.id&&r.status==='confirmed'&&data.players.some((p:Player)=>p.id===r.playerId&&p.enabled));
 const active=liveActivityAvailable(e,now),hasStarted=now>=e.start,at=liveAvailabilityTime(e,now);
 // Courts keep their place (1号场 left, 2号场 right) whether they are playing or waiting for the next game.
 type Court=State['bookings'][number];
 const courtKey=(b?:Court)=>b?(b.venue??e.venue)+'/'+b.name:'';
 const courtOrder=(a:Court,b:Court)=>(a.venue??e.venue).localeCompare(b.venue??e.venue,'zh-CN')||a.name.localeCompare(b.name,'zh-CN',{numeric:true});
 const courts:Court[]=data.bookings.filter((b:Court)=>b.eventId===e.id&&b.start<=at&&b.end>at)
  .filter((b:Court,i:number,all:Court[])=>all.findIndex(c=>courtKey(c)===courtKey(b))===i).sort(courtOrder);
 const matchCourt=(m:Match)=>data.bookings.find((b:Court)=>b.id===m.courtId);
 const waitingCourts:State['bookings']=playerId?[]:courts.filter((booking:State['bookings'][number])=>!current.some(match=>{const court=data.bookings.find((item:State['bookings'][number])=>item.id===match.courtId);return court?.name===booking.name&&(court.venue??e.venue)===(booking.venue??e.venue)}));
 const history=eventMatches.filter(m=>['complete','forfeit'].includes(m.status)&&m.start!==null&&matchIncludesPlayer(m,playerId)).slice().reverse();
 const cancelled=eventMatches.filter(m=>m.status==='cancelled'&&matchIncludesPlayer(m,playerId));
 const playingIds=new Set(current.flatMap(m=>[...m.a,...m.b]));
 // Swapping works like a planned round: tap a player, then the one to trade places with (partner, waiting player or
 // a player on another court). The selection belongs to the exact lineup it was made on.
 const lineup=JSON.stringify(liveLineupSnapshot(data,e.id)),fixed=e.pointsChoice?.selectedMode==='fixed';
 const changeable=lineupEditor&&!!config?.enabled&&active&&hasStarted&&!fixed;
 const bench=present.filter(id=>!playingIds.has(id)&&!liveResting(e,id));
 const onCourt=(id:string)=>current.some(m=>[...m.a,...m.b].includes(id)&&editableLiveLineup(e,data.rounds.find((r:Round)=>r.id===m.roundId),m));
 const currentSelected=changeable&&selected&&selected.lineup===lineup&&(onCourt(selected.playerId)||bench.includes(selected.playerId))?selected:null;
 // 开始组队 on a court that is waiting (liveNext): anyone signed up, the organiser or an administrator. When only the
 // players of the last game here are available, the button keeps them on purpose instead.
 const scorer=!ctx.readOnly&&active&&hasStarted&&!!config?.enabled&&!config.paused&&(manager||canRecordScore(data,data.me,e));
 const nextGame=(b:State['bookings'][number])=>{
  const same=(m:Match)=>{const c=data.bookings.find((x:State['bookings'][number])=>x.id===m.courtId);return c?.name===b.name&&(c.venue??e.venue)===(b.venue??e.venue)};
  const last=eventMatches.filter(m=>same(m)&&m.start!==null&&['complete','forfeit','cancelled'].includes(m.status)).sort((x,y)=>(y.end??y.start!)-(x.end??x.start!))[0];
  const previous=new Set(last?[...last.a,...last.b]:[]);
  const available=present.filter(id=>!playingIds.has(id)&&!liveResting(e,id,b.venue??e.venue));
  return {can:scorer,enough:available.length>=courtPlayers(e),onlySame:eventFormat(e)==='singles'&&!!last&&available.length>=courtPlayers(e)&&available.every(id=>previous.has(id))};
 };
 const swap=(id:string)=>{
  if(!currentSelected||currentSelected.playerId===id||(!onCourt(id)&&!onCourt(currentSelected.playerId))){setSelected(currentSelected?.playerId===id?null:{playerId:id,lineup});return}
  send('liveSwap',{eventId:e.id,p1:currentSelected.playerId,p2:id,expectedLineup:JSON.parse(lineup)});setSelected(null);
 };
 const playerRow=(r:Registration)=>{
    const player=data.players.find((p:Player)=>p.id===r.playerId),own=manager||r.playerId===data.me.playerId||player?.ownerId===data.me.id;
    const stopped=matchingStopped(e,r.playerId),resting=liveResting(e,r.playerId),mandatory=liveMandatoryRest(e,r.playerId),preference=config?.preferences.find(p=>p.playerId===r.playerId)?.avoidConsecutive??false;
    return <div className="live-player-row" key={r.playerId}><div><strong>{name(r.playerId)}</strong><span>{liveAppearances(data,e.id,r.playerId)} 次上场 · {playingIds.has(r.playerId)?(stopped?'本局后不再上场':'场上对局'):stopped?'本次不再上场':!present.includes(r.playerId)?'尚未到参加时段':resting?(mandatory?'两连胜，轮休一局':'轮休中'):'等待上场'}</span></div><div className="live-player-controls">{own&&active&&now<e.end&&<button className="secondary" type="button" disabled={busy} onClick={()=>send('pointsParticipation',{eventId:e.id,playerId:r.playerId,playing:stopped})}>{stopped?'恢复排场':'不再上场'}</button>}<label><input type="checkbox" checked={preference} disabled={!own||busy||!active} onChange={ev=>send('livePreference',{eventId:e.id,playerId:r.playerId,avoidConsecutive:ev.target.checked})}/>不连续上场</label>{!stopped&&resting&&!mandatory&&own&&!playingIds.has(r.playerId)&&active&&<button className="secondary" type="button" disabled={busy} onClick={()=>send('liveReady',{eventId:e.id,playerId:r.playerId})}>休息好了</button>}</div></div>; };
 return <div className="live-play">
  <details className="card scheduling-controls live-play-header" open><summary className="scheduling-controls-summary"><strong>实时排场</strong><span className="badge">{!active?'活动已结束':config?.paused?'排场暂停':config?.enabled?'自动同步':'尚未开始排场'}</span><span>管理</span></summary>
   <p className="hint">每片场地独立推进：录入比分结束本局，再点“开始组队”安排下一局。{eventFormat(e)==='doubles'?'胜者留场，与场下补位球友按原匹配方式组队，水平接近时优先换搭档，差距较大时优先平衡，胜者也可以继续搭档；连续留场赢两局后必须轮休一局，之后自动恢复候选；优先安排等待较久的球友，替补不足时等待。':'优先安排场下球友，按上场次数和等待时间轮换。'}每场{courtPlayers(e)}人。</p>
   {manager&&active&&hasStarted&&<div className="actions">
    {!config?.enabled&&<button type="button" className="primary" disabled={busy} onClick={()=>send('liveStart',{eventId:e.id})}><Play size={17}/>开始实时排场</button>}
    {config?.enabled&&<>
     <button type="button" className="secondary" disabled={busy} onClick={()=>send('livePause',{eventId:e.id,paused:!config.paused})}>{config.paused?<Play size={17}/>:<Pause size={17}/>} {config.paused?'恢复自动排场':'暂停自动排场'}</button>
     {!config.paused&&<button type="button" className="ghost" disabled={busy} onClick={()=>send('liveStart',{eventId:e.id})}><RefreshCw size={16}/>安排空闲场地</button>}
    </>}
   </div>}
   {!config?.enabled&&now<e.end&&<p className="hint">到活动开始时间自动排场。已有正在打的比赛会继续，人数不足时等待可上场球友。</p>}
   {!hasStarted&&active&&<p className="hint">到活动开始时间自动排场。已开始的对局仍可正常录入结果。</p>}
   {active&&now>=e.end&&<p className="hint">已过预约结束时间，仍可手动组队；沿用最后时段的接龙名单，预约和费用时长保持不变。</p>}
  </details>
  {selected&&!currentSelected&&<p className="connection-note" role="status">上场人员已更新，请重新选择要交换的两位球友。</p>}
  {playerId&&!current.some(m=>matchIncludesPlayer(m,playerId))&&!history.length&&<p className="match-filter-empty">这位球友暂时没有对局，轮休不算参赛。</p>}
  <Disclosure className={'round-disclosure live-current'+(active?' is-playing':'')} defaultOpen label={active?'当前对局 · '+current.length+' 场待录分':'活动已结束'+(current.length?' · '+current.length+' 场未录分':'')}>
   <p className="hint">{courts.length} 片场地 · {current.length} 场进行中{waitingCourts.length?' · '+waitingCourts.length+' 片等待下一局':''}</p>
   <div className="courts-grid live-current-courts">{[...courts.map(b=>({key:courtKey(b),booking:b as Court|undefined,match:current.find(m=>courtKey(matchCourt(m))===courtKey(b))})),...current.filter(m=>!courts.some(b=>courtKey(b)===courtKey(matchCourt(m)))).map(m=>({key:m.id,booking:undefined,match:m as Match|undefined}))].map(({key,booking:b,match:m})=>m?(matchIncludesPlayer(m,playerId)&&<MatchCard key={key} m={m} ctx={ctx} interactive={changeable} selected={currentSelected?.playerId??''} onSelect={swap}/>):b&&waitingCourts.includes(b)&&(()=>{const next=nextGame(b);return <section className="card live-court-waiting" key={key}><h3>{b.name}</h3><strong>{config?.paused?'已暂停排场':'等待下一局'}</strong><p className="hint">{!config?.enabled?'到活动开始时间自动显示对局。':eventFormat(e)==='doubles'?'胜者优先留场，连赢两局必须下场轮休一局；替补不足时等待。':'场下球友优先；仅剩原班人马时可选择继续。'}</p>{next.can&&<div className="actions"><button type="button" className="primary" disabled={busy||!next.enough} onClick={()=>send('liveNext',{eventId:e.id,courtId:b.id,...(next.onlySame?{allowSame:true}:{})})}>{next.onlySame?'继续原班人马':'开始组队'}</button></div>}{next.can&&!next.enough&&<p className="hint">可上场的人数不足 {courtPlayers(e)} 人。</p>}</section>})())}</div>
   <details className="round-lineup-help"><summary>实时对局{changeable?' · 换人说明':' · 说明'}</summary><p className="hint">{changeable?'点击两位球友旁的交换图标换人：可交换同场搭档、与场下球友交换，或与另一片场地的球友交换。录入比分前随时可换，只调整当前对局，下一局仍按轮换安排。':fixed?'固定搭档不能单局交换成员。':'录入比分即结束本局，再点“开始组队”安排下一局。'}</p></details>
   {!playerId&&<div className="rest"><strong>场下球友 · {bench.length} 人</strong><div className="actions">{bench.map(id=><GroupPlayer key={id} id={id} ctx={ctx} interactive={changeable} selected={currentSelected?.playerId??''} onSelect={swap}/>)}</div></div>}
  </Disclosure>
  {!current.length&&!courts.length&&<p className="empty">目前没有可用场地。活动进行期间，创建者可安排空闲场地。</p>}
  {roster.some(r=>r.playerId===data.me.playerId)&&<section className="card live-my-rest"><h3>我的上场与轮休</h3>{roster.filter(r=>r.playerId===data.me.playerId).map(playerRow)}</section>}
  <Disclosure label={'其他球友上场与轮休 · '+roster.filter(r=>r.playerId!==data.me.playerId).length+'人'}>{()=><section className="card live-rotation-roster"><p className="hint">两连胜后必须轮休一局，下一局结束后自动恢复候选。主动轮休可点“休息好了”；两连胜轮休不可提前结束。</p>{roster.filter(r=>r.playerId!==data.me.playerId).map(playerRow)}</section>}</Disclosure>
  <Disclosure label={`已完成${eventRankingEnabled(e)?'积分赛':'普通对局'} · ${history.length} 局`} defaultOpen={!!playerId||!active}>{()=><><div className="courts-grid completed-points-matches">{history.map(m=><MatchCard key={m.id} m={m} ctx={ctx}/>)}</div>{!history.length&&<p className="hint">暂无已完成对局。</p>}</>}</Disclosure>
  {!!cancelled.length&&<Disclosure label={`已撤销对局 · ${cancelled.length} 局`}>{()=><div className="courts-grid">{cancelled.map(m=><MatchCard key={m.id} m={m} ctx={ctx}/>)}</div>}</Disclosure>}
  <Disclosure label={eventFormat(e)==='singles'?'单打轮转':'搭档方式与投票'}><Deferred><EventPointsPlan e={e} ctx={ctx} planning/></Deferred></Disclosure>
 </div>;
}
