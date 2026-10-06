import {z} from 'zod';
import type {State,Event} from './domain/types';

export function allowedPushEndpoint(value:string){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.search&&(!u.port||u.port==='443')&&u.pathname.length>1&&(
  u.hostname==='fcm.googleapis.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.notify.windows.com')
 )}catch{return false}
}
export const pushEndpoint=z.string().max(2048).refine(allowedPushEndpoint,'推送地址不受支持');
const key=(length:number)=>z.string().regex(/^[A-Za-z0-9_-]+$/).refine(s=>{try{return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)).length===length}catch{return false}},'通知加密信息无效');
export const pushSubscriptionInput=z.object({endpoint:pushEndpoint,expirationTime:z.number().finite().nonnegative().nullable().optional(),keys:z.object({p256dh:key(65),auth:key(16)}).strict()}).strict();
export type StoredPushSubscription=z.infer<typeof pushSubscriptionInput>;
export function newlyOpenedSignups(next:State,previous:State,now=Date.now()):Event[]{
 const before=new Map(previous.events.map(e=>[e.id,e]));
 return next.events.filter(e=>e.status==='open'&&e.deletedAt===undefined&&e.end>now&&(!before.has(e.id)||(before.get(e.id)!.status==='draft'&&before.get(e.id)!.deletedAt===undefined)));
}
const format=new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
export function signupPushMessage(e:Event){return {title:'羽林大会 · 新接龙',body:e.title.slice(0,80)+' · '+format.format(e.start)+' · '+e.venue.slice(0,60),eventId:e.id,kind:'signup',tag:'yulin-signup-'+e.id}}
export const testPushMessage={title:'羽林大会 · 通知测试',body:'通知已连接。新接龙、我的报名和重要活动消息会在这里提醒你。',kind:'test',tag:'yulin-push-test'};
