'use client';
import {useEffect,useState} from 'react';
import type {ClubData} from '../lib/contracts/club';
import {homeLiveMatches} from '../lib/client/home-live-matches';
import {eventFormat,formatLabel} from '../lib/domain/match-format';
import {Avatar} from './avatar';
import {hm} from './form-fields';
import './home-live-matches.css';

export default function HomeLiveMatches({data,onOpen}:{data:ClubData;onOpen:(eventId:string)=>void}){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{
  const update=()=>setNow(Date.now()),timer=setInterval(update,3000);
  document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);window.addEventListener('pageshow',update);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);window.removeEventListener('pageshow',update)};
 },[]);
 const matches=homeLiveMatches(data,now);
 if(!matches.length)return null;
 const players=new Map(data.players.map(p=>[p.id,p]));
 const name=(id:string)=>players.get(id)?.name??'球友';
 return <section className="home-live-section" aria-label="进行中的比赛">
  <div className="section-title"><h2>进行中的比赛</h2><span className="badge">{matches.length} 场对局</span></div>
  <div className="home-live-grid">{matches.map(({event,match,court,round})=><button type="button" className="home-live-match" key={match.id} onClick={()=>onOpen(event.id)} aria-label={'查看'+event.title+'，'+(court?.name??'场地')+'，'+match.a.map(name).join('、')+'对阵'+match.b.map(name).join('、')}>
   <span className="home-live-meta"><strong>{court?.name??'比赛场地'}{round.liveSequence?' · 第 '+round.liveSequence+' 轮':''}</strong><span className="badge">{formatLabel(eventFormat(event))} · 进行中</span></span>
   <span className="home-live-event">{event.title} · {court?.venue??event.venue}</span>
   <span className="home-live-teams">{[match.a,match.b].map((team,index)=><span className="home-live-team" key={index}>{team.map(id=><span className="home-live-player" key={id}><Avatar p={players.get(id)}/><span>{name(id)}</span></span>)}</span>)}<span className="home-live-versus" aria-hidden="true">对阵</span></span>
   <span className="home-live-footer"><span>{hm(match.start!)} 开局</span><span>查看本场对局</span></span>
  </button>)}</div>
 </section>;
}
