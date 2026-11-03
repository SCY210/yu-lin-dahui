'use client';
import {useContext,useEffect} from 'react';
import {ClubNavigationContext} from '../lib/client/club-navigation-react';
import type {FocusSection,RouteFocus} from '../lib/client/club-navigation';

// Outside a browser (tests, server rendering) there is no frame clock or page to scroll.
export const nextFrame=(f:()=>void)=>typeof requestAnimationFrame==='function'?requestAnimationFrame(f):setTimeout(f,16) as unknown as number;
export const cancelFrame=(id:number)=>typeof cancelAnimationFrame==='function'?cancelAnimationFrame(id):clearTimeout(id);

/** Waits a few frames for the element to render, scrolls it to the middle of the screen (a tall one to the top) and makes it glow briefly
 * (a still outline with reduced motion). Calls done once, found or not. Returns a cancel function. */
export function bringIntoView(id:string,done:()=>void):()=>void{
 if(typeof document==='undefined'||typeof document.getElementById!=='function'){done();return()=>{}}
 let frames=0,raf=0;
 const run=()=>{
  const el=document.getElementById(id);
  if(!el){if(++frames<30)raf=nextFrame(run);else done();return}
  // A section taller than the screen starts at its top, so its heading stays in view.
  const tall=typeof window!=='undefined'&&el.getBoundingClientRect?.().height>window.innerHeight*0.7;
  el.scrollIntoView?.({block:tall?'start':'center',behavior:'smooth'});
  el.classList.add('is-section-focused');setTimeout(()=>el.classList.remove('is-section-focused'),2200);
  done();
 };
 raf=nextFrame(run);
 return()=>cancelFrame(raf);
}

/** A link asking an activity tab to bring one of its sections into view (docs/JUMP_TO_MATCH.md): the viewer's own
 * transfers on the fees tab, their court card on the signup tab, the MVP vote on the social tab. The target is the
 * element's id, or a function of the focus (a reminder may name a booking), run only while a link stands. Returns the focus
 * while the link stands, so a folded section can open; once the element is in view (or there is none) the link is
 * forgotten, so a refresh, back or forward does not scroll there again. */
export function useSectionFocus(eventId:string,section:FocusSection,target:string|undefined|((focus:RouteFocus)=>string|undefined)):RouteFocus|undefined{
 const navigation=useContext(ClubNavigationContext),route=navigation?.route;
 const focus=route?.page==='events'&&route.eventId===eventId&&route.focus?.section===section?route.focus:undefined;
 const asked=!!focus,elementId=focus?(typeof target==='function'?target(focus):target):undefined;
 useEffect(()=>{
  if(!asked)return;
  if(!elementId){navigation?.clearFocus();return}
  return bringIntoView(elementId,()=>navigation?.clearFocus());
 },[asked,elementId,navigation]);
 return focus;
}
