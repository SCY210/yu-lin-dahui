import {raw} from './store';
import {pushSubscriptionId} from './push-subscriptions';

const cookieName='yulin_push_device';
export function newNotificationDeviceToken(){return [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('')}
export function notificationDeviceToken(req:Request){
 const value=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 return value&&/^[0-9a-f]{64}$/.test(value)?value:null;
}
export function notificationDeviceCookie(token:string,req:Request){return `${cookieName}=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${new URL(req.url).protocol==='https:'?'; Secure':''}`}
export function notificationDeviceStatement(accountId:string,subscriptionId:string,receiptId:string){
 return raw().prepare(`INSERT INTO notification_devices(id,account_id,subscription_id,active,created_at)
 SELECT ?,?,?,1,? WHERE EXISTS(SELECT 1 FROM push_subscriptions WHERE id=? AND account_id=?)
 ON CONFLICT(account_id,subscription_id) DO UPDATE SET id=excluded.id,active=1,created_at=excluded.created_at`).bind(receiptId,accountId,subscriptionId,Date.now(),subscriptionId,accountId);
}
/** Receipt identifies this browser, never an arbitrary device on the account. */
export async function notificationDeviceFor(req:Request,accountId:string,endpoint?:string){
 const token=notificationDeviceToken(req);
 if(token){const receiptId=await pushSubscriptionId(token),row=await raw().prepare('SELECT subscription_id AS subscriptionId FROM notification_devices WHERE id=? AND account_id=? AND active=1').bind(receiptId,accountId).first<{subscriptionId:string}>();if(row)return {id:row.subscriptionId,receiptId}}
 // Upgrade browsers that retain their old subscription but predate receipts.
 if(endpoint){const id=await pushSubscriptionId(endpoint),row=await raw().prepare('SELECT id FROM push_subscriptions WHERE id=? AND account_id=?').bind(id,accountId).first();if(row)return {id}}
 return null;
}
