'use client';
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import {ChevronLeft,ChevronRight,MoveHorizontal} from 'lucide-react';
import './player-card-carousel.css';

export default function PlayerCardCarousel({players,activeId,onActiveId,renderCard}:{players:{id:string;name:string}[];activeId:string;onActiveId:(id:string)=>void;renderCard:(player:any)=>ReactNode}){
 const initial=useRef(Math.max(0,players.findIndex(player=>player.id===activeId)));
 const latestActive=useRef(activeId);latestActive.current=activeId;
 const [viewport,api]=useEmblaCarousel({align:'start',loop:false,startIndex:initial.current,dragThreshold:12,breakpoints:{'(min-width:761px)':{active:false}}});
 const [index,setIndex]=useState(initial.current),[mobile,setMobile]=useState(false);
 const [previous,setPrevious]=useState(false),[next,setNext]=useState(players.length>1);
 useEffect(()=>{const query=window.matchMedia('(max-width:760px)'),update=()=>setMobile(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 const select=useCallback(()=>{
  if(!api||!window.matchMedia('(max-width:760px)').matches)return;
  const selected=api.selectedScrollSnap();setIndex(selected);setPrevious(api.canScrollPrev());setNext(api.canScrollNext());
  if(players[selected])onActiveId(players[selected].id);
 },[api,players,onActiveId]);
 useEffect(()=>{
  if(!api)return;
  const restore=()=>{if(window.matchMedia('(max-width:760px)').matches)api.scrollTo(Math.max(0,players.findIndex(player=>player.id===latestActive.current)),true);select()};
  select();api.on('select',select);api.on('reInit',restore);
  return()=>{api.off('select',select);api.off('reInit',restore)};
 },[api,players,select]);
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const move=(direction:'previous'|'next')=>direction==='previous'?api?.scrollPrev(reduced()):api?.scrollNext(reduced());
 return <div className="ps-carousel" role="region" aria-label="球友卡片" aria-roledescription={mobile?'轮播':'卡片列表'} onKeyDown={event=>{
  if(!mobile||!['ArrowLeft','ArrowRight'].includes(event.key)||(event.target as HTMLElement).closest('input,textarea,select'))return;
  event.preventDefault();move(event.key==='ArrowLeft'?'previous':'next');
 }}>
  <div className="ps-viewport" ref={viewport}><div className="ps-track">{players.map((player,i)=><div className="ps-slide" key={player.id} role="group" aria-label={`${i+1}/${players.length} ${player.name}`} aria-roledescription={mobile?'卡片':'球友'} aria-hidden={mobile&&i!==index} inert={mobile&&i!==index}>{renderCard(player)}</div>)}</div></div>
  {players.length>0&&<div className="ps-navigation"><button type="button" aria-label="上一位球友" disabled={!previous} onClick={()=>move('previous')}><ChevronLeft size={20} aria-hidden="true"/></button><div className="ps-position"><span aria-live="polite" aria-atomic="true"><b>{index+1}</b><span> / {players.length}</span></span><small><MoveHorizontal size={13} aria-hidden="true"/>左右滑动切换球友</small></div><button type="button" aria-label="下一位球友" disabled={!next} onClick={()=>move('next')}><ChevronRight size={20} aria-hidden="true"/></button></div>}
 </div>;
}
