'use client';
import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ClubNavigation,homeRoute,type ClubRoute} from './club-navigation';

export const ClubNavigationContext=createContext<ClubNavigation|null>(null);
export function useClubNavigation(owner:string|undefined){
 const [route,setRoute]=useState<ClubRoute>(homeRoute);
 const [navigation,setNavigation]=useState<ClubNavigation|null>(null);
 const scrollRequest=useRef<{id:number;y:number}|null>(null),scrollSequence=useRef(0),scrollFrame=useRef<number|null>(null);
 // Route listeners run before React commits the destination DOM. Restore only
 // after that commit, waiting for a fetched ranking/list to have enough height.
 useLayoutEffect(()=>{
  const request=scrollRequest.current;if(!request)return;
  let tries=0;
  const restore=()=>{
   if(scrollRequest.current?.id!==request.id)return;
   const height=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)-window.innerHeight;
   if(height>=request.y||tries++>=180){window.scrollTo({top:request.y,behavior:'auto'});scrollRequest.current=null;scrollFrame.current=null;return}
   scrollFrame.current=requestAnimationFrame(restore);
  };
  scrollFrame.current=requestAnimationFrame(restore);
  return()=>{if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current);scrollFrame.current=null};
 });
 useEffect(()=>{
  if(!owner)return;
  const controller=new ClubNavigation({href:()=>location.href,state:()=>history.state,push:(state,url)=>history.pushState(state,'',url),replace:(state,url)=>history.replaceState(state,'',url),go:delta=>history.go(delta),scrollY:()=>window.scrollY,scrollTo:y=>{if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current);scrollFrame.current=null;scrollRequest.current={id:++scrollSequence.current,y}}},owner,crypto.randomUUID());
  const unsubscribe=controller.subscribe(setRoute),pop=(event:PopStateEvent)=>controller.pop(event.state);
  const previousRestoration=history.scrollRestoration;history.scrollRestoration='manual';
  window.addEventListener('popstate',pop);setNavigation(controller);
  return()=>{unsubscribe();window.removeEventListener('popstate',pop);history.scrollRestoration=previousRestoration;scrollRequest.current=null;scrollSequence.current++;if(scrollFrame.current!==null)cancelAnimationFrame(scrollFrame.current);setNavigation(null)};
 },[owner]);
 return {route,navigation};
}

/** Shared by every app Dialog and AlertDialog, including account and feature-guide dialogs. */
export function useDialogHistory(open:boolean,onOpenChange:((open:boolean)=>void)|undefined){
 const navigation=useContext(ClubNavigationContext),closeRef=useRef(onOpenChange);
 closeRef.current=onOpenChange;
 useEffect(()=>{
  if(!open||!navigation)return;
  const id=crypto.randomUUID();let cancelled=false;
  // Effect replay in development must not push a second phantom dialog entry.
  queueMicrotask(()=>{if(!cancelled)navigation.openDialog(id,()=>closeRef.current?.(false))});
  return()=>{cancelled=true;navigation.dismissDialog(id)};
 },[open,navigation]);
}
