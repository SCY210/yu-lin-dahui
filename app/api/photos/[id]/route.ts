import {env} from 'cloudflare:workers';
import {getAppUser} from '../../../../lib/auth';
import {raw,load,save,committed} from '../../../../lib/store';
import {readJsonBody} from '../../../../lib/request-body';
import {assertWriteRequest,releaseRejectedWriteBody,writeErrorResponse} from '../../../../lib/write-security';
import {cleanExpiredRateLimits,consumeRateLimit,trustedClientIP} from '../../../../lib/rate-limit';
import {deleteStoredPhoto} from '../../../../lib/delete-photo';
import {z} from 'zod';
import {canManageEvent} from '../../../../lib/domain/permissions';
import type {Account,Event,Photo} from '../../../../lib/domain/types';
export const dynamic='force-dynamic';
function photoResponse(body:BodyInit|null,status=200,type='text/plain; charset=utf-8'){
 return new Response(body,{status,headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Vary':'Cookie'}});
}

export async function GET(_req:Request,context:{params:Promise<{id:string}>}){
 try{
  const u=await getAppUser();if(!u)return photoResponse('请登录',401);
  const {id}=await context.params,db=raw();
  // An avatar request needs two small rows, not every activity and match table.
  const [accounts,photos]=await db.batch<{payload:string}>([
   db.prepare('SELECT payload FROM accounts WHERE id=?').bind(u.userId),
   db.prepare('SELECT payload FROM photos WHERE id=?').bind(id),
  ]);
  const accountRow=accounts.results[0],photoRow=photos.results[0];
  if(!accountRow)return photoResponse('请加入群组',403);
  if(!photoRow)return photoResponse('照片不存在',404);
  const a=JSON.parse(String(accountRow.payload)) as Account,p=JSON.parse(String(photoRow.payload)) as Photo;
  if(p.eventId){
   const row=await db.prepare('SELECT payload FROM events WHERE id=?').bind(p.eventId).first<{payload:string}>();
   const event=row?JSON.parse(row.payload) as Event:null;
   if(!event||event.deletedAt!==undefined||event.status==='draft'&&!canManageEvent(a,event))return photoResponse('照片不存在',404);
  }
  const object=await env.BUCKET?.get(p.key);if(!object)return photoResponse('照片暂不可用',404);
  return photoResponse(object.body,200,p.type);
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
  const result=await deleteStoredPhoto({userId:user.userId,photoId,requestId:body.requestId,revision:body.revision},{load,save,committed,deleteObject:key=>env.BUCKET!.delete(key)});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return writeErrorResponse(error)}finally{await releaseRejectedWriteBody(req)}
}
