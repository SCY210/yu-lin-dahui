import {raw} from './store';
export async function pushSubscriptionId(endpoint:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));
 return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function removePushSubscription(accountId:string,endpoint:string){
 const id=await pushSubscriptionId(endpoint),db=raw();
 await db.batch([db.prepare('DELETE FROM push_subscriptions WHERE id=? AND account_id=?').bind(id,accountId),db.prepare('UPDATE notification_devices SET active=0 WHERE account_id=? AND subscription_id=?').bind(accountId,id)]);
}
