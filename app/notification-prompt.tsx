'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {enablePush,notificationConfig,pushSupport,syncPushAccount} from '../lib/client/push-notifications';
import {pushFailure} from '../lib/client/push-errors';
import './notification-prompt.css';

type Offer={support:string;publicKey:string|null};
export default function NotificationPrompt({accountId,blocked=false}:{accountId:string;blocked?:boolean}){
 const [offer,setOffer]=useState<Offer|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[denied,setDenied]=useState(false);
 const [visit,setVisit]=useState(0),handled=useRef(false),enabling=useRef(false);
 const [serviceFailure,setServiceFailure]=useState(false);
 useEffect(()=>{
  const enter=()=>{if(document.hidden||enabling.current)return;if(!open)handled.current=false;setVisit(value=>value+1)};
  const show=(event:PageTransitionEvent)=>{if(event.persisted)enter()};
  document.addEventListener('visibilitychange',enter);window.addEventListener('pageshow',show);
  return()=>{document.removeEventListener('visibilitychange',enter);window.removeEventListener('pageshow',show)};
 },[open]);
 useEffect(()=>{let active=true;
  void (async()=>{
   const enabled=await syncPushAccount(accountId);
   if(!active)return;
   if(enabled===true){setOpen(false);setOffer(null);return}
   if(enabled!==false)return;
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
 function confirmed(){setOpen(false);setOffer(null);toast.success('已开启这台设备的活动提醒')}
 function continueWithoutPush(){
  if(enabling.current||busy||!serviceFailure)return;
  // Keep the device disabled and the current visit handled. A fresh visit retries.
  setOpen(false);setError('');setServiceFailure(false);
 }
 async function enable(){
  if(!offer?.publicKey||enabling.current)return;enabling.current=true;setBusy(true);setError('');setServiceFailure(false);
  try{await enablePush(accountId,offer.publicKey);confirmed()}
  catch(e){const failure=pushFailure(e);setDenied('Notification' in window&&Notification.permission==='denied');setError(failure.message);setServiceFailure(failure.serviceUnavailable)}
  finally{enabling.current=false;setBusy(false)}
 }
 async function recheck(){
  if(enabling.current)return;enabling.current=true;setBusy(true);setError('');setServiceFailure(false);
  try{
   if(await syncPushAccount(accountId)===true){confirmed();return}
   const support=pushSupport(),isDenied='Notification' in window&&Notification.permission==='denied';
   setDenied(isDenied);
   if(support==='unsupported'){setOffer({support,publicKey:null});setError('当前浏览器不支持系统通知，请改用支持通知的浏览器或主屏幕应用。');return}
   const config=support==='supported'&&!isDenied?await notificationConfig(accountId):null;
   setOffer({support,publicKey:config?.publicKey??null});
   if(config&&(!config.configured||!config.publicKey)){setError('通知服务暂不可用，请稍后重新检测。');return}
   if(support==='supported'&&!isDenied&&Notification.permission==='granted'&&config?.publicKey){await enablePush(accountId,config.publicKey);confirmed()}
   else if(support==='iphone-install')setError('请先添加到主屏幕，再从桌面图标打开网站并开启通知。');
   else if(isDenied)setError('系统仍在阻止通知，请先在浏览器或手机设置中允许本网站。');
  }catch(e){const failure=pushFailure(e,'无法检测通知状态，请重试');setError(failure.message);setServiceFailure(failure.serviceUnavailable)}
  finally{enabling.current=false;setBusy(false)}
 }
 if(!offer)return null;
 const install=offer.support==='iphone-install';
 const canEnable=!install&&!denied&&!!offer.publicKey;
 return <Dialog open={open} historyCloseBlocked onOpenChange={()=>{}}><DialogContent className="app-dialog notification-optin" showCloseButton={false} onEscapeKeyDown={event=>event.preventDefault()} onInteractOutside={event=>event.preventDefault()}>
  <DialogHeader><DialogTitle><Bell size={22} aria-hidden="true"/>请开启活动通知</DialogTitle><DialogDescription>有新接龙、候补转正或活动变更时及时提醒你，网站关闭后也能收到系统通知。</DialogDescription></DialogHeader>
  {install?<p className="hint">苹果手机请先用 Safari 将网站“添加到主屏幕”，再从桌面图标打开并开启通知（iOS 16.4 及以上）。</p>:denied?<p className="hint">系统已阻止通知。请在浏览器或手机的通知设置中允许本网站，然后点击下方按钮重新检测。</p>:<p className="hint">点击开启后，请在系统提示中选择“允许”。每台设备需要单独开启。</p>}
  {error&&<p className="connection-note" role="alert">{error}</p>}
  <div className="actions notification-optin-actions">{canEnable?<button type="button" className="primary" disabled={busy} onClick={()=>void enable()}>{busy?'正在开启…':'开启通知'}</button>:<button type="button" className="primary" disabled={busy} onClick={()=>void recheck()}>{busy?'正在检测…':install||offer.support==='unsupported'?'重新检测通知支持':denied?'已允许，重新检测并开启':'重新检测通知服务'}</button>}
   {serviceFailure&&<button type="button" className="secondary" disabled={busy} onClick={continueWithoutPush}>先进入网站，稍后重试</button>}
  </div>
  <p className="hint">{serviceFailure?'系统推送仍未开启，站内提醒可正常查看；下次访问会再次提示。':'通知成功开启后，此窗口会自动关闭。'}</p>
 </DialogContent></Dialog>;
}
