import {env} from 'cloudflare:workers';
import {getAppUser} from '../../../../lib/auth';
import {raw} from '../../../../lib/store';
import {canManageEvent} from '../../../../lib/domain/permissions';
import type {Account,Event,Photo} from '../../../../lib/domain/types';
export const dynamic='force-dynamic';

export async function GET(_req:Request,context:{params:Promise<{id:string}>}){
 try{
  const u=await getAppUser();if(!u)return new Response('请登录',{status:401});
  const {id}=await context.params,db=raw();
  // An avatar request needs two small rows, not every activity and match table.
  const [accounts,photos]=await db.batch<{payload:string}>([
   db.prepare('SELECT payload FROM accounts WHERE id=?').bind(u.userId),
   db.prepare('SELECT payload FROM photos WHERE id=?').bind(id),
  ]);
  const accountRow=accounts.results[0],photoRow=photos.results[0];
  if(!accountRow)return new Response('请加入群组',{status:403});
  if(!photoRow)return new Response('照片不存在',{status:404});
  const a=JSON.parse(String(accountRow.payload)) as Account,p=JSON.parse(String(photoRow.payload)) as Photo;
  if(p.eventId){
   const row=await db.prepare('SELECT payload FROM events WHERE id=?').bind(p.eventId).first<{payload:string}>();
   const event=row?JSON.parse(row.payload) as Event:null;
   if(!event||event.deletedAt!==undefined||event.status==='draft'&&!canManageEvent(a,event))return new Response('照片不存在',{status:404});
  }
  const object=await env.BUCKET?.get(p.key);if(!object)return new Response('照片暂不可用',{status:404});
  return new Response(object.body,{headers:{'Content-Type':p.type,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=300'}});
 }catch{return new Response('照片读取失败',{status:503})}
}
