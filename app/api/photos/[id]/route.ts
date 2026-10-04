import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {load} from '../../../../lib/store';
export const dynamic='force-dynamic';
export async function GET(_req:Request,context:{params:Promise<{id:string}>}){try{const u=await getChatGPTUser();if(!u)return new Response('请登录',{status:401});const s=await load(),a=s.accounts.find(a=>a.id===u.userId);if(!a)return new Response('请加入群组',{status:403});const {id}=await context.params,p=s.photos.find(p=>p.id===id);if(!p||p.eventId&&a.role!=='admin'&&s.events.find(e=>e.id===p.eventId)?.status==='draft')return new Response('照片不存在',{status:404});const object=await env.BUCKET?.get(p.key);if(!object)return new Response('照片暂不可用',{status:404});return new Response(object.body,{headers:{'Content-Type':p.type,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=300'}})}catch{return new Response('照片读取失败',{status:503})}}
