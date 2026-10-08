'use client';
import {useEffect,useState} from 'react';

/** Update at the start/end boundary, and catch up when a suspended phone wakes. */
export function useActivityClock(e:{id:string;start:number;end:number;status?:string}){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  const update=()=>{
   if(timer!==undefined)clearTimeout(timer);
   const at=Date.now();setNow(at);
   const next=[e.start,e.end].filter(t=>t>at).sort((a,b)=>a-b)[0];
   if(next!==undefined)timer=setTimeout(update,Math.min(next-at,2147483647));
  };
  update();const tick=setInterval(update,30000);document.addEventListener('visibilitychange',update);window.addEventListener('pageshow',update);window.addEventListener('focus',update);
  return()=>{clearInterval(tick);if(timer!==undefined)clearTimeout(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('pageshow',update);window.removeEventListener('focus',update)};
 },[e.id,e.start,e.end,e.status]);
 return now;
}
