import {env} from 'cloudflare:workers';
import {getAppUser} from '../../../../lib/auth';
import {raw,load,save,committed} from '../../../../lib/store';
import {readJsonBody} from '../../../../lib/request-body';
import {assertWriteRequest,releaseRejectedWriteBody,writeErrorResponse} from '../../../../lib/write-security';
import {cleanExpiredRateLimits,consumeRateLimit,trustedClientIP} from '../../../../lib/rate-limit';
import {deleteStoredPhoto} from '../../../../lib/delete-photo';
import {matchesPhotoEtag,photoCacheControl,photoEtag} from '../../../../lib/photo-cache';
import {z} from 'zod';
import {canManageEvent} from '../../../../lib/domain/permissions';
import type {Account,Event,Photo} from '../../../../lib/domain/types';
export const dynamic='force-dynamic';
function photoResponse(body:BodyInit|null,status=200,type='text/plain; charset=utf-8',etag?:string){
 return new Response(body,{status,headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':etag?photoCacheControl:'private, no-store','Vary':'Cookie',...(etag?{'ETag':etag}:{})}});
}

export async function GET(req:Request,context:{params:Promise<{id:string}>}){
 try{
  const u=await getAppUser();if(!u)return photoResponse('请登录',401);
  const {id}=await context.params,db=raw();
  // Three indexed lookups in one round trip, including event permissions.
  const row=await db.prepare(`SELECT a.payload AS accountPayload,p.payload AS photoPayload,e.payload AS eventPayload
   FROM accounts a LEFT JOIN photos p ON p.id=?
   LEFT JOIN events e ON e.id=json_extract(p.payload,'$.eventId') WHERE a.id=?`)
   .bind(id,u.userId).first<{accountPayload:string;photoPayload:string|null;eventPayload:string|null}>();
  if(!row)return photoResponse('请加入群组',403);
  if(!row.photoPayload)return photoResponse('照片不存在',404);
  const a=JSON.parse(row.accountPayload) as Account,p=JSON.parse(row.photoPayload) as Photo;
  if(p.eventId){
   const event=row.eventPayload?JSON.parse(row.eventPayload) as Event:null;
   if(!event||event.deletedAt!==undefined||event.status==='draft'&&!canManageEvent(a,event))return photoResponse('照片不存在',404);
  }
  // A validator is useful only after fresh authentication and authorization.
  const etag=await photoEtag(p,a.id);
  if(req.method==='GET'&&matchesPhotoEtag(req.headers.get('If-None-Match'),etag))return photoResponse(null,304,p.type,etag);
  const object=await env.BUCKET?.get(p.key);if(!object)return photoResponse('照片暂不可用',404);
  return photoResponse(object.body,200,p.type,req.method==='GET'?etag:undefined);
 }catch{return photoResponse('照片读取失败',503)}
}

export async function POST(req:Request,context:{params:Promise<{id:string}>}){
 try{
  assertWriteRequest(req);await cleanExpiredRateLimits();
  await consumeRateLimit('photo-delete-ip:'+trustedClientIP(req),120,5*60000,{message:'当前网络操作较多，请稍后重试'});
  const user=await getAppUser();if(!user)return Response.json({error:'请先登录'},{status:401});
  await consumeRateLimit('photo-delete-actor:'+user.userId,60,5*60000,{message:'删除操作较频繁，请稍后重试'});
  if(!env.BUCKET)return Response.json({error:'照片存储暂不可用，请稍后重试'},{status:503});
  const {id}=await context.params;
  const photoId=z.string().min(1).max(100).parse(id);
  const body=z.object({action:z.literal('delete'),requestId:z.string().uuid(),revision:z.number().int().nonnegative()}).parse(await readJsonBody(req));
  const state=await load(),account=state.accounts.find(a=>a.id===user.userId);if(!account)return Response.json({error:'账号不可用'},{status:403});
  const result=await deleteStoredPhoto({userId:user.userId,photoId,requestId:body.requestId,revision:body.revision},{load,save,committed,deleteObject:key=>env.BUCKET!.delete(key)});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return writeErrorResponse(error)}finally{await releaseRejectedWriteBody(req)}
}
