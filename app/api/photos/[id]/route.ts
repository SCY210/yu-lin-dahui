import {env} from 'cloudflare:workers';
import {getAppUser} from '../../../../lib/auth';
import {raw,load,save,committed} from '../../../../lib/store';
import {readJsonBody} from '../../../../lib/request-body';
import {assertWriteRequest,releaseRejectedWriteBody,writeErrorResponse} from '../../../../lib/write-security';
import {cleanExpiredRateLimits,consumeRateLimit,trustedClientIP} from '../../../../lib/rate-limit';
import {deleteStoredPhoto} from '../../../../lib/delete-photo';
import {matchesPhotoEtag,photoCacheControl,photoEtag} from '../../../../lib/photo-cache';
import {z} from 'zod';
import {readAuthorizedPhoto} from '../../../../lib/photo-read';
import {parsePhotoVariant,photoVariantVersion,deletePhotoObjects,readPhotoRepresentation} from '../../../../lib/photo-variants';
export const dynamic='force-dynamic';
function photoResponse(body:BodyInit|null,status=200,type='text/plain; charset=utf-8',etag?:string){
 return new Response(body,{status,headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':etag?photoCacheControl:'private, no-store','Vary':'Cookie',...(etag?{'ETag':etag}:{})}});
}

export async function GET(req:Request,context:{params:Promise<{id:string}>}){
 try{
  const {id}=await context.params,access=await readAuthorizedPhoto(id);
  if(access.status!==200)return photoResponse(access.status===401?'请登录':access.status===403?'请加入群组':'照片不存在',access.status);
  const {account:a,photo:p}=access;
  // A validator is useful only after fresh authentication and authorization.
  const variant=parsePhotoVariant(new URL(req.url).searchParams.get('size'));
  const etag=await photoEtag(p,a.id,variant?photoVariantVersion(variant):undefined);
  if(req.method==='GET'&&matchesPhotoEtag(req.headers.get('If-None-Match'),etag))return photoResponse(null,304,variant?'image/webp':p.type,etag);
  if(!env.BUCKET)return photoResponse('照片暂不可用',404);
  const originalEtag=variant?await photoEtag(p,a.id):etag;
  const object=await readPhotoRepresentation({photo:p,variant,bucket:env.BUCKET,images:env.IMAGES,originalUnchanged:req.method==='GET'&&matchesPhotoEtag(req.headers.get('If-None-Match'),originalEtag),
   isCurrent:async()=>!!await raw().prepare("SELECT id FROM photos WHERE id=? AND json_extract(payload,'$.key')=?").bind(p.id,p.key).first(),
  });
  if(!object)return photoResponse('照片暂不可用',404);
  // An unavailable encoder returns the original, with its own validator. A
  // later successful conversion must not be mistaken for the cached original.
  const actualEtag=object.variant===variant?etag:originalEtag;
  if(req.method==='GET'&&matchesPhotoEtag(req.headers.get('If-None-Match'),actualEtag)){
   if(object.body instanceof ReadableStream)await object.body.cancel();
   return photoResponse(null,304,object.type,actualEtag);
  }
  return photoResponse(object.body,200,object.type,req.method==='GET'?actualEtag:undefined);
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
  const result=await deleteStoredPhoto({userId:user.userId,photoId,requestId:body.requestId,revision:body.revision},{load,save,committed,deleteObject:key=>deletePhotoObjects(env.BUCKET!,key)});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return writeErrorResponse(error)}finally{await releaseRejectedWriteBody(req)}
}
