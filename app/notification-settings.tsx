'use client';
import {useEffect,useState} from 'react';
import {Bell,BellOff} from 'lucide-react';
import {toast} from 'sonner';
import {pushSupport,notificationConfig,notificationRequest,localPushSubscription,connectPushWorker,vapidBytes,type NotificationConfig} from '../lib/client/push-notifications';

export default function NotificationSettings({accountId}:{accountId:string}){
 const [config,setConfig]=useState<NotificationConfig|null>(null),[support,setSupport]=useState('checking'),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[denied,setDenied]=useState(false);
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
   await notificationRequest(accountId,'subscribe',{subscription:subscription.toJSON()});setEnabled(true);toast.success('已开启这台设备的新接龙通知');
  }catch(e){setError(e instanceof Error?e.message:'开启通知失败，请稍后重试')}finally{setBusy(false)}
 }
 async function disable(){setBusy(true);setError('');try{const subscription=await localPushSubscription();if(subscription){await notificationRequest(accountId,'unsubscribe',{endpoint:subscription.endpoint});await subscription.unsubscribe()}setEnabled(false);toast.success('这台设备已关闭接龙通知')}catch(e){setError(e instanceof Error?e.message:'关闭失败，请稍后重试')}finally{setBusy(false)}}
 async function test(){setBusy(true);setError('');try{const subscription=await localPushSubscription();if(!subscription)throw new Error('通知连接已失效，请重新开启');await notificationRequest(accountId,'test',{endpoint:subscription.endpoint});toast.success('测试提醒已发送，请查看手机或电脑的系统通知')}catch(e){setError(e instanceof Error?e.message:'测试失败，请稍后重试')}finally{setBusy(false)}}
 return <section className="card notification-settings"><div className="row"><h3 style={{display:'flex',alignItems:'center',gap:8,margin:0}}><Bell size={18} aria-hidden="true"/>接龙通知</h3><span className="badge">{enabled?'这台设备已开启':'这台设备未开启'}</span></div><p>有新接龙开放报名时，通过手机或电脑的系统通知提醒你；网站关掉也能接收。点击提醒直接进入活动。</p>
  {support==='iphone-install'?<p className="hint">iPhone / iPad：先用 Safari 将网站“添加到主屏幕”，再从桌面图标打开并开启通知（iOS 16.4 及以上）。</p>:support==='unsupported'?<p className="hint">当前浏览器暂不支持系统通知。请使用手机上的已安装 App 或支持通知的浏览器。</p>:<div className="actions">{enabled?<><button type="button" className="secondary" disabled={busy} onClick={test}>发送测试通知</button><button type="button" className="ghost" disabled={busy} onClick={disable}><BellOff size={16}/>关闭通知</button></>:<button type="button" className="primary" disabled={busy||!config?.configured||support==='checking'||denied} onClick={enable}>{busy?'正在连接…':'开启新接龙通知'}</button>}</div>}
  {denied&&<p className="hint">系统已阻止通知，请在浏览器或手机通知设置中允许后重新打开。</p>}{config&&!config.configured&&<p className="hint">通知服务暂不可用，请稍后再试。</p>}{error&&<p className="connection-note" role="status">{error}</p>}<p className="hint">每台设备单独开启，可随时关闭；退出登录会停止这台设备的提醒。只提醒新接龙，不逐条推送报名和编辑。</p>
 </section>;
}
