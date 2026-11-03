'use client';
import {useContext,useEffect,useRef,useState} from 'react';
import {ClubNavigationContext} from '../lib/client/club-navigation-react';
import type {Event,Match,Round} from '../lib/domain/types';

// Outside a browser (tests, server rendering) there is no frame clock or page to scroll.
const nextFrame=(f:()=>void)=>typeof requestAnimationFrame==='function'?requestAnimationFrame(f):setTimeout(f,16) as unknown as number;
const cancelFrame=(id:number)=>typeof cancelAnimationFrame==='function'?cancelAnimationFrame(id):clearTimeout(id);
type FocusData={matches:Match[];rounds:Round[];me:{playerId:string}};
/** The match to bring into view on an activity's rounds tab (docs/JUMP_TO_MATCH.md): the one a link names (a home score
 * button, a reminder, a notification), else once per visit the game in progress, the viewer's own first. */
export function focusTarget(data:FocusData,e:Pick<Event,'id'>,focus:{matchId?:string;roundId?:string}|undefined,auto:boolean):Match|undefined{
 const mine=(m:Match)=>[...m.a,...m.b].includes(data.me.playerId),event=data.matches.filter(m=>m.eventId===e.id&&m.status!=='cancelled');
 if(focus?.matchId)return event.find(m=>m.id===focus.matchId);
 if(focus?.roundId){const round=event.filter(m=>m.roundId===focus.roundId);return round.find(mine)??round[0]}
 if(!auto)return;
 const playing=event.filter(m=>m.status==='playing');
 return playing.find(mine)??playing[0];
}

/** Scrolls the target match card into view, highlights it briefly and forgets the link. Returns the round to show. A
 * player filter turns this off. */
export function useMatchFocus(data:FocusData,e:Pick<Event,'id'>,filtered:boolean){
 const navigation=useContext(ClubNavigationContext),route=navigation?.route;
 const focus=route?.page==='events'&&route.eventId===e.id&&route.tab==='rounds'?route.focus:undefined;
 const [autoDone,setAutoDone]=useState(false),done=useRef('');
 const target=filtered?undefined:focusTarget(data,e,focus,!autoDone);
 const key=target?target.id+'|'+JSON.stringify(focus??{}):'';
 useEffect(()=>{
  if(!target||done.current===key||typeof document==='undefined'||typeof document.getElementById!=='function')return;
  let frames=0,raf=0;
  // The card may need a round tab switch first; wait a few frames for it to render.
  const run=()=>{
   const el=document.getElementById('match-'+target.id);
   if(!el){if(++frames<30)raf=nextFrame(run);return}
   done.current=key;setAutoDone(true);
   el.scrollIntoView?.({block:'center',behavior:'smooth'});
   el.classList.add('is-focused');setTimeout(()=>el.classList.remove('is-focused'),2200);
   if(focus)navigation?.clearFocus();
  };
  raf=nextFrame(run);
  return()=>cancelFrame(raf);
 });
 return {roundId:target?.roundId};
}
