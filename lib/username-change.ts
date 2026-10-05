import {raw,load,save,committed} from './store';
import {getAppUser,hashToken,sessionCookie,type AppUser} from './auth';
import {checkPassword} from './password';
import {emptyState,type Account} from './domain/types';
import {isClubOwner} from './domain/ownership';
import {RequestError} from './request-body';
import {canChangeOwnUsername,type ChangeUsernameInput} from './username-policy';

type Credential={username:string;salt:string;hash:string;usernameChangedAt:number|null};
export type UsernameChangeResult={ok:true;accountId:string;username:string;usernameChangedAt:number|null;signedOut:boolean;duplicate?:true};
const reject=(message:string,status:number):never=>{throw new RequestError(message,status)};
const snapshot=(accountId:string)=>raw().prepare('SELECT username,salt,hash,username_changed_at AS usernameChangedAt FROM password_credentials WHERE id=?').bind(accountId).first<Credential>();
const unchanged=(a:Credential|null,b:Credential|null)=>a===null?b===null:!!b&&a.username===b.username&&a.salt===b.salt&&a.hash===b.hash&&a.usernameChangedAt===b.usernameChangedAt;

/** Auth metadata needs three indexed reads, rather than the entire club history. */
export async function loginAccountMetadata(accountId:string){
 const rows=await raw().batch([
  raw().prepare('SELECT payload FROM settings WHERE id=?').bind('club'),
  raw().prepare('SELECT payload FROM accounts WHERE id=?').bind(accountId),
  raw().prepare('SELECT username,username_changed_at AS usernameChangedAt FROM password_credentials WHERE id=?').bind(accountId),
 ]);
 const state=emptyState(),setting=rows[0].results[0] as {payload:string}|undefined,account=rows[1].results[0] as {payload:string}|undefined;
 if(setting)state.settings=JSON.parse(setting.payload);
 const actor:Account|undefined=account?JSON.parse(account.payload):undefined;
 if(actor)state.accounts.push(actor);
 const credential=(rows[2].results[0] as {username:string;usernameChangedAt:number|null}|undefined)??null;
 const isOwner=!!actor&&isClubOwner(state,actor);
 return {username:credential?.username??null,passwordEnabled:!!credential,isOwner,canChangeUsername:canChangeOwnUsername(isOwner,credential),usernameChangedAt:credential?.usernameChangedAt??null};
}

/** Actor authentication and the target's credential snapshot must both survive
 * until the same atomic batch. Username changes do not alter account/player IDs. */
export async function changeLoginUsername(user:AppUser,input:ChangeUsernameInput,req:Request):Promise<UsernameChangeResult>{
 const initial=await load(),actor=initial.accounts.find(a=>a.id===user.userId)??reject('账号不可用',403);
 const targetId=input.accountId??actor.id,owner=isClubOwner(initial,actor);
 if(targetId!==actor.id&&!owner)reject('只有群主可以修改其他人的登录账号',403);
 if(!initial.accounts.some(a=>a.id===targetId))reject('目标账号不存在',404);
 const actorCredential=await snapshot(actor.id);
 if(actorCredential){
  const currentPassword=input.currentPassword??reject('请填写本人当前密码',400);
  if(!checkPassword(currentPassword,actorCredential.salt,actorCredential.hash))reject('当前密码不正确',401);
 }else if(!owner||user.method!=='chatgpt')reject('请先开通账号密码登录',409);
 const targetCredential=await snapshot(targetId)??reject('目标尚未开通账号密码登录',409);
 const key=actor.id+':changeUsername:'+input.requestId,auditId='username:'+actor.id+':'+input.requestId;
 const token=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);
 const actorSession=user.method==='password'&&token?await hashToken(token):null;
 if(user.method==='password'&&!actorSession)reject('登录已失效，请重新登录',401);
 for(let attempt=0;attempt<4;attempt++){
  const freshUser=await getAppUser();
  if(!freshUser||freshUser.userId!==actor.id||freshUser.method!==user.method)reject('登录已失效，请重新登录',401);
  const state=await load(),freshActor=state.accounts.find(a=>a.id===actor.id)??reject('账号不可用',403),freshOwner=isClubOwner(state,freshActor);
  if(targetId!==actor.id&&!freshOwner)reject('群主权限已变更',403);
  if(freshOwner!==owner)reject('账号权限已更新，请刷新重试',409);
  if(!state.accounts.some(a=>a.id===targetId))reject('目标账号不存在',404);
  if(!unchanged(actorCredential,await snapshot(actor.id)))reject('本人登录凭据已更新，请重新验证',401);
  if(await committed(key)){
   const receipt=await raw().prepare('SELECT payload FROM audits WHERE id=?').bind(auditId).first<{payload:string}>();
   const changes=receipt?JSON.parse(receipt.payload).changes:undefined;
   if(changes?.accountId!==targetId||changes?.username!==input.newUsername)reject('请求标识已被其他修改使用，请刷新重试',409);
   const current=await snapshot(targetId)??reject('目标账号不可用',409);
   // Do not revoke devices which logged in after the original successful change.
   return {ok:true,accountId:targetId,username:current.username,usernameChangedAt:current.usernameChangedAt,signedOut:false,duplicate:true};
  }
  const current=await snapshot(targetId);
  if(!unchanged(targetCredential,current))reject('目标登录账号已更新，请刷新重试',409);
  if(!freshOwner&&targetCredential.usernameChangedAt!==null)reject('每人只能自主修改登录账号一次',409);
  if(targetCredential.username.toLowerCase()===input.newUsername)reject('新账号不能与当前账号相同',400);
  const occupied=await raw().prepare('SELECT id FROM password_credentials WHERE username=? COLLATE NOCASE AND id<>?').bind(input.newUsername,targetId).first();
  if(occupied)reject('这个登录账号已被使用',409);
  const previous=structuredClone(state),now=Date.now(),changedAt=freshOwner?targetCredential.usernameChangedAt:now;
  state.audits.push({id:auditId,at:now,actor:actor.id,action:'changeLoginUsername',reason:freshOwner?'群主修改登录账号，保留成员自主修改次数':'本人使用一次自主修改登录账号机会',changes:{accountId:targetId,previousUsername:targetCredential.username,username:input.newUsername,selfChangeConsumed:!freshOwner,requestId:input.requestId}});
  const assignments=freshOwner?'username=?':'username=?,username_changed_at=?';
  const values:unknown[]=freshOwner?[input.newUsername]:[input.newUsername,now];
  const conditions=['id=?','username=?','salt=?','hash=?'];
  values.push(targetId,targetCredential.username,targetCredential.salt,targetCredential.hash);
  if(!freshOwner)conditions.push('username_changed_at IS NULL');
  if(actorCredential){
   conditions.push('EXISTS(SELECT 1 FROM password_credentials actor WHERE actor.id=? AND actor.username=? AND actor.salt=? AND actor.hash=?)');
   values.push(actor.id,actorCredential.username,actorCredential.salt,actorCredential.hash);
  }else{
   conditions.push('NOT EXISTS(SELECT 1 FROM password_credentials actor WHERE actor.id=?)');values.push(actor.id);
  }
  if(actorSession){conditions.push('EXISTS(SELECT 1 FROM auth_sessions WHERE id=? AND user_id=? AND expires>?)');values.push(actorSession,actor.id,now)}
  try{
   await save(state,key,previous,[
    raw().prepare(`UPDATE password_credentials SET ${assignments} WHERE ${conditions.join(' AND ')}`).bind(...values),
    raw().prepare('INSERT INTO commits(revision,key,at) SELECT ?,?,? WHERE changes()=0').bind(state.revision+1,key,now),
    raw().prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(targetId),
   ]);
   return {ok:true,accountId:targetId,username:input.newUsername,usernameChangedAt:changedAt,signedOut:targetId===actor.id};
  }catch(error){
   if(String(error).includes('UNIQUE constraint failed: password_credentials.username'))reject('这个登录账号已被使用',409);
   if(String(error).includes('UNIQUE constraint failed: commits')){if(attempt<3)continue;reject('账号已更新或同时修改较多，请刷新重试',409)}
   throw error;
  }
 }
 return reject('修改未完成，请刷新重试',409);
}
