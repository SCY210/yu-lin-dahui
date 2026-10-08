import {raw} from './store';
export async function pushSubscriptionId(endpoint:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));
 return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function removePushSubscription(accountId:string,endpoint:string){
 await raw().prepare('DELETE FROM push_subscriptions WHERE id=? AND account_id=?').bind(await pushSubscriptionId(endpoint),accountId).run();
}
