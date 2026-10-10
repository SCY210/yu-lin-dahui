'use client';
import {useEffect,useState} from 'react';
import {ClipboardList,Trophy,Radio,CalendarClock,UserCheck} from 'lucide-react';
import type {ClubData} from '../lib/contracts/club';
import {courtLine,homeTodos,liveActivities,recentlyEnded} from '../lib/client/home-today';
import {hm} from './form-fields';
import './home-today.css';

type Tab='overview'|'rounds'|'fees'|'social';
/** Home "today": things to do, running activities (one highlighted card each) and activities that just ended. */
export default function HomeToday({data,onOpen,onBrowse,hasUnpaid}:{data:ClubData;onOpen:(eventId:string,tab:Tab)=>void;onBrowse:()=>void;hasUnpaid:boolean}){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{
  const update=()=>setNow(Date.now()),timer=setInterval(update,15000);
  document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update)};
 },[]);
 const name=(id:string)=>data.players.find(p=>p.id===id)?.name??'球友';
 const team=(ids:string[])=>ids.map(name).join(' / ');
 const todos=homeTodos(data,now),live=liveActivities(data,now),ended=recentlyEnded(data,now);
 const icons={score:ClipboardList,signup:CalendarClock,promoted:UserCheck};
 return <>
  {todos.length>0&&<section className="card home-todos" aria-label="需要你处理">
   <h2>需要你处理</h2>
   {todos.map(t=>{const Icon=icons[t.kind];return <button type="button" className="home-todo" key={t.kind+t.eventId} onClick={()=>onOpen(t.eventId,t.tab)}><Icon size={18} aria-hidden="true"/><span><strong>{t.title}</strong><small>{t.detail}</small></span><span aria-hidden="true">›</span></button>})}
  </section>}
  {live.map(({event,matches,myMatch,registered})=><section className="card home-live-activity" key={event.id} aria-label={event.title+' 进行中'}>
   <div className="home-live-head"><span className="home-live-badge"><span className="home-live-dot" aria-hidden="true"/>进行中</span><small>{hm(event.start)}–{hm(event.end)} · {event.venue}</small></div>
   <h2>{event.title}</h2>
   {myMatch?<div className="home-live-mine"><Radio size={18} aria-hidden="true"/><span><strong>{courtLine(myMatch.court?.name)}</strong><small>{myMatch.partners.length?'你和 '+team(myMatch.partners):'你'} 对阵 {team(myMatch.opponents)}</small></span></div>
    :registered&&<p className="hint">{matches.length?'你这一轮轮休，留意下一轮安排。':'还没有开始排场，稍后查看分组。'}</p>}
   {matches.length>0&&<ul className="home-live-courts">{matches.map(({match,court})=><li key={match.id}><strong>{court?.name??'场地'}</strong><span>{team(match.a)} <em>对阵</em> {team(match.b)}</span></li>)}</ul>}
   <button type="button" className="primary" onClick={()=>onOpen(event.id,'rounds')}>查看本场对局</button>
  </section>)}
  {ended.map(({event,canVote,voted})=><section className={'card home-ended'+(canVote&&!voted?' needs-vote':'')} key={event.id}>
   <div className="home-live-head"><span className="badge">刚结束</span><small>{hm(event.end)} 结束 · {event.venue}</small></div>
   <h2>{event.title}</h2>
   {canVote&&!voted?<><p className="hint">比赛结束了，选出本场 MVP 吧。</p><button type="button" className="primary" onClick={()=>onOpen(event.id,'social')}><Trophy size={17} aria-hidden="true"/> 去投 MVP</button></>
    :<button type="button" className="secondary" onClick={()=>onOpen(event.id,'social')}>{voted?'已投票 · 看看结果':'查看本场结果'}</button>}
  </section>)}
  {!todos.length&&!live.length&&!ended.length&&!hasUnpaid&&<section className="card home-quiet"><p>现在没有进行中的活动。</p><button type="button" className="secondary" onClick={onBrowse}>查看全部活动</button></section>}
 </>;
}
