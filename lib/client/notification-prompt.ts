/** Device-local prompt preference only; club data remains on the server. */
export const notificationPromptSnooze=7*24*60*60*1000;
const key=(accountId:string)=>'yulin:notification-prompt:v1:'+encodeURIComponent(accountId);
type PromptStorage=Pick<Storage,'getItem'|'setItem'>;
export function notificationPromptDue(storage:PromptStorage,accountId:string,now=Date.now()){
 try{const until=Number(storage.getItem(key(accountId)));return !Number.isFinite(until)||until<=now||until>now+notificationPromptSnooze}catch{return true}
}
export function postponeNotificationPrompt(storage:PromptStorage,accountId:string,now=Date.now()){
 try{storage.setItem(key(accountId),String(now+notificationPromptSnooze))}catch{/* The current visit still dismisses normally when storage is unavailable. */}
}
