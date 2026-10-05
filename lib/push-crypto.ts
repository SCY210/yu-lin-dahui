import {buildPushPayload} from '@block65/webcrypto-web-push';
import {allowedPushEndpoint,type StoredPushSubscription} from './push-contract';

export type PushConfig={publicKey:string;privateKey:string;subject:string};
export type PushEnvironment={PUSH_VAPID_PUBLIC_KEY?:string;PUSH_VAPID_PRIVATE_KEY?:string;PUSH_VAPID_SUBJECT?:string};
export function pushConfiguration(source:PushEnvironment):PushConfig|null{
 const publicKey=source.PUSH_VAPID_PUBLIC_KEY,privateKey=source.PUSH_VAPID_PRIVATE_KEY,subject=source.PUSH_VAPID_SUBJECT;
 if(typeof publicKey!=='string'||typeof privateKey!=='string'||typeof subject!=='string'||!/^https:\/\//.test(subject))return null;
 return {publicKey,privateKey,subject};
}
export async function verifySubscriptionKeys(subscription:StoredPushSubscription){
 const point=Uint8Array.from(atob(subscription.keys.p256dh.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 await crypto.subtle.importKey('raw',point,{name:'ECDH',namedCurve:'P-256'},false,[]);
}
export async function sendWebPush(subscription:StoredPushSubscription,message:unknown,config:PushConfig,send:typeof fetch=fetch){
 if(!allowedPushEndpoint(subscription.endpoint))throw new Error('Unsupported push service');
 const request=await buildPushPayload({data:JSON.stringify(message),options:{ttl:86400}}, {...subscription,expirationTime:subscription.expirationTime??null},config);
 const response=await send(subscription.endpoint,{...request,redirect:'manual',signal:AbortSignal.timeout(4000)});
 return response.status;
}
