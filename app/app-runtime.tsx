'use client';
import {useEffect} from 'react';

export default function AppRuntime(){
 useEffect(()=>{
  if(process.env.NODE_ENV!=='production'||!window.isSecureContext||!('serviceWorker' in navigator))return;
  void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{
   // Installation and online club access still work if offline setup is unavailable.
  });
 },[]);
 return null;
}
