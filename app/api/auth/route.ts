import {z} from 'zod';
import {load,raw,save,committed} from '../../../lib/store';
import {getAppUser,hashToken,passwordEnabled,sessionCookie} from '../../../lib/auth';
import {makePassword,checkPassword,sessionToken,normalizeUsername} from '../../../lib/password';
export const dynamic='force-dynamic';
const password=z.string().min(12).max(128);
const username=z.string().trim().transform(normalizeUsername).pipe(z.string().min(2).max(32).regex(/^[a-z0-9_\-\u4e00-\u9fff]+$/));
const age=14*86400;
async function readBody(req:Request){
 const reader=req.body?.getReader();if(!reader)return '';
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new Error('认证请求过大')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 return new TextDecoder().decode(bytes);
}
function cookie(name:string,value:string,req:Request,maxAge:number){return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${new URL(req.url).protocol==='https:'?'; Secure':''}`}
function result(data:unknown,req:Request,token?:string){const h=new Headers({'Cache-Control':'no-store'});if(token){h.append('Set-Cookie',cookie(sessionCookie,token,req,age));h.append('Set-Cookie',cookie('yulin_signed_out','',req,0))}return Response.json(data,{headers:h})}
function denied(error:string,status=403){return Response.json({error},{status,headers:{'Cache-Control':'no-store'}})}
async function limit(key:string,max:number,window:number){
 const id=await hashToken(key),now=Date.now();
 await raw().prepare('DELETE FROM auth_rate_limits WHERE id IN (SELECT id FROM auth_rate_limits WHERE expires<=? LIMIT 100)').bind(now).run();
 const row=await raw().prepare('INSERT INTO auth_rate_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN auth_rate_limits.expires<=? THEN 1 ELSE auth_rate_limits.count+1 END,expires=CASE WHEN auth_rate_limits.expires<=? THEN excluded.expires ELSE auth_rate_limits.expires END RETURNING count').bind(id,now+window,now,now).first<{count:number}>();
 return (row?.count??max+1)<=max;
}
const conflict=(e:unknown)=>String(e).includes('UNIQUE constraint failed: commits');
export async function GET(){const u=await getAppUser();return Response.json(u?{signedIn:true,method:u.method,username:u.username,passwordEnabled:await passwordEnabled(u.userId)}:{signedIn:false},{headers:{'Cache-Control':'no-store'}})}
export async function POST(req:Request){try{
 const body=await readBody(req);
 if(req.headers.get('origin')!==new URL(req.url).origin)return denied('请求来源不允许');
 const input:any=JSON.parse(body),action=z.enum(['login','bind','createAccount','resetPassword','logout']).parse(input.action),ip=req.headers.get('cf-connecting-ip')??'local';
 if(action==='logout'){
  const token=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);
  if(token)await raw().prepare('DELETE FROM auth_sessions WHERE id=?').bind(await hashToken(token)).run();
  const h=new Headers({'Cache-Control':'no-store'});h.append('Set-Cookie',cookie(sessionCookie,'',req,0));h.append('Set-Cookie',cookie('yulin_signed_out','1',req,age));
  return Response.json({ok:true},{headers:h});
 }
 if(!await limit('ip:'+ip,120,15*60000))return denied('登录请求较多，请稍后再试',429);
 if(action==='login'){
  const p=z.object({username:z.string().trim().min(1).max(254).transform(normalizeUsername),password:z.string().min(1).max(128)}).parse(input);
  if(!await limit('login:'+p.username,8,15*60000))return denied('尝试次数较多，请15分钟后重试',429);
  const c=await raw().prepare('SELECT id,username,salt,hash FROM password_credentials WHERE username=?').bind(p.username).first<{id:string;username:string;salt:string;hash:string}>();
  const valid=checkPassword(p.password,c?.salt??'dummy-salt-for-timing-v1',c?.hash??'00'.repeat(64));
  if(!c||!valid)return denied('账号或密码不正确',401);
  if(!await raw().prepare('SELECT id FROM accounts WHERE id=?').bind(c.id).first())return denied('账号暂不可用');
  const token=sessionToken();
  const saved=await raw().batch([
   // A simultaneous reset must not issue a session based on a stale password hash.
   raw().prepare('INSERT INTO auth_sessions(id,user_id,expires) SELECT ?,?,? FROM password_credentials WHERE id=? AND salt=? AND hash=?').bind(await hashToken(token),c.id,Date.now()+age*1000,c.id,c.salt,c.hash),
   raw().prepare('DELETE FROM auth_rate_limits WHERE id=?').bind(await hashToken('login:'+p.username)),
   raw().prepare('DELETE FROM auth_sessions WHERE expires<=?').bind(Date.now())
  ]);
  if(!saved[0].meta.changes)return denied('账号或密码已更新，请重新登录',401);
  return result({ok:true},req,token);
 }
 const user=await getAppUser();if(!user)return denied('请先登录管理员账号',401);
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
  const key=actor.id+':createAccount:'+p.requestId,newId='account:'+crypto.randomUUID(),newPlayerId=crypto.randomUUID();
  let cred:ReturnType<typeof makePassword>|undefined;
  for(let attempt=0;attempt<4;attempt++){
   const s=await load();if(s.accounts.find(a=>a.id===user.userId)?.role!=='admin')return denied('管理员权限已变更');
   if(await committed(key))return result({ok:true,duplicate:true},req);
   if(await raw().prepare('SELECT id FROM password_credentials WHERE username=?').bind(p.username).first())return denied('这个账号名已被使用',409);
   const existing=p.accountId?s.accounts.find(a=>a.id===p.accountId):undefined;
   if(p.accountId&&!existing)return denied('原账号不存在',404);
   if(existing&&await passwordEnabled(existing.id))return denied('原账号已有登录账号，请使用重置密码',409);
   const player=existing?s.players.find(v=>v.id===existing.playerId):p.playerId?s.players.find(v=>v.id===p.playerId):undefined;
   if((existing||p.playerId)&&!player)return denied('球友档案不存在',404);
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
}catch(e){return denied(e instanceof z.ZodError?'请检查输入：账号2–32位中英文、数字、_或-；密码至少12位':'登录操作未完成，请刷新后重试',400)}}
