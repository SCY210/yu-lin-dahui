'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {enablePush,notificationConfig,pushSupport,syncPushAccount} from '../lib/client/push-notifications';
import './notification-prompt.css';

type Offer={support:string;publicKey:string|null};
export default function NotificationPrompt({accountId,blocked=false}:{accountId:string;blocked?:boolean}){
 const [offer,setOffer]=useState<Offer|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[denied,setDenied]=useState(false);
 const [visit,setVisit]=useState(0),handled=useRef(false),enabling=useRef(false);
 useEffect(()=>{
  const enter=()=>{if(document.hidden||enabling.current)return;handled.current=false;setOpen(false);setOffer(null);setError('');setVisit(value=>value+1)};
  const show=(event:PageTransitionEvent)=>{if(event.persisted)enter()};
  document.addEventListener('visibilitychange',enter);window.addEventListener('pageshow',show);
  return()=>{document.removeEventListener('visibilitychange',enter);window.removeEventListener('pageshow',show)};
 },[]);
 useEffect(()=>{let active=true;
  void (async()=>{
   const enabled=await syncPushAccount(accountId);
   if(!active||enabled!==false)return;
   const support=pushSupport();if(support==='unsupported')return;
   const isDenied='Notification' in window&&Notification.permission==='denied';
   try{const config=support==='supported'&&!isDenied?await notificationConfig(accountId):null;
    if(!active||config&&(!config.configured||!config.publicKey))return;
    setDenied(isDenied);setOffer({support,publicKey:config?.publicKey??null});
   }catch{/* Leave the app usable; retry discovery on the next visit. */}
  })();return()=>{active=false};
 },[accountId,visit]);
 useEffect(()=>{
  if(!offer||blocked||handled.current)return;
  let ready=false;
  const check=()=>{if(ready&&!handled.current&&!document.hidden&&!document.querySelector('[role="dialog"],[role="alertdialog"]')){handled.current=true;setOpen(true)}};
  // Give the app's score and account dialogs priority, including lazy loading.
  const timer=setTimeout(()=>{ready=true;check()},2000),observer=new MutationObserver(check);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['role']});document.addEventListener('visibilitychange',check);
  return()=>{clearTimeout(timer);observer.disconnect();document.removeEventListener('visibilitychange',check)};
 },[offer,blocked]);
 function dismiss(){if(busy)return;setOpen(false)}
 async function enable(){
  if(!offer?.publicKey||enabling.current)return;enabling.current=true;setBusy(true);setError('');
  try{await enablePush(accountId,offer.publicKey);setOpen(false);toast.success('已开启这台设备的活动提醒')}
  catch(e){setDenied('Notification' in window&&Notification.permission==='denied');setError(e instanceof Error?e.message:'开启通知失败，请稍后重试')}
  finally{enabling.current=false;setBusy(false)}
 }
 if(!offer)return null;
 const install=offer.support==='iphone-install';
 return <Dialog open={open} historyCloseBlocked={busy} onOpenChange={value=>{if(!value)dismiss()}}><DialogContent className="app-dialog notification-optin" showCloseButton={!busy}>
  <DialogHeader><DialogTitle><Bell size={22} aria-hidden="true"/>开启活动通知？</DialogTitle><DialogDescription>有新接龙、候补转正或活动变更时及时提醒你，网站关闭后也能收到系统通知。</DialogDescription></DialogHeader>
  {install?<p className="hint">苹果手机请先用 Safari 将网站“添加到主屏幕”，再从桌面图标打开并开启通知（iOS 16.4 及以上）。</p>:denied?<p className="hint">系统已阻止通知。请在浏览器或手机的通知设置中允许本网站，再到“我的 → 通知与安装”开启。</p>:<p className="hint">点击开启后，系统会询问是否允许通知。每台设备需要单独开启。</p>}
  {error&&<p className="connection-note" role="alert">{error}</p>}
  <div className="actions notification-optin-actions">{!install&&!denied&&<button type="button" className="primary" disabled={busy} onClick={()=>void enable()}>{busy?'正在开启…':'开启通知'}</button>}<button type="button" className="ghost notification-optin-later" disabled={busy} onClick={dismiss}>{install||denied?'我知道了':'暂不开启'}</button></div>
  <p className="hint">暂不开启的话，下次进入仍会提醒；随时可在“我的 → 通知与安装”中设置。</p>
 </DialogContent></Dialog>;
}
