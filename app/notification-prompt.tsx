'use client';
import {useEffect,useRef,useState} from 'react';
import {CalendarPlus,Coins,Gift,Swords,Bell} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {enablePush,notificationConfig,pushSupport,syncPushAccount} from '../lib/client/push-notifications';
import {pushFailure} from '../lib/client/push-errors';
import {IosDeniedSteps,IosInstallSteps,isIphone} from './ios-push-steps';
import './notification-prompt.css';

import {NotificationIncentiveNotice} from './notification-incentive';

type Offer={support:string;publicKey:string|null};
export default function NotificationPrompt({accountId,blocked=false}:{accountId:string;blocked?:boolean}){
 const [offer,setOffer]=useState<Offer|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[denied,setDenied]=useState(false);
 const [visit,setVisit]=useState(0),handled=useRef(false),enabling=useRef(false);
 useEffect(()=>{
  const changed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.accountId===accountId&&detail.pointsDelta===-30)toast.error('检测到这台设备的通知权限已关闭，双打赛季积分 −30；重新开启并验证成功加 10 分，不退还这 30 分。')};
  window.addEventListener('yulin:push-changed',changed);return()=>window.removeEventListener('yulin:push-changed',changed);
 },[accountId]);
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
 function confirmed(points=0){setOpen(false);setOffer(null);toast.success(points===10?'通知已开启，双打赛季积分 +10':'已开启这台设备的活动提醒')}
 function dismiss(){
  // Dismissing never enables notifications or persists a permission/snooze choice.
  handled.current=true;setOpen(false);setError('');
 }
 async function enable(){
  if(!offer?.publicKey||enabling.current)return;enabling.current=true;setBusy(true);setError('');
  try{const result=await enablePush(accountId,offer.publicKey,true);confirmed(result?.pointsDelta)}
  catch(e){const failure=pushFailure(e);setDenied('Notification' in window&&Notification.permission==='denied');setError(failure.message)}
  finally{enabling.current=false;setBusy(false)}
 }
 async function recheck(){
  if(enabling.current)return;enabling.current=true;setBusy(true);setError('');
  try{
   if(await syncPushAccount(accountId)===true){confirmed();return}
   const support=pushSupport(),isDenied='Notification' in window&&Notification.permission==='denied';
   setDenied(isDenied);
   if(support==='unsupported'){setOffer({support,publicKey:null});setError('当前浏览器不支持系统通知，请改用支持通知的浏览器或主屏幕应用。');return}
   const config=support==='supported'&&!isDenied?await notificationConfig(accountId):null;
   setOffer({support,publicKey:config?.publicKey??null});
   if(config&&(!config.configured||!config.publicKey)){setError('通知服务暂不可用，请稍后重新检测。');return}
   if(support==='supported'&&!isDenied&&Notification.permission==='granted'&&config?.publicKey){const result=await enablePush(accountId,config.publicKey,true);confirmed(result?.pointsDelta)}
   else if(support==='iphone-install')setError('请先添加到主屏幕，再从桌面图标打开网站并开启通知。');
   else if(isDenied)setError('系统仍在阻止通知，请先在浏览器或手机设置中允许本网站。');
  }catch(e){const failure=pushFailure(e,'无法检测通知状态，请重试');setError(failure.message)}
  finally{enabling.current=false;setBusy(false)}
 }
 if(!offer)return null;
 const install=offer.support==='iphone-install';
 const canEnable=!install&&!denied&&!!offer.publicKey;
 return <Dialog open={open} onOpenChange={next=>{if(!next)dismiss()}}><DialogContent className="app-dialog notification-optin" showCloseButton>
  <DialogHeader><DialogTitle><Bell size={22} aria-hidden="true"/>传音符：活动通知</DialogTitle><DialogDescription>开启后，天机阁的传讯会像微信消息一样弹到手机上。此符可选，不开启也能正常使用网站。</DialogDescription></DialogHeader>
  <ul className="notification-optin-benefits">
   <li><CalendarPlus size={20} aria-hidden="true"/><span><strong>新活动不错过</strong><small>报名、改期或取消，第一时间知道</small></span></li>
   <li><Swords size={20} aria-hidden="true"/><span><strong>转正、上场即刻提醒</strong><small>候补转正和轮到你上场时马上通知</small></span></li>
   <li><Coins size={20} aria-hidden="true"/><span><strong>费用、评选、悬赏令</strong><small>不用反复打开网站查看</small></span></li>
   <li className="is-reward"><Gift size={20} aria-hidden="true"/><span><strong>手机首次开启 +10 积分</strong><small>双打赛季积分，每个账号领一次</small></span></li>
  </ul>
  <details className="notification-optin-rules"><summary>积分细则：开启 +10，关闭 −30（仅手机）</summary><NotificationIncentiveNotice/></details>
  {install?<><p className="notification-optin-lead">苹果手机要先把网站“添加到主屏幕”，才能收到通知。按下面 4 步操作，大约 1 分钟：</p><IosInstallSteps/></>:denied?isIphone()?<><p className="notification-optin-lead">系统已阻止通知。按下面步骤在 iPhone 设置里允许：</p><IosDeniedSteps/></>:<p className="hint">系统已阻止通知。请在浏览器或手机的通知设置中允许本网站，然后点击下方按钮重新检测。</p>:<p className="hint">点击开启后，请在系统提示中选择“允许”。每台设备需要单独开启。</p>}
  {error&&<p className="connection-note" role="alert">{error}</p>}
  <div className="actions notification-optin-actions">{canEnable?<button type="button" className="primary" disabled={busy} onClick={()=>void enable()}>{busy?'正在开启…':'开启通知'}</button>:<button type="button" className="primary" disabled={busy} onClick={()=>void recheck()}>{busy?'正在检测…':install||offer.support==='unsupported'?'重新检测通知支持':denied?'已允许，重新检测并开启':'重新检测通知服务'}</button>}
   <button type="button" className="secondary" onClick={dismiss}>暂不祭出</button>
  </div>
  <p className="hint notification-optin-foot">也可以稍后在「我的」通知设置中开启；下次进入时可能再次提示。</p>
 </DialogContent></Dialog>;
}
