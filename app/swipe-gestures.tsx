'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft} from 'lucide-react';
import {backSwipeBlocked,backDistance,edgeBackProgress,edgeWidth,neighbourTab,tabSwipeBlocked,tabSwipeStep} from '../lib/client/swipe-gestures';
import './swipe-gestures.css';

/** A swipe in from the left edge of the screen goes back one step, like the system gesture: it closes an open dialog
 * first, then returns to the previous page (docs/GESTURES.md). A round indicator follows the finger and turns solid
 * once letting go will go back. */
export default function EdgeBackSwipe({canGoBack,onBack}:{canGoBack:()=>boolean;onBack:()=>void}){
 const [pull,setPull]=useState({distance:0,y:0,ready:false});
 const start=useRef<{x:number;y:number}|null>(null),latest=useRef({canGoBack,onBack});
 useEffect(()=>{latest.current={canGoBack,onBack}});
 useEffect(()=>{
  const cancel=()=>{start.current=null;setPull(p=>p.distance?{distance:0,y:p.y,ready:false}:p)};
  const down=(e:TouchEvent)=>{
   const t=e.touches[0];
   start.current=e.touches.length===1&&t.clientX<=edgeWidth&&latest.current.canGoBack()&&!backSwipeBlocked(e.target as unknown as Element)?{x:t.clientX,y:t.clientY}:null;
  };
  const move=(e:TouchEvent)=>{
   if(!start.current)return;
   if(e.touches.length!==1){cancel();return}
   const t=e.touches[0],progress=edgeBackProgress(start.current.x,t.clientX-start.current.x,t.clientY-start.current.y);
   setPull({...progress,y:t.clientY});
   // Keep the page from scrolling sideways or selecting text while the indicator follows the finger.
   if(progress.distance>8&&e.cancelable)e.preventDefault();
  };
  const up=()=>{
   if(!start.current)return;
   start.current=null;
   setPull(p=>{if(p.ready)queueMicrotask(()=>latest.current.onBack());return {distance:0,y:p.y,ready:false}});
  };
  window.addEventListener('touchstart',down,{passive:true});window.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('touchend',up);window.addEventListener('touchcancel',cancel);
  return ()=>{window.removeEventListener('touchstart',down);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',up);window.removeEventListener('touchcancel',cancel)};
 },[]);
 if(!pull.distance)return null;
 return <div className={'swipe-back'+(pull.ready?' is-ready':'')} style={{top:pull.y,transform:`translate(${Math.round(pull.distance*.6)-44}px,-50%) scale(${(.6+Math.min(1,pull.distance/backDistance)*.4).toFixed(2)})`}} role="status" aria-live="polite">
  <ChevronLeft size={22} aria-hidden="true"/><span className="sr-only">{pull.ready?'松开返回':'右滑返回'}</span>
 </div>;
}

/** On an activity page, a horizontal swipe across the content moves to the neighbouring tab. */
export function useTabSwipe<T extends string>(tabs:readonly T[],active:T,onChange:(tab:T)=>void){
 const latest=useRef({tabs,active,onChange});
 useEffect(()=>{latest.current={tabs,active,onChange}});
 useEffect(()=>{
  let start:{x:number;y:number}|null=null;
  const sideways=(el:{parentElement:unknown})=>el instanceof Element&&el.scrollWidth>el.clientWidth+4&&/(auto|scroll)/.test(getComputedStyle(el).overflowX);
  const down=(e:TouchEvent)=>{
   const t=e.touches[0];
   start=e.touches.length===1&&t.clientX>edgeWidth&&!tabSwipeBlocked(e.target as unknown as Element,sideways as never)?{x:t.clientX,y:t.clientY}:null;
  };
  const up=(e:TouchEvent)=>{
   if(!start||e.touches.length)return;
   const t=e.changedTouches[0],step=tabSwipeStep(t.clientX-start.x,t.clientY-start.y);start=null;
   const next=neighbourTab(latest.current.tabs,latest.current.active,step);
   if(next!==undefined)latest.current.onChange(next);
  };
  const cancel=()=>{start=null};
  window.addEventListener('touchstart',down,{passive:true});window.addEventListener('touchend',up);window.addEventListener('touchcancel',cancel);
  return ()=>{window.removeEventListener('touchstart',down);window.removeEventListener('touchend',up);window.removeEventListener('touchcancel',cancel)};
 },[]);
}
