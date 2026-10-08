'use client';
import {useEffect,useState} from 'react';
import './notification-settings.css';
import {reminderLabels,reminderKinds,type ReminderKind,type Reminder} from '../lib/reminder-contract';
import {Bell,BellOff,CheckCheck} from 'lucide-react';
import {toast} from 'sonner';
import {pushSupport,notificationConfig,notificationRequest,localPushSubscription,connectPushWorker,vapidBytes,type NotificationConfig} from '../lib/client/push-notifications';

export default function NotificationSettings({accountId,onOpen}:{accountId:string;onOpen?:(eventId:string,tab:string)=>void}){
 const [config,setConfig]=useState<NotificationConfig|null>(null),[support,setSupport]=useState('checking'),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[denied,setDenied]=useState(false),[unreadOnly,setUnreadOnly]=useState(false);
 async function reload(){try{setConfig(await notificationConfig(accountId))}catch(e){setError(e instanceof Error?e.message:'无法读取提醒')}}
 useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')void reload()},60000);return()=>clearInterval(timer)},[accountId]);
 async function preference(kind:ReminderKind,value:boolean){if(!config||busy)return;setBusy(true);setError('');try{const next={...config.preferences,[kind]:value};await notificationRequest(accountId,'preferences',{preferences:next});setConfig({...config,preferences:next})}catch(e){setError(e instanceof Error?e.message:'设置保存失败')}finally{setBusy(false)}}
 async function read(notice?:Reminder){setError('');try{await notificationRequest(accountId,'read',notice?{id:notice.id}:{});setConfig(c=>c?{...c,unread:notice?Math.max(0,c.unread-(notice.readAt?0:1)):0,items:c.items.map(item=>!notice||item.id===notice.id?{...item,readAt:Date.now()}:item)}:c);if(notice)onOpen?.(notice.eventId,notice.tab)}catch(e){setError(e instanceof Error?e.message:'提醒状态保存失败')}}
 useEffect(()=>{let current=true;const supported=pushSupport();
  void (async()=>{try{const cfg=await notificationConfig(accountId);if(!current)return;setSupport(supported);setDenied('Notification' in window&&Notification.permission==='denied');setConfig(cfg);if(supported!=='supported')return;const subscription=await localPushSubscription();if(subscription){const status=await notificationRequest(accountId,'status',{endpoint:subscription.endpoint});if(status.resetDevice)await subscription.unsubscribe();if(current)setEnabled(!!status.enabled&&!status.resetDevice)}}catch(e){if(current){setSupport(supported);setError(e instanceof Error?e.message:'无法读取通知设置')}}})();return()=>{current=false};
 },[accountId]);
 async function enable(){
  if(!config?.publicKey||support!=='supported')return;setBusy(true);setError('');
  try{
   // Permission is requested only from this explicit button press, before awaits.
   const permission=await Notification.requestPermission();setDenied(permission==='denied');if(permission!=='granted')throw new Error('尚未允许通知。你可以稍后再开启。');
   const registration=await connectPushWorker();let subscription=await registration.pushManager.getSubscription();
   if(subscription){const state=await notificationRequest(accountId,'status',{endpoint:subscription.endpoint});if(state.resetDevice){await subscription.unsubscribe();subscription=null}}
   if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(config.publicKey)});
   await notificationRequest(accountId,'subscribe',{subscription:subscription.toJSON()});setEnabled(true);toast.success('已开启这台设备的活动提醒');
  }catch(e){setError(e instanceof Error?e.message:'开启通知失败，请稍后重试')}finally{setBusy(false)}
 }
 async function disable(){setBusy(true);setError('');try{const subscription=await localPushSubscription();if(subscription){await notificationRequest(accountId,'unsubscribe',{endpoint:subscription.endpoint});await subscription.unsubscribe()}setEnabled(false);toast.success('这台设备已关闭系统提醒')}catch(e){setError(e instanceof Error?e.message:'关闭失败，请稍后重试')}finally{setBusy(false)}}
 async function test(){setBusy(true);setError('');try{const subscription=await localPushSubscription();if(!subscription)throw new Error('通知连接已失效，请重新开启');await notificationRequest(accountId,'test',{endpoint:subscription.endpoint});toast.success('测试提醒已发送，请查看手机或电脑的系统通知')}catch(e){setError(e instanceof Error?e.message:'测试失败，请稍后重试')}finally{setBusy(false)}}
 return <section className="card notification-settings" id="reminder-center">
  <div className="row"><h2><Bell size={22} aria-hidden="true"/>提醒中心</h2><span className="badge">{config?.unread?config.unread+' 条未读':'重要消息都在这里'}</span></div>
  <p className="muted">从报名到赛后，和你有关的活动消息集中查看。</p>
  <div className="reminder-toolbar"><div className="reminder-filters"><button type="button" className={!unreadOnly?'secondary':'ghost'} aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>全部</button><button type="button" className={unreadOnly?'secondary':'ghost'} aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>未读</button></div><button type="button" className="ghost" disabled={!config?.unread||busy} onClick={()=>void read()}><CheckCheck size={16}/>全部已读</button></div>
  <div className="reminder-list">{config?.items.filter(n=>!unreadOnly||!n.readAt).length?config.items.filter(n=>!unreadOnly||!n.readAt).map(n=><button type="button" key={n.id} className={'reminder-item'+(!n.readAt?' is-unread':'')} onClick={()=>void read(n)}><span className="reminder-dot" aria-hidden="true"/><span className="reminder-copy"><strong>{n.title}</strong><span>{n.body}</span><small>{reminderLabels[n.kind]} · {new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(n.createdAt)}</small></span></button>):<p className="reminder-empty">{config?(unreadOnly?'所有提醒都已读完。':'还没有新提醒。报名、候补转正和活动变更会出现在这里。'):'正在读取提醒…'}</p>}</div>
  <details className="reminder-options"><summary>提醒偏好与设备设置</summary><p className="hint">选择接收哪些系统通知；站内消息仍保留。临近开场为访问网站时生成的站内提示。</p>
   <div className="reminder-preferences">{reminderKinds.map(kind=><label key={kind}><input type="checkbox" checked={config?.preferences[kind]??true} disabled={!config||busy} onChange={event=>void preference(kind,event.target.checked)}/><span>{reminderLabels[kind]}{kind==='upcoming'&&<small>开场前一小时 · 站内提示</small>}</span></label>)}</div>
   <div className="row"><h3>这台设备的系统通知</h3><span className="badge">{enabled?'已开启':'未开启'}</span></div><p className="hint">开启后，即使网站关闭也能接收活动消息。点击通知进入对应活动、分组或费用。</p>
   {support==='iphone-install'?<p className="hint">苹果手机：先用 Safari 将网站“添加到主屏幕”，再从桌面图标打开并开启通知（系统 16.4 及以上）。</p>:support==='unsupported'?<p className="hint">当前浏览器暂不支持系统通知，仍可在这里查看站内提醒。</p>:<div className="actions">{enabled?<><button type="button" className="secondary" disabled={busy} onClick={test}>发送测试通知</button><button type="button" className="ghost" disabled={busy} onClick={disable}><BellOff size={16}/>关闭系统通知</button></>:<button type="button" className="primary" disabled={busy||!config?.configured||support==='checking'||denied} onClick={enable}>{busy?'正在连接…':'开启活动提醒'}</button>}</div>}
   {denied&&<p className="hint">系统已阻止通知，请在浏览器或手机通知设置中允许后重新打开。</p>}{config&&!config.configured&&<p className="hint">系统推送暂不可用；站内提醒仍可查看。</p>}<p className="hint">每台设备单独开启；退出登录会停止这台设备的推送。提醒中心保留最近30天，最多展示40条。</p>
  </details>{error&&<p className="connection-note" role="status">{error}</p>}
 </section>;
}
