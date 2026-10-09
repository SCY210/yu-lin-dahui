import {RequestError} from './request-body';
import {publicApiError} from './api-error';
import {RateLimitError} from './rate-limit';
import {reportServerError} from './observability';

/** Cancelling a tee branch can wait for another branch. Start cancellation
 * without blocking an error response; the Worker wrapper keeps it alive. */
export function cancelUnreadWriteBody(req:Request):Promise<void>|undefined{
 if(req.method!=='POST'||!req.body||req.bodyUsed||req.body.locked)return;
 try{return req.body.cancel().catch(()=>{})}catch{return}
}

/** Initialize and release an early-rejected stream, then stop at the bounded
 * byte/time budget. No parsing, retained buffers or unbounded upload drain. */
export async function releaseRejectedWriteBody(req:Request,maximum=64*1024){
 if(req.method!=='POST'||!req.body||req.bodyUsed||req.body.locked)return;
 const declared=req.headers.get('content-length');
 if(declared!==null&&/^\d+$/.test(declared.trim())&&Number(declared)>maximum){void cancelUnreadWriteBody(req);return}
 const reader=req.body.getReader(),deadline=Date.now()+250;let bytes=0,complete=false;
 try{
  for(;;){
   const remaining=deadline-Date.now();if(remaining<=0)break;
   let timer:ReturnType<typeof setTimeout>|undefined;
   const result=await Promise.race([
    reader.read(),
    new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),remaining)}),
   ]);
   if(timer!==undefined)clearTimeout(timer);
   if(!result)break;if(result.done){complete=true;break}
   bytes+=result.value.byteLength;if(bytes>=maximum)break;
  }
 }catch{}finally{
  if(!complete)void reader.cancel().catch(()=>{});
  try{reader.releaseLock()}catch{}
 }
}

/** Origin is a CSRF boundary, not a replacement for authenticated permissions. */
export function assertWriteRequest(req:Request,kind:'json'|'multipart'='json'){
 if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')?.trim().toLowerCase()==='cross-site')throw new RequestError('请求来源不允许',403);
 const full=req.headers.get('content-type')??'',type=full.split(';')[0].trim().toLowerCase();
 const valid=kind==='json'?(type==='application/json'||/^application\/[a-z0-9.+-]+\+json$/.test(type)):(type==='multipart/form-data'&&/;\s*boundary=(?:"[^"]+"|[^;\s]+)/i.test(full));
 if(!valid)throw new RequestError(kind==='json'?'请使用JSON格式提交请求':'请使用表单格式上传照片',415);
}
export function writeErrorResponse(error:unknown){
 const safe=publicApiError(error),headers=new Headers({'Cache-Control':'no-store'});
 if(safe.status>=500){const requestId=crypto.randomUUID();headers.set('X-Request-ID',requestId);reportServerError(error,requestId)}
 if(error instanceof RateLimitError){headers.set('Retry-After',String(error.retryAfter));return Response.json({error:safe.error,retryAfter:error.retryAfter},{status:429,headers})}
 return Response.json({error:safe.error},{status:safe.status,headers});
}
