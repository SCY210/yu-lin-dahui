'use client';
import {useEffect} from 'react';
import {reloadOnceForNewVersion,sessionStore} from '../lib/client/wake-recovery';

export default function AppRuntime(){
 useEffect(()=>{
  // A code file from the previous version is gone after a deployment: reload into the new one.
  const preloadFailed=(event:Event)=>{if(reloadOnceForNewVersion(sessionStore(),()=>location.reload()))event.preventDefault()};
  window.addEventListener('vite:preloadError',preloadFailed);
  return()=>window.removeEventListener('vite:preloadError',preloadFailed);
 },[]);
 useEffect(()=>{
  if(process.env.NODE_ENV!=='production'||!window.isSecureContext||!('serviceWorker' in navigator))return;
  void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{
   // Installation and online club access still work if offline setup is unavailable.
  });
 },[]);
 return null;
}
