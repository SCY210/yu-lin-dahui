'use client';
import {useEffect,useState,type RefObject} from 'react';

const callbacks=new Map<Element,(visible:boolean)=>void>();
let observer:IntersectionObserver|null=null;
function observe(element:Element,callback:(visible:boolean)=>void){
 if(typeof IntersectionObserver==='undefined'){callback(true);return()=>{}}
 observer??=new IntersectionObserver(entries=>{for(const entry of entries)callbacks.get(entry.target)?.(entry.isIntersecting)});
 callbacks.set(element,callback);observer.observe(element);
 return()=>{callbacks.delete(element);observer?.unobserve(element)};
}
/** One observer serves every fiery avatar; motion pauses offscreen/in background. */
export function useVisibleAvatarMotion(ref:RefObject<Element|null>,enabled:boolean){
 const [moving,setMoving]=useState(false);
 useEffect(()=>{
  if(!enabled||!ref.current)return;
  let visible=false;const update=()=>setMoving(visible&&!document.hidden);
  const stop=observe(ref.current,value=>{visible=value;update()});
  document.addEventListener('visibilitychange',update);
  return()=>{stop();document.removeEventListener('visibilitychange',update)};
 },[enabled,ref]);
 return enabled&&moving;
}
