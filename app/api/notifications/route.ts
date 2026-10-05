import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getAppUser} from '../../../lib/auth';
import {raw,clubReadVersion} from '../../../lib/store';
import {readJsonBody,RequestError} from '../../../lib/request-body';
import {assertWriteRequest,releaseRejectedWriteBody,writeErrorResponse} from '../../../lib/write-security';
import {consumeRateLimit,trustedClientIP} from '../../../lib/rate-limit';
import {pushEndpoint,pushSubscriptionInput,testPushMessage} from '../../../lib/push-contract';
import {pushConfiguration,sendWebPush,verifySubscriptionKeys} from '../../../lib/push-crypto';
import {pushSubscriptionId,removePushSubscription} from '../../../lib/push-subscriptions';
import type {Player} from '../../../lib/domain/types';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const accountId=z.string().min(1).max(150);
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('subscribe'),accountId,subscription:pushSubscriptionInput}).strict(),
 z.object({action:z.enum(['status','unsubscribe','test']),accountId,endpoint:pushEndpoint}).strict(),
]);
async function member(){
 const user=await getAppUser();if(!user)throw new RequestError('请先登录',401);
 const version=await clubReadVersion(user.userId);if(!version.settings.initialized||!version.account)throw new RequestError('仅群组成员可以开启接龙通知',403);
 const row=await raw().prepare('SELECT payload FROM players WHERE id=?').bind(version.account.playerId).first<{payload:string}>();
 if(!row||!(JSON.parse(row.payload) as Player).enabled)throw new RequestError('账号当前不可开启通知',403);
 return version.account;
}
export async function GET(){try{const account=await member(),config=pushConfiguration(env);return reply({accountId:account.id,configured:!!config,publicKey:config?.publicKey??null})}catch(e){return writeErrorResponse(e)}}
export async function POST(req:Request){try{
 assertWriteRequest(req);const account=await member();await consumeRateLimit('push-ip:'+trustedClientIP(req),90,5*60000);await consumeRateLimit('push-account:'+account.id,45,5*60000);
 const p=input.parse(await readJsonBody(req,8192));if(p.accountId!==account.id)throw new RequestError('登录账号已更新，请刷新后操作',409);
 const db=raw(),endpoint=p.action==='subscribe'?p.subscription.endpoint:p.endpoint,id=await pushSubscriptionId(endpoint);
 const existing=await db.prepare('SELECT account_id AS accountId,payload FROM push_subscriptions WHERE id=?').bind(id).first<{accountId:string;payload:string}>();
 if(p.action==='status')return reply({enabled:existing?.accountId===account.id,resetDevice:!!existing&&existing.accountId!==account.id});
 if(p.action==='unsubscribe'){await removePushSubscription(account.id,endpoint);return reply({ok:true,enabled:false})}
 const config=pushConfiguration(env);if(!config)throw new RequestError('通知服务暂不可用，请稍后再试',503);
 if(p.action==='subscribe'){
  if(existing&&existing.accountId!==account.id)throw new RequestError('此设备需要重新连接通知，请关闭后再开启',409);
  if(p.subscription.expirationTime!=null&&p.subscription.expirationTime<=Date.now())throw new RequestError('通知订阅已过期，请重新开启',400);
  try{await verifySubscriptionKeys(p.subscription)}catch{throw new RequestError('通知加密信息无效，请重新开启',400)}
  const result=await db.prepare(`INSERT INTO push_subscriptions(id,account_id,payload,created_at)
   SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM push_subscriptions WHERE account_id=?)<5 OR EXISTS(SELECT 1 FROM push_subscriptions WHERE id=? AND account_id=?)
   ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE push_subscriptions.account_id=excluded.account_id`).bind(id,account.id,JSON.stringify(p.subscription),Date.now(),account.id,id,account.id).run();
  if(!result.meta.changes)throw new RequestError('每个账号最多开启5台设备，请先在旧设备关闭通知',409);
  return reply({ok:true,enabled:true});
 }
 if(!existing||existing.accountId!==account.id)throw new RequestError('请先在这台设备开启接龙通知',409);
 await consumeRateLimit('push-test:'+account.id,3,60000,{message:'测试通知发送较频繁，请一分钟后重试'});
 const status=await sendWebPush(pushSubscriptionInput.parse(JSON.parse(existing.payload)),testPushMessage,config);
 if(status===404||status===410){await removePushSubscription(account.id,endpoint);throw new RequestError('通知连接已失效，请重新开启',409)}
 if(status<200||status>=300)throw new RequestError('测试通知暂时发送失败，请稍后再试',503);
 return reply({ok:true,accepted:true});
}catch(e){return writeErrorResponse(e)}finally{await releaseRejectedWriteBody(req)}}
