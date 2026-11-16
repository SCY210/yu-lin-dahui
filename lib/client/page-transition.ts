'use client';
import {useLayoutEffect,useRef} from 'react';
import type {ClubNavigation,ClubRoute} from './club-navigation';

const tabOrder=['overview','signup','rounds','fees','social'];
/** 'forward' | 'back' for a change of page, 'tab-forward' | 'tab-back' for a change of activity tab, '' for none. */
export function transitionKind(previous:ClubRoute,next:ClubRoute,direction:'forward'|'back'){
 const samePlace=previous.page===next.page&&previous.eventId===next.eventId&&previous.playerId===next.playerId&&previous.socialTab===next.socialTab;
 if(!samePlace)return direction;
 if(previous.tab===next.tab)return '';
 return tabOrder.indexOf(next.tab)<tabOrder.indexOf(previous.tab)?'tab-back':'tab-forward';
}
/** Marks the app shell with the direction of each route change, so the stylesheet can slide the new page in from the
 * side it comes from (app/xiuxian-fx.css; docs/GESTURES.md). Only an attribute changes: nothing is remounted. */
export function usePageTransition(route:ClubRoute,navigation:ClubNavigation|null){
 const previous=useRef<ClubRoute|null>(null);
 useLayoutEffect(()=>{
  const last=previous.current;previous.current=route;
  if(!last||!navigation)return;
  const shell=document.querySelector?.<HTMLElement>('main.shell');
  if(!shell)return;
  const kind=transitionKind(last,route,navigation.direction);
  if(!kind)return;
  // Remove, reflow, set: the same direction twice in a row must still restart the animation.
  shell.removeAttribute('data-nav');void shell.offsetWidth;shell.setAttribute('data-nav',kind);
  // Sections that appear later (after a refresh) must not slide in as if the page had changed again.
  const done=window.setTimeout(()=>shell.removeAttribute('data-nav'),500);
  return ()=>window.clearTimeout(done);
 },[route,navigation]);
}
