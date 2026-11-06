import {cookies} from 'next/headers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {raw} from './store';
export type AppUser={userId:string;email:string;username:string|null;displayName:string;fullName:string|null;method:'password'|'chatgpt'};
export async function hashToken(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export const sessionCookie='yulin_session';
// A password credential is only a lookup key, never proof of authentication.
// Narrow reads can join its fresh session check to their authorization query.
export type AppCredential={method:'password';sessionId:string}|{method:'chatgpt';user:AppUser};
export async function getAppCredential():Promise<AppCredential|null>{
 const c=await cookies(),session=c.get(sessionCookie);
 if(session){
  const token=session.value;if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  return {method:'password',sessionId:await hashToken(token)};
 }
 if(c.get('yulin_signed_out')?.value==='1')return null;
 const u=await getChatGPTUser();
 return u?{method:'chatgpt',user:{...u,username:null,method:'chatgpt'}}:null;
}
export async function getAppUser():Promise<AppUser|null>{
 const credential=await getAppCredential();if(!credential)return null;
 if(credential.method==='chatgpt')return credential.user;
 const row=await raw().prepare('SELECT s.user_id, c.username FROM auth_sessions s JOIN password_credentials c ON c.id=s.user_id WHERE s.id=? AND s.expires>?')
  .bind(credential.sessionId,Date.now()).first<{user_id:string;username:string}>();
 return row?{userId:row.user_id,email:'',username:row.username,displayName:row.username,fullName:null,method:'password'}:null;
}
export async function passwordEnabled(userId:string){return !!await raw().prepare('SELECT id FROM password_credentials WHERE id=?').bind(userId).first()}
