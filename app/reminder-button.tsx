'use client';
import {useEffect,useState} from 'react';
import {Bell,BellRing} from 'lucide-react';
import {notificationConfig} from '../lib/client/push-notifications';
import './reminder-button.css';

/** Header entry to the reminder centre. With unread notices it switches to a ringing, highlighted icon and a count.
 * The count refreshes on load, whenever `refreshKey` changes (each page change), when the tab becomes visible and
 * every minute while visible. A failed read keeps the last count. */
export default function ReminderButton({accountId,refreshKey,onOpen}:{accountId:string;refreshKey:string;onOpen:()=>void}){
 const [unread,setUnread]=useState(0);
 useEffect(()=>{
  let current=true;
  const read=()=>{notificationConfig(accountId).then(c=>{if(current)setUnread(c.unread)}).catch(()=>{})};
  read();
  const visible=()=>{if(document.visibilityState==='visible')read()};
  const timer=setInterval(visible,60000);document.addEventListener('visibilitychange',visible);
  return ()=>{current=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible)};
 },[accountId,refreshKey]);
 const label=unread>99?'99+':String(unread);
 return <button type="button" className={'ghost reminder-button'+(unread?' has-unread':'')} onClick={onOpen} aria-label={unread?'提醒，'+unread+' 条未读':'提醒'}>
  {unread?<BellRing size={18} aria-hidden="true"/>:<Bell size={18} aria-hidden="true"/>}提醒{unread>0&&<span className="reminder-count" aria-hidden="true">{label}</span>}
 </button>;
}
