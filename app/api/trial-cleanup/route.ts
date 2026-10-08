import {z} from 'zod';
import {getAppUser} from '../../../lib/auth';
import {load,raw,save,committed} from '../../../lib/store';
import {readJsonBody} from '../../../lib/request-body';
import {assertWriteRequest,releaseRejectedWriteBody,writeErrorResponse} from '../../../lib/write-security';
import {consumeRateLimit} from '../../../lib/rate-limit';
import {archiveTrials,restoreTrials,trialCleanupStatus,trialTargets} from '../../../lib/domain/trial-cleanup';
export const dynamic='force-dynamic';
const archiveKey='trial-accounts-v1';
const credentialSchema=z.object({id:z.string(),username:z.string(),salt:z.string().regex(/^[a-f0-9]{64}$/),hash:z.string().regex(/^[a-f0-9]{128}$/),created:z.number().int().nonnegative(),username_changed_at:z.number().int().nonnegative().nullable()});
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try{const u=await getAppUser();if(!u)return reply({error:'请先登录'},401);const s=await load(),a=s.accounts.find(a=>a.id===u.userId);if(!a)return reply({error:'账号不可用'},403);return reply(trialCleanupStatus(s,a))}catch(e){return writeErrorResponse(e)}}
export async function POST(req:Request){try{
 assertWriteRequest(req);const u=await getAppUser();if(!u)return reply({error:'请先登录'},401);
 const p=z.object({action:z.enum(['remove','restore']),requestId:z.string().uuid(),revision:z.number().int().nonnegative()}).strict().parse(await readJsonBody(req,2048));
 await consumeRateLimit('trial-cleanup:'+u.userId,10,60000);
 const s=await load(),a=s.accounts.find(a=>a.id===u.userId);if(!a)return reply({error:'账号不可用'},403);
 trialCleanupStatus(s,a);const key=u.userId+':trial-cleanup:'+p.requestId;
 if(await committed(key))return reply({ok:true,duplicate:true});
 if(p.revision!==s.revision)return reply({error:'数据已更新，请刷新重试'},409);
 const db=raw(),before=structuredClone(s),extra:D1PreparedStatement[]=[],beforeChanges:D1PreparedStatement[]=[];
 const archived=await db.prepare('SELECT payload FROM trial_credential_archive WHERE id=?').bind(archiveKey).first<{payload:string}>();
 if(p.action==='remove'){
  if(archived)return reply({error:'试用账号已存档，请刷新检查'},409);
  const credentials=[];
  for(const t of trialTargets){const c=await db.prepare('SELECT id,username,salt,hash,created,username_changed_at FROM password_credentials WHERE id=?').bind(t.accountId).first();const parsed=credentialSchema.safeParse(c);if(!parsed.success||parsed.data.username!==t.username)return reply({error:'试用登录账号已变化，请先核对'},409);credentials.push(parsed.data)}
  if(archiveTrials(s,a,Date.now())){
   beforeChanges.push(db.prepare('INSERT INTO trial_credential_archive(id,payload) VALUES(?,?)').bind(archiveKey,JSON.stringify(credentials)));
   for(const t of trialTargets){beforeChanges.push(db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(t.accountId));beforeChanges.push(db.prepare('DELETE FROM password_credentials WHERE id=?').bind(t.accountId))}
  }
 }else{
  if(!archived)return reply({error:'未找到可恢复的试用账号'},409);
  const credentials=z.array(credentialSchema).length(3).parse(JSON.parse(archived.payload));
  if(!trialTargets.every(t=>credentials.some(c=>c.id===t.accountId&&c.username===t.username)))return reply({error:'存档身份不匹配，不能恢复'},409);
  for(const c of credentials){if(await db.prepare('SELECT id FROM password_credentials WHERE id=? OR username=?').bind(c.id,c.username).first())return reply({error:'账号名或身份已被使用，不能覆盖恢复'},409)}
  if(restoreTrials(s,a,Date.now())){for(const c of credentials)extra.push(db.prepare('INSERT INTO password_credentials(id,username,salt,hash,created,username_changed_at) VALUES(?,?,?,?,?,?)').bind(c.id,c.username,c.salt,c.hash,c.created,c.username_changed_at));extra.push(db.prepare('DELETE FROM trial_credential_archive WHERE id=?').bind(archiveKey))}
 }
 await save(s,key,before,extra,beforeChanges);return reply({ok:true});
 }catch(e){if(String(e).includes('UNIQUE constraint failed: commits'))return reply({error:'其他成员刚刚保存了变更，请刷新重试'},409);return writeErrorResponse(e)}finally{await releaseRejectedWriteBody(req)}}
