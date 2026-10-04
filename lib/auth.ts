import {cookies} from 'next/headers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {raw} from './store';
export type AppUser={userId:string;email:string;username:string|null;displayName:string;fullName:string|null;method:'password'|'chatgpt'};
export async function hashToken(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export const sessionCookie='yulin_session';
export async function getAppUser():Promise<AppUser|null>{const c=await cookies(),token=c.get(sessionCookie)?.value;if(token&&/^[A-Za-z0-9_-]{43}$/.test(token)){const row=await raw().prepare('SELECT s.user_id, c.username FROM auth_sessions s JOIN password_credentials c ON c.id=s.user_id WHERE s.id=? AND s.expires>?').bind(await hashToken(token),Date.now()).first<{user_id:string;username:string}>();if(row)return {userId:row.user_id,email:'',username:row.username,displayName:row.username,fullName:null,method:'password'}}if(c.get('yulin_signed_out')?.value==='1')return null;const u=await getChatGPTUser();return u?{...u,username:null,method:'chatgpt'}:null}
export async function passwordEnabled(userId:string){return !!await raw().prepare('SELECT id FROM password_credentials WHERE id=?').bind(userId).first()}
