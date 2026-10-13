'use client';
import {useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {isStandaloneApp,pullBlocked,pullProgress,pullThreshold} from '../lib/client/pull-to-refresh';
import './pull-to-refresh.css';

/** In the home-screen app, pulling down from the top of the page reloads it, which also picks up a newly published
 * version. Normal browser tabs keep their own pull gesture and get nothing extra. */
export default function PullToRefresh({onRefresh=()=>window.location.reload()}:{onRefresh?:()=>void}){
 const [pull,setPull]=useState(0),[refreshing,setRefreshing]=useState(false);
 const start=useRef<number|null>(null),distance=useRef(0),busy=useRef(false),refresh=useRef(onRefresh);
 useEffect(()=>{refresh.current=onRefresh},[onRefresh]);
 useEffect(()=>{
  if(!isStandaloneApp())return;
  const scrollable=(el:{scrollTop:number})=>el instanceof Element&&/(auto|scroll)/.test(getComputedStyle(el).overflowY);
  const cancel=()=>{start.current=null;distance.current=0;setPull(0)};
  const down=(e:TouchEvent)=>{
   cancel();
   if(document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],dialog[open]'))return;
   start.current=!busy.current&&window.scrollY<=0&&e.touches.length===1&&!pullBlocked(e.target as unknown as Element,scrollable)?e.touches[0].clientY:null;
   distance.current=0;
  };
  const move=(e:TouchEvent)=>{
   if(start.current===null)return;
   if(e.touches.length!==1||window.scrollY>0){cancel();return}
   const {distance:d}=pullProgress(e.touches[0].clientY-start.current);distance.current=d;setPull(d);
   // Stop the page bouncing while the indicator follows the finger.
   if(d>4&&e.cancelable)e.preventDefault();
  };
  const up=(e:TouchEvent)=>{
   if(e.touches.length){cancel();return}
   if(start.current===null)return;
   start.current=null;
   if(distance.current>=pullThreshold){busy.current=true;setRefreshing(true);setPull(pullThreshold*0.75);refresh.current()}
   else setPull(0);
  };
  window.addEventListener('touchstart',down,{passive:true});window.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('touchend',up);window.addEventListener('touchcancel',cancel);
  return ()=>{window.removeEventListener('touchstart',down);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',up);window.removeEventListener('touchcancel',cancel)};
 },[]);
 if(!pull&&!refreshing)return null;
 const ready=refreshing||pull>=pullThreshold;
 return <div className={'pull-refresh'+(refreshing?' is-refreshing':'')} style={{transform:`translate(-50%,${Math.round(pull)-44}px)`,opacity:Math.min(1,pull/40)}} role="status" aria-live="polite">
  <RefreshCw size={18} aria-hidden="true" style={refreshing?undefined:{transform:`rotate(${Math.round(pull*3)}deg)`}}/>
  <span>{refreshing?'正在刷新…':ready?'松开刷新':'下拉刷新'}</span>
 </div>;
}
