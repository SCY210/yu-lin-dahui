import {raw} from './store';
import {RequestError} from './request-body';

export class RateLimitError extends RequestError{
 constructor(message:string,public retryAfter:number){super(message,429);this.name='RateLimitError'}
}
export async function rateLimitId(key:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))).map(value=>value.toString(16).padStart(2,'0')).join('')}
export const loginRateKey=(username:string,ip:string)=>'login-pair:'+JSON.stringify([username,ip]);
export function trustedClientIP(req:Request){const ip=req.headers.get('cf-connecting-ip')?.trim().toLowerCase();return ip&&ip.length<=64&&/^[0-9a-f:.]+$/.test(ip)?ip:'unavailable'}

/** Call once per write request. expires is indexed; no cleanup in each bucket. */
export async function cleanExpiredRateLimits(now=Date.now()){
 await raw().prepare('DELETE FROM auth_rate_limits WHERE id IN (SELECT id FROM auth_rate_limits WHERE expires<=? ORDER BY expires LIMIT 100)').bind(now).run();
}
const wait=(expires:number,now:number)=>Math.max(1,Math.ceil((expires-now)/1000));

/** The conditional UPSERT atomically reserves an amount; rejected requests do
 * not consume remaining bytes or extend the existing fixed window. */
export async function consumeRateLimit(key:string,max:number,window:number,{amount=1,now=Date.now(),expires=now+window,message='请求较多，请稍后重试'}:{amount?:number;now?:number;expires?:number;message?:string}={}){
 if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(max)||max<=0)throw new Error('Invalid rate-limit amount');
 const id=await rateLimitId(key);
 if(amount>max)throw new RateLimitError(message,wait(expires,now));
 const row=await raw().prepare('INSERT INTO auth_rate_limits(id,count,expires) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN auth_rate_limits.expires<=? THEN excluded.count ELSE auth_rate_limits.count+excluded.count END,expires=CASE WHEN auth_rate_limits.expires<=? THEN excluded.expires ELSE auth_rate_limits.expires END WHERE auth_rate_limits.expires<=? OR auth_rate_limits.count<=? RETURNING count,expires').bind(id,amount,expires,now,now,now,max-amount).first<{count:number;expires:number}>();
 if(!row){const current=await raw().prepare('SELECT expires FROM auth_rate_limits WHERE id=?').bind(id).first<{expires:number}>();throw new RateLimitError(message,wait(current?.expires??expires,now))}
 return {id,count:row.count,expires:row.expires};
}

const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
const offsetFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',timeZoneName:'shortOffset'});
export function uploadDayWindow(now=Date.now()){
 const parts=dayFormatter.formatToParts(now),part=(name:string)=>parts.find(p=>p.type===name)!.value;
 const year=Number(part('year')),month=Number(part('month')),day=Number(part('day')),utc=Date.UTC(year,month-1,day+1);
 const offset=offsetFormatter.formatToParts(utc).find(p=>p.type==='timeZoneName')!.value.match(/^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/);
 if(!offset)throw new Error('Timezone offset unavailable');
 const minutes=offset[1]?(offset[1]==='-'?-1:1)*(Number(offset[2])*60+Number(offset[3]??0)):0;
 return {day:`${part('year')}-${part('month')}-${part('day')}`,expires:utc-minutes*60000};
}

/** A request-id marker and its byte reservation commit together. Provisional
 * count=0 exists only inside the atomic batch; duplicates never debit twice.
 * Valid authorized upload attempts count once even if storage later fails. */
async function reserveIdempotentAmount(bucketKey:string,requestKey:string,bytes:number,max:number,expires:number,message:string,now:number){
 const bucket=await rateLimitId(bucketKey),marker=await rateLimitId(requestKey);
 if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>max)throw new RateLimitError(message,wait(expires,now));
 try{
  const results=await raw().batch([
   raw().prepare('INSERT INTO auth_rate_limits(id,count,expires) VALUES(?,0,?) ON CONFLICT(id) DO UPDATE SET count=0,expires=excluded.expires WHERE auth_rate_limits.expires<=?').bind(marker,expires,now),
   raw().prepare('INSERT INTO auth_rate_limits(id,count,expires) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM auth_rate_limits WHERE id=? AND count=0) ON CONFLICT(id) DO UPDATE SET count=auth_rate_limits.count+excluded.count WHERE auth_rate_limits.count<=?').bind(bucket,bytes,expires,marker,max-bytes),
   // Failed quota reservation must roll back its provisional request marker.
   raw().prepare('INSERT INTO auth_rate_limits(id,count,expires) SELECT ?,0,? WHERE changes()=0 AND EXISTS(SELECT 1 FROM auth_rate_limits WHERE id=? AND count=0)').bind(marker,expires,marker),
   raw().prepare('UPDATE auth_rate_limits SET count=? WHERE id=? AND count=0').bind(bytes,marker),
  ]);
  const receipt=await raw().prepare('SELECT count FROM auth_rate_limits WHERE id=?').bind(marker).first<{count:number}>();
  if(receipt?.count!==bytes)throw new RequestError('请求标识已被其他内容使用，请刷新重试',409);
  return {charged:results[1].meta.changes===1,bytes,expires};
 }catch(error){if(String(error).includes('UNIQUE constraint failed: auth_rate_limits.id'))throw new RateLimitError(message,wait(expires,now));throw error}
}

export async function reserveUploadBytes(accountId:string,requestId:string,bytes:number,isAdmin:boolean,now=Date.now()){
 const {day,expires}=uploadDayWindow(now),max=(isAdmin?250:50)*1024*1024;
 return reserveIdempotentAmount('upload-bytes:'+accountId+':'+day,'upload-request:'+accountId+':'+requestId,bytes,max,expires,'今日图片上传额度已用完，请明天再试',now);
}

export async function reserveDailyCreation(accountId:string,requestId:string,action:'friend'|'event',isAdmin:boolean,now=Date.now()){
 const {day,expires}=uploadDayWindow(now),max=isAdmin?100:action==='friend'?20:10;
 return reserveIdempotentAmount('creation-daily:'+action+':'+accountId+':'+day,'creation-request:'+action+':'+accountId+':'+requestId,1,max,expires,action==='friend'?'今日新增朋友档案已达上限，请明天再试':'今日创建活动已达上限，请明天再试',now);
}
