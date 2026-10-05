import {readJsonBody} from '../../../lib/request-body';
import {assertWriteRequest,releaseRejectedWriteBody,writeErrorResponse} from '../../../lib/write-security';
import {cleanExpiredRateLimits,consumeRateLimit,loginRateKey,rateLimitId,trustedClientIP} from '../../../lib/rate-limit';
import {assertAccountMutable,assertPlayerMutable} from '../../../lib/domain/ownership';
import {newUsername as username,changeUsernameInput} from '../../../lib/username-policy';
import {changeLoginUsername,loginAccountMetadata} from '../../../lib/username-change';
import {publicApiError} from '../../../lib/api-error';
import {z} from 'zod';
import {load,raw,save,committed} from '../../../lib/store';
import {getAppUser,hashToken,passwordEnabled,sessionCookie} from '../../../lib/auth';
import {makePassword,checkPassword,sessionToken,normalizeUsername} from '../../../lib/password';
export const dynamic='force-dynamic';
const password=z.string().min(12).max(128);
const age=14*86400;
function cookie(name:string,value:string,req:Request,maxAge:number){return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${new URL(req.url).protocol==='https:'?'; Secure':''}`}
function result(data:unknown,req:Request,token?:string){const h=new Headers({'Cache-Control':'no-store'});if(token){h.append('Set-Cookie',cookie(sessionCookie,token,req,age));h.append('Set-Cookie',cookie('yulin_signed_out','',req,0))}return Response.json(data,{headers:h})}
function denied(error:string,status=403){return Response.json({error},{status,headers:{'Cache-Control':'no-store'}})}
const conflict=(e:unknown)=>String(e).includes('UNIQUE constraint failed: commits');
export async function GET(){try{const u=await getAppUser();return Response.json(u?{signedIn:true,method:u.method,...await loginAccountMetadata(u.userId)}:{signedIn:false},{headers:{'Cache-Control':'no-store'}})}catch(error){const safe=publicApiError(error);return denied(safe.error,safe.status)}}
export async function POST(req:Request){try{
 assertWriteRequest(req);const ip=trustedClientIP(req);
 const input:any=await readJsonBody(req,8192),action=z.enum(['login','bind','createAccount','resetPassword','changePassword','changeUsername','logout']).parse(input.action);
 if(action==='logout'){
  const token=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);
  if(token&&/^[A-Za-z0-9_-]{43}$/.test(token))await raw().prepare('DELETE FROM auth_sessions WHERE id=?').bind(await hashToken(token)).run();
  const h=new Headers({'Cache-Control':'no-store'});h.append('Set-Cookie',cookie(sessionCookie,'',req,0));h.append('Set-Cookie',cookie('yulin_signed_out','1',req,age));
  return Response.json({ok:true},{headers:h});
 }
 await cleanExpiredRateLimits();
 await consumeRateLimit('auth-ip:'+ip,120,15*60000,{message:'登录请求较多，请稍后再试'});
 if(action==='login'){
  const p=z.object({username:z.string().trim().min(1).max(254).transform(normalizeUsername),password:z.string().min(1).max(128)}).parse(input);
  const pairId=await rateLimitId(loginRateKey(p.username,ip));
  await consumeRateLimit(loginRateKey(p.username,ip),8,15*60000,{message:'当前网络尝试次数较多，请15分钟后重试'});
  const c=await raw().prepare('SELECT id,username,salt,hash FROM password_credentials WHERE username=?').bind(p.username).first<{id:string;username:string;salt:string;hash:string}>();
  const valid=checkPassword(p.password,c?.salt??'dummy-salt-for-timing-v1',c?.hash??'00'.repeat(64));
  if(!c||!valid)return denied('账号或密码不正确',401);
  if(!await raw().prepare('SELECT id FROM accounts WHERE id=?').bind(c.id).first())return denied('账号暂不可用');
  const token=sessionToken();
  const saved=await raw().batch([
   // A simultaneous reset must not issue a session based on a stale password hash.
   raw().prepare('INSERT INTO auth_sessions(id,user_id,expires) SELECT ?,?,? FROM password_credentials WHERE id=? AND username=? AND salt=? AND hash=?').bind(await hashToken(token),c.id,Date.now()+age*1000,c.id,c.username,c.salt,c.hash),
   raw().prepare('DELETE FROM auth_rate_limits WHERE id=?').bind(pairId),
   raw().prepare('DELETE FROM auth_sessions WHERE expires<=?').bind(Date.now())
  ]);
  if(!saved[0].meta.changes)return denied('账号或密码已更新，请重新登录',401);
  return result({ok:true},req,token);
 }
 const user=await getAppUser();if(!user)return denied('请先登录账号',401);
 if(action==='changeUsername'){
  const p=changeUsernameInput.parse(input),meta=await loginAccountMetadata(user.userId);
  await consumeRateLimit('changeUsername:'+user.userId,meta.isOwner?40:8,15*60000,{message:'修改账号尝试较多，请15分钟后重试'});
  const changed=await changeLoginUsername(user,p,req);
  if(!changed.signedOut)return result(changed,req);
  const h=new Headers({'Cache-Control':'no-store'});h.append('Set-Cookie',cookie(sessionCookie,'',req,0));h.append('Set-Cookie',cookie('yulin_signed_out','1',req,age));
  return Response.json(changed,{headers:h});
 }
 if(action==='changePassword'){
  await consumeRateLimit('changePassword:'+user.userId,8,15*60000,{message:'修改密码尝试较多，请15分钟后重试'});
  const parsed=z.object({action:z.literal('changePassword'),currentPassword:z.string().min(1).max(128),newPassword:password,confirmPassword:password,requestId:z.string().uuid()}).strict().safeParse(input);
  if(!parsed.success)return denied('请填写当前密码、新密码和确认密码；新密码须为12–128位',400);
  const p=parsed.data;
  if(p.newPassword!==p.confirmPassword)return denied('两次新密码不一致',400);
  const original=await raw().prepare('SELECT salt,hash FROM password_credentials WHERE id=?').bind(user.userId).first<{salt:string;hash:string}>();
  if(!original)return denied('请先开通账号密码登录',409);
  if(!checkPassword(p.currentPassword,original.salt,original.hash))return denied('当前密码不正确',401);
  if(p.currentPassword===p.newPassword)return denied('新密码不能与当前密码相同',400);
  const next=makePassword(p.newPassword),key=user.userId+':changePassword:'+p.requestId;
  const token=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);
  const sessionId=user.method==='password'&&token?await hashToken(token):null;
  for(let attempt=0;attempt<4;attempt++){
   const freshUser=await getAppUser();if(!freshUser||freshUser.userId!==user.userId||freshUser.method!==user.method)return denied('登录已失效，请重新登录',401);
   const s=await load();if(!s.accounts.some(a=>a.id===user.userId))return denied('账号不可用');
   const current=await raw().prepare('SELECT salt,hash FROM password_credentials WHERE id=?').bind(user.userId).first<{salt:string;hash:string}>();
   if(!current||current.salt!==original.salt||current.hash!==original.hash)return denied('密码已更新，请重新登录',409);
   const previous=structuredClone(s),now=Date.now();
   s.audits.push({id:crypto.randomUUID(),at:now,actor:user.userId,action:'changeOwnPassword',reason:'修改本人登录密码并退出全部登录会话'});
   try{
    await save(s,key,previous,[
     raw().prepare('UPDATE password_credentials SET salt=?,hash=? WHERE id=? AND salt=? AND hash=? AND (? IS NULL OR EXISTS(SELECT 1 FROM auth_sessions WHERE id=? AND user_id=? AND expires>?))').bind(next.salt,next.hash,user.userId,original.salt,original.hash,sessionId,sessionId,user.userId,now),
     // UPDATE must affect one row. A duplicate commit aborts the entire batch
     // when a concurrent reset or session revocation invalidates the snapshot.
     raw().prepare('INSERT INTO commits(revision,key,at) SELECT ?,?,? WHERE changes()=0').bind(s.revision+1,key,now),
     raw().prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.userId),
    ]);
    const h=new Headers({'Cache-Control':'no-store'});h.append('Set-Cookie',cookie(sessionCookie,'',req,0));h.append('Set-Cookie',cookie('yulin_signed_out','1',req,age));
    return Response.json({ok:true,signedOut:true},{headers:h});
   }catch(e){if(conflict(e)){if(attempt<3)continue;return denied('账号已更新或同时修改较多，请重新登录后重试',409)}throw e}
  }
 }
 const initial=await load(),actor=initial.accounts.find(a=>a.id===user.userId);
 if(!actor)return denied('请联系管理员开通账号');
 if(action==='bind'){
  if(user.method!=='chatgpt')return denied('请先使用原账号完成身份确认');
  const p=z.object({username,password}).parse(input),token=sessionToken(),key='bind:'+crypto.randomUUID();
  let cred:ReturnType<typeof makePassword>|undefined;
  for(let attempt=0;attempt<4;attempt++){
   const s=await load(),a=s.accounts.find(a=>a.id===user.userId);if(!a)return denied('账号不可用');
   if(await passwordEnabled(a.id))return denied('已开通账号密码登录，请直接登录',409);
   if(await raw().prepare('SELECT id FROM password_credentials WHERE username=?').bind(p.username).first())return denied('这个账号名已被使用',409);
   cred??=makePassword(p.password);const previous=structuredClone(s);
   s.audits.push({id:crypto.randomUUID(),at:Date.now(),actor:a.id,action:'enableAccountLogin',reason:'原身份确认后启用账号密码登录'});
   try{
    await save(s,key,previous,[
     raw().prepare('INSERT INTO password_credentials(id,username,salt,hash,created) VALUES(?,?,?,?,?)').bind(a.id,p.username,cred.salt,cred.hash,Date.now()),
     raw().prepare('INSERT INTO auth_sessions(id,user_id,expires) VALUES(?,?,?)').bind(await hashToken(token),a.id,Date.now()+age*1000)
    ]);
    return result({ok:true,username:p.username},req,token);
   }catch(e){if(conflict(e)){if(attempt<3)continue;return denied('同时修改较多，请稍后重试',409)}if(String(e).includes('UNIQUE constraint failed: password_credentials'))return denied('账号已开通或账号名已被使用',409);throw e}
  }
 }
 if(actor.role!=='admin')return denied('只有管理员可以创建账号或重置密码');
 if(action==='resetPassword'){
  const p=z.object({accountId:z.string().min(1),password,requestId:z.string().uuid()}).parse(input),key=actor.id+':resetPassword:'+p.requestId;
  let cred:ReturnType<typeof makePassword>|undefined;
  for(let attempt=0;attempt<4;attempt++){
   const s=await load();if(s.accounts.find(a=>a.id===user.userId)?.role!=='admin')return denied('管理员权限已变更');
   if(await committed(key))return result({ok:true,duplicate:true},req);
   assertAccountMutable(s,s.accounts.find(a=>a.id===user.userId)!,p.accountId);
   if(!s.accounts.some(a=>a.id===p.accountId)||!await passwordEnabled(p.accountId))return denied('目标账号尚未开通密码登录',404);
   cred??=makePassword(p.password);const previous=structuredClone(s);
   s.audits.push({id:crypto.randomUUID(),at:Date.now(),actor:user.userId,action:'resetAccountPassword',reason:'管理员重置登录密码',changes:{accountId:p.accountId}});
   try{
    await save(s,key,previous,[raw().prepare('UPDATE password_credentials SET salt=?,hash=? WHERE id=?').bind(cred.salt,cred.hash,p.accountId),raw().prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(p.accountId)]);
    return result({ok:true},req);
   }catch(e){if(conflict(e)){if(attempt<3)continue;return denied('同时修改较多，请稍后重试',409)}throw e}
  }
 }
 if(action==='createAccount'){
  const p=z.object({name:z.string().trim().min(1).max(150),username,password,requestId:z.string().uuid(),playerId:z.string().optional(),accountId:z.string().optional()}).parse(input);
  if(p.accountId&&p.playerId)return denied('请只选择账号或球友档案中的一种绑定方式',400);
  const key=actor.id+':createAccount:'+p.requestId,newId='account:'+crypto.randomUUID(),newPlayerId=crypto.randomUUID();
  let cred:ReturnType<typeof makePassword>|undefined;
  for(let attempt=0;attempt<4;attempt++){
   const s=await load();if(s.accounts.find(a=>a.id===user.userId)?.role!=='admin')return denied('管理员权限已变更');
   if(await committed(key))return result({ok:true,duplicate:true},req);
   if(await raw().prepare('SELECT id FROM password_credentials WHERE username=?').bind(p.username).first())return denied('这个账号名已被使用',409);
   const existing=p.accountId?s.accounts.find(a=>a.id===p.accountId):undefined;
   if(p.accountId&&!existing)return denied('原账号不存在',404);
   const freshActor=s.accounts.find(a=>a.id===user.userId)!;
   if(existing)assertAccountMutable(s,freshActor,existing.id);
   if(p.playerId)assertPlayerMutable(s,freshActor,p.playerId);
   if(existing&&await passwordEnabled(existing.id))return denied('原账号已有登录账号，请使用重置密码',409);
   const player=existing?s.players.find(v=>v.id===existing.playerId):p.playerId?s.players.find(v=>v.id===p.playerId):undefined;
   if((existing||p.playerId)&&!player)return denied('球友档案不存在',404);
   if(player)assertPlayerMutable(s,freshActor,player.id);
   if(!existing&&player&&s.accounts.some(a=>a.playerId===player.id))return denied('该球友已有账号，请开通原账号或重置密码',409);
   const accountId=existing?.id??newId,playerId=player?.id??newPlayerId;
   cred??=makePassword(p.password);const previous=structuredClone(s);
   if(!existing)s.accounts.push({id:accountId,email:'',role:'member',playerId});
   if(player){if(!existing)player.ownerId=accountId}
   else s.players.push({id:playerId,ownerId:accountId,name:p.name,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'管理员创建球友账号'});
   s.audits.push({id:crypto.randomUUID(),at:Date.now(),actor:user.userId,action:'createLoginAccount',reason:existing?'为原账号开通登录':player?'为已有球友档案创建登录':'管理员创建普通成员账号',changes:{accountId,playerId,username:p.username}});
   try{
    await save(s,key,previous,[raw().prepare('INSERT INTO password_credentials(id,username,salt,hash,created) VALUES(?,?,?,?,?)').bind(accountId,p.username,cred.salt,cred.hash,Date.now())]);
    return result({ok:true,accountId,username:p.username},req);
   }catch(e){if(conflict(e)){if(attempt<3)continue;return denied('同时创建较多，请稍后重试',409)}if(String(e).includes('UNIQUE constraint failed: password_credentials'))return denied('账号名已被使用或原账号已开通',409);throw e}
  }
 }
 return denied('操作未完成，请稍后重试',409);
}catch(e){if(e instanceof z.ZodError)return denied('请检查输入：新登录账号须为2–32位英文字母和数字；密码至少12位',400);return writeErrorResponse(e)}finally{await releaseRejectedWriteBody(req,8192)}}
