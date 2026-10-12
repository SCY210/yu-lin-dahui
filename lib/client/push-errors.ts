/** Browser push-provider failures are separate from account login and permission denial. */
const providerErrorCode='yulin-browser-push-unavailable';
/** Call only around PushManager.subscribe; API aborts must not unlock setup. */
export function browserPushError(error:unknown){
 const detail=error&&typeof error==='object'?error as {name?:unknown;message?:unknown}:null;
 const message=typeof detail?.message==='string'?detail.message:'';
 if(detail?.name!=='AbortError'&&!/push service (?:error|not available)|could not connect to push server/i.test(message))return error;
 return Object.assign(new Error(message,{cause:error}),{code:providerErrorCode});
}
export function pushFailure(error:unknown,fallback='开启通知失败，请稍后重试'){
 const detail=error&&typeof error==='object'?error as {code?:unknown;message?:unknown}:null;
 const message=typeof detail?.message==='string'?detail.message:'';
 const serviceUnavailable=detail?.code===providerErrorCode;
 return {serviceUnavailable,message:serviceUnavailable
  ?'浏览器的系统推送服务连接失败，登录不受影响。请检查网络连接或更新浏览器后重试，也可以先进入网站查看站内提醒。'
  :message||fallback};
}
