import {z} from 'zod';
import {privateEventState} from './domain/event-privacy';
import {maskClubContent} from './domain/blocked-words';
import type {Account,State} from './domain/types';
import {RequestError} from './request-body';

export const auditWeek=7*24*60*60*1000;
export const auditPageSize=50;
const cursorSchema=z.object({at:z.number().int().nonnegative().safe(),id:z.string().min(1).max(200),end:z.number().int().nonnegative().safe()}).strict();
type AuditCursor=z.infer<typeof cursorSchema>;

/** Read on demand, never add a week's audit payload to the regular club polling response. */
export function auditLogPage(s:State,a:Account,now:number,input?:string|null){
 if(a.role!=='admin')throw new RequestError('仅宗主或副宗主可以查看操作日志',403);
 let cursor:AuditCursor|undefined;
 if(input!==undefined&&input!==null){
  try{if(input.length>1024)throw new Error();cursor=cursorSchema.parse(JSON.parse(input))}catch{throw new RequestError('日志翻页参数无效')}
  if(cursor.end>now||cursor.at>cursor.end)throw new RequestError('日志翻页参数无效');
  if(cursor.end<now-auditWeek)throw new RequestError('日志时间范围已过期，请刷新');
 }
 const from=now-auditWeek,to=cursor?.end??now;
 const visible=privateEventState(s,a).audits.filter(row=>row.at>=from&&row.at<=to&&(!cursor||row.at<cursor.at||row.at===cursor.at&&row.id<cursor.id));
 visible.sort((a,b)=>b.at-a.at||(a.id===b.id?0:a.id>b.id?-1:1));
 const audits=visible.slice(0,auditPageSize),last=audits.at(-1);
 return maskClubContent({accountId:a.id,from,to,audits,nextCursor:visible.length>auditPageSize&&last?JSON.stringify({at:last.at,id:last.id,end:to}):null},s.settings.blockedWords??[]);
}

export type AuditLogPage=ReturnType<typeof auditLogPage>;
