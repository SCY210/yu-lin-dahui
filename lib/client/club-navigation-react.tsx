'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {ClubNavigation,homeRoute,type ClubRoute} from './club-navigation';

export const ClubNavigationContext=createContext<ClubNavigation|null>(null);
export function useClubNavigation(owner:string|undefined){
 const [route,setRoute]=useState<ClubRoute>(homeRoute);
 const [navigation,setNavigation]=useState<ClubNavigation|null>(null);
 useEffect(()=>{
  if(!owner)return;
  const controller=new ClubNavigation({href:()=>location.href,state:()=>history.state,push:(state,url)=>history.pushState(state,'',url),replace:(state,url)=>history.replaceState(state,'',url),go:delta=>history.go(delta),scrollY:()=>window.scrollY,scrollTo:y=>window.scrollTo({top:y,behavior:'auto'})},owner,crypto.randomUUID());
  const unsubscribe=controller.subscribe(setRoute),pop=(event:PopStateEvent)=>controller.pop(event.state);
  const previousRestoration=history.scrollRestoration;history.scrollRestoration='manual';
  window.addEventListener('popstate',pop);setNavigation(controller);
  return()=>{unsubscribe();window.removeEventListener('popstate',pop);history.scrollRestoration=previousRestoration;setNavigation(null)};
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
