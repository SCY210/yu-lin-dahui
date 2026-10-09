import {assertPlayerMutable} from '../../../lib/domain/ownership';
import {assertFullProfileEditable} from '../../../lib/domain/profile-permissions';
import {readPhotoForm} from '../../../lib/request-body';
import {assertWriteRequest,releaseRejectedWriteBody,writeErrorResponse} from '../../../lib/write-security';
import {cleanExpiredRateLimits,consumeRateLimit,reserveUploadBytes,trustedClientIP} from '../../../lib/rate-limit';
import {validateImage} from '../../../lib/image-validation';
import {assertImageRights} from '../../../lib/image-rights';
import {fail} from '../../../lib/domain/types';
import {env} from 'cloudflare:workers';
import {getAppUser} from '../../../lib/auth';
import {load,save,committed} from '../../../lib/store';
import {z} from 'zod';
import {canManageEvent} from '../../../lib/domain/permissions';
export const dynamic='force-dynamic';

export async function POST(req:Request){
 let uploadedKey:string|null=null;
 try{
  assertWriteRequest(req,'multipart');const ip=trustedClientIP(req);await cleanExpiredRateLimits();
  await consumeRateLimit('upload-ip:'+ip,100,10*60000,{message:'当前网络上传较多，请稍后再试'});
  const u=await getAppUser();if(!u)return Response.json({error:'请先登录'},{status:401});
  await consumeRateLimit('upload-actor:'+u.userId,10,10*60000,{message:'图片上传较频繁，请10分钟后再试'});
  if(!env.BUCKET)return Response.json({error:'照片存储暂不可用，请稍后重试'},{status:503});
  const f=await readPhotoForm(req),requestId=z.string().uuid().parse(f.get('requestId')),key=u.userId+':'+requestId;
  const s=await load(),a=s.accounts.find(a=>a.id===u.userId);
  if(!a)return Response.json({error:'请先加入群组'},{status:403});
  if(await committed(key))return Response.json({ok:true,duplicate:true});
  const rights=assertImageRights(f);
  if(Number(f.get('revision'))!==s.revision)return Response.json({error:'数据已更新，请刷新后重新上传'},{status:409});
  const file=f.get('file');if(!(file instanceof File)||!file.size||file.size>5*1024*1024)fail('请选择不超过5MB的JPEG、PNG或WebP照片');
  const kind=z.enum(['avatar','photo','racket']).parse(f.get('kind')),caption=z.string().max(300).parse(f.get('caption')??'');
  let eventId:string|null=null,matchId:string|null=null,playerIds:string[]=[];
  if(kind==='avatar'||kind==='racket'){
   const playerId=z.string().trim().min(1).max(100).parse(f.get('playerId')),p=s.players.find(p=>p.id===playerId);
   if(!p)return Response.json({error:'球友档案不存在'},{status:404});assertPlayerMutable(s,a,p.id);assertFullProfileEditable(s,p.id);
   if(a.role!=='admin'&&p.id!==a.playerId)return Response.json({error:'只能上传自己的档案照片'},{status:403});
   playerIds=[p.id];
  }else{
   eventId=z.string().min(1).parse(f.get('eventId'));const e=s.events.find(e=>e.id===eventId);
   if(!e||e.deletedAt!==undefined||!canManageEvent(a,e)&&e.status==='draft')fail('活动不可访问');
   if(!canManageEvent(a,e)&&!s.attendance.some(at=>at.eventId===eventId&&at.playerId===a.playerId))return Response.json({error:'活动创建者、管理员或实际参加者才可以上传活动照片'},{status:403});
   const requested=String(f.get('matchId')??'');
   if(requested){const m=s.matches.find(m=>m.id===requested&&m.eventId===eventId);if(!m)fail('比赛不属于本次活动');matchId=m.id;playerIds=[...m.a,...m.b]}
   else{playerIds=[...new Set(z.array(z.string()).max(30).parse(JSON.parse(String(f.get('playerIds')??'[]'))))];if(playerIds.some(id=>!s.attendance.some(at=>at.eventId===eventId&&at.playerId===id)))fail('关联球友必须实际参加本次活动')}
  }
  const bytes=new Uint8Array(await file.arrayBuffer()),image=validateImage(bytes,file.type);
  await reserveUploadBytes(a.id,requestId,file.size,a.role==='admin');
  const previous=structuredClone(s),assetId=crypto.randomUUID();
  if(kind==='avatar')s.players.find(p=>p.id===playerIds[0])!.avatarId=assetId;
  uploadedKey='media/'+assetId;await env.BUCKET.put(uploadedKey,bytes,{httpMetadata:{contentType:image.type}});
  s.photos.push({id:assetId,key:uploadedKey,kind,eventId,matchId,playerIds,ownerId:a.id,caption,created:Date.now(),type:image.type,size:file.size});
  s.audits.push({id:crypto.randomUUID(),at:Date.now(),actor:a.id,action:'photoUpload',reason:kind==='avatar'?'更新头像':kind==='racket'?'上传战拍照片':'上传活动照片',changes:{assetId,eventId,matchId,playerIds,...rights}});
  await save(s,key,previous);uploadedKey=null;return Response.json({ok:true,id:assetId});
 }catch(error){
  if(uploadedKey&&env.BUCKET)try{await env.BUCKET.delete(uploadedKey)}catch{}
  return writeErrorResponse(error);
 }finally{await releaseRejectedWriteBody(req,6*1024*1024)}
}
