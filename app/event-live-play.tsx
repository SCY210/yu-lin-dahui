'use client';
import {eventFormat,courtPlayers} from '../lib/domain/match-format';
import {useEffect,useState} from 'react';
import {Play,Pause,RefreshCw} from 'lucide-react';
import {canManageEvent} from '../lib/domain/permissions';
import {liveAppearances,livePresentIds,liveResting} from '../lib/domain/live-play';
import type {Event,State,Match,Registration,Player} from '../lib/domain/types';
import MatchCard from './match-card';
import Disclosure from './disclosure';
import Deferred from './deferred';
import EventPointsPlan from './event-points-plan';
import './event-live-play.css';

export default function EventLivePlay({e,ctx}:{e:Event;ctx:any}){
 const {data,name,send,busy}=ctx,[now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),3000);return()=>clearInterval(timer)},[]);
 const manager=canManageEvent(data.me,e),config=e.livePlay;
 const eventMatches:Match[]=data.matches.filter((m:Match)=>m.eventId===e.id);
 const current=eventMatches.filter(m=>m.status==='playing');
 const present=livePresentIds(data as State,e,now);
 const roster:Registration[]=data.registrations.filter((r:Registration)=>r.eventId===e.id&&r.status==='confirmed'&&data.players.some((p:Player)=>p.id===r.playerId&&p.enabled));
 const active=!['ended','cancelled','draft'].includes(e.status),inWindow=now>=e.start&&now<e.end;
 const courts=data.bookings.filter((b:any)=>b.eventId===e.id&&b.start<=now&&b.end>now)
  .filter((b:any,i:number,all:any[])=>all.findIndex(c=>c.name===b.name&&(c.venue??e.venue)===(b.venue??e.venue))===i);
 const history=eventMatches.filter(m=>['complete','forfeit','cancelled'].includes(m.status)&&m.start!==null).slice().reverse();
 const playingIds=new Set(current.flatMap(m=>[...m.a,...m.b]));
 const playerRow=(r:Registration)=>{
    const player=data.players.find((p:Player)=>p.id===r.playerId),own=manager||r.playerId===data.me.playerId||player?.ownerId===data.me.id;
    const resting=liveResting(e,r.playerId),preference=config?.preferences.find(p=>p.playerId===r.playerId)?.avoidConsecutive??false;
    return <div className="live-player-row" key={r.playerId}><div><strong>{name(r.playerId)}</strong><span>{liveAppearances(data,e.id,r.playerId)} 次上场 · {playingIds.has(r.playerId)?'场上对局':!present.includes(r.playerId)?'尚未到参加时段':resting?'轮休中':'等待上场'}</span></div><div className="live-player-controls"><label><input type="checkbox" checked={preference} disabled={!own||busy||!active} onChange={ev=>send('livePreference',{eventId:e.id,playerId:r.playerId,avoidConsecutive:ev.target.checked})}/>不连续上场</label>{resting&&own&&!playingIds.has(r.playerId)&&active&&<button className="secondary" type="button" disabled={busy} onClick={()=>send('liveReady',{eventId:e.id,playerId:r.playerId})}>休息好了</button>}</div></div>; };
 return <div className="live-play">
  <section className="card live-play-header"><div className="row"><h2>当前对局</h2><span className="badge">{config?.paused?'排场暂停':config?.enabled?'自动同步':'尚未开始排场'}</span></div>
   <p className="hint">每片场地独立推进，录入比分即结束本局并安排下一局。优先安排上场次数少、等待更久的球友。每场{courtPlayers(e)}人。</p>
   {manager&&active&&<div className="actions">
    {!config?.enabled?<button type="button" className="primary" disabled={busy||!inWindow} onClick={()=>send('liveStart',{eventId:e.id})}><Play size={17}/>开始实时排场</button>:<>
     <button type="button" className="secondary" disabled={busy} onClick={()=>send('livePause',{eventId:e.id,paused:!config.paused})}>{config.paused?<Play size={17}/>:<Pause size={17}/>} {config.paused?'恢复自动排场':'暂停自动排场'}</button>
     {!config.paused&&<button type="button" className="ghost" disabled={busy||!inWindow} onClick={()=>send('liveStart',{eventId:e.id})}><RefreshCw size={16}/>安排空闲场地</button>}
    </>}
   </div>}
   {!config?.enabled&&<p className="hint">由创建者或管理员开始排场。已有正在打的比赛会继续；尚未开打的预排改为实时轮换。</p>}
   {!inWindow&&active&&<p className="hint">请在活动进行时开始排场。已开始的对局仍可正常录入结果。</p>}
  </section>
  <div className="courts-grid live-current-courts">{current.map(m=>{
   const round=data.rounds.find((r:any)=>r.id===m.roundId);
   return <section key={m.id} className="live-court"><h3>{data.bookings.find((b:any)=>b.id===m.courtId)?.name??'场地'} · 第 {round?.liveSequence??1} 轮</h3><MatchCard m={m} ctx={ctx}/></section>;
  })}{courts.filter((b:any)=>!current.some(m=>{const court=data.bookings.find((x:any)=>x.id===m.courtId);return court?.name===b.name&&(court.venue??e.venue)===(b.venue??e.venue)})).map((b:any)=><section className="card live-court-waiting" key={b.id}><h3>{b.name}</h3><strong>{config?.paused?'已暂停排场':'等待下一局'}</strong><p className="hint">{config?.enabled?'可上场人数或完整固定搭档不足时保持等待，尊重轮休选择。球友准备好后可点击“休息好了”。':'开始实时排场后显示对局。'}</p></section>)}</div>
  {!current.length&&!courts.length&&<p className="empty">目前没有可用场地。活动进行期间，创建者可安排空闲场地。</p>}
  {roster.some(r=>r.playerId===data.me.playerId)&&<section className="card live-my-rest"><h3>我的上场与轮休</h3>{roster.filter(r=>r.playerId===data.me.playerId).map(playerRow)}</section>}
  <Disclosure label={'其他球友上场与轮休 · '+roster.filter(r=>r.playerId!==data.me.playerId).length+'人'}><section className="card live-rotation-roster"><p className="hint">不连续上场的球友先轮休一局，休息好后可以恢复。</p>{roster.filter(r=>r.playerId!==data.me.playerId).map(playerRow)}</section></Disclosure>
  <Disclosure label={`已完成对局 · ${history.length} 局`}><div>{history.map(m=><MatchCard key={m.id} m={m} ctx={ctx}/>)}</div></Disclosure>
  <Disclosure label={eventFormat(e)==='singles'?'单打轮转':'搭档方式与投票'}><Deferred><EventPointsPlan e={e} ctx={ctx} planning/></Deferred></Disclosure>
 </div>;
}
