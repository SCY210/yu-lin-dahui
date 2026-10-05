export type NotificationConfig={configured:boolean;publicKey:string|null;accountId:string};
type NotificationReply={error?:string;enabled?:boolean;resetDevice?:boolean;ok?:boolean;accepted?:boolean};
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)}
export function pushSupport(){
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const installed=matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;
 if(ios&&!installed)return 'iphone-install';
 if(!window.isSecureContext||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return 'unsupported';
 return 'supported';
}
export async function notificationRequest(accountId:string,action:string,detail:object={}){
 const response=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,accountId,...detail}),signal:AbortSignal.timeout(10000)});
 const data:unknown=await response.json();if(!record(data))throw new Error('通知设置暂时无法同步');if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'通知设置暂时无法同步');return data as NotificationReply;
}
export async function notificationConfig(accountId:string):Promise<NotificationConfig>{
 const response=await fetch('/api/notifications',{cache:'no-store',signal:AbortSignal.timeout(10000)}),data:unknown=await response.json();
 if(!record(data)||!response.ok)throw new Error(record(data)&&typeof data.error==='string'?data.error:'通知服务暂不可用');if(data.accountId!==accountId)throw new Error('登录账号已更新，请刷新后操作');
 if(typeof data.configured!=='boolean'||(data.publicKey!==null&&typeof data.publicKey!=='string'))throw new Error('通知设置暂时无法同步');return {accountId,configured:data.configured,publicKey:data.publicKey};
}
export async function localPushSubscription(){
 if(!('serviceWorker' in navigator))return null;
 return await (await navigator.serviceWorker.getRegistration('/'))?.pushManager?.getSubscription()??null;
}
export async function syncPushAccount(accountId:string){
 try{const subscription=await localPushSubscription();if(!subscription)return;const state=await notificationRequest(accountId,'status',{endpoint:subscription.endpoint});if(state.resetDevice)await subscription.unsubscribe()}catch{ /* Retry on a later visit; never auto-enable or request permission. */ }
}
export function vapidBytes(key:string){return Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}
export async function connectPushWorker(){
 const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
 const worker=registration.installing;
 if(worker&&worker.state!=='activated')await new Promise<void>((resolve,reject)=>{
  const finish=()=>{if(worker.state==='activated'){clearTimeout(timer);worker.removeEventListener('statechange',finish);resolve()}else if(worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',finish);reject(new Error('通知组件安装失败，请刷新后重试'))}};
  const timer=setTimeout(()=>{worker.removeEventListener('statechange',finish);reject(new Error('通知组件加载较慢，请稍后重试'))},10000);worker.addEventListener('statechange',finish);finish();
 });
 return registration;
}
/** Browser subscription is invalidated before signing out. The auth endpoint
 * also deletes this device's server registration while it still knows its owner. */
export async function disconnectPushForLogout(){
 try{const subscription=await localPushSubscription();if(!subscription)return;const endpoint=subscription.endpoint;try{await subscription.unsubscribe()}catch{}return endpoint}catch{return}
}
