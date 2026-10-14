import {z} from 'zod';
import {month,type Account,type State} from './types';

export const notificationPointsPolicy='2026-10-13-v1';
export const notificationEnablePoints=10;
export const notificationDisablePoints=30;
const entry=z.object({policy:z.literal(notificationPointsPolicy),playerId:z.string().min(1),period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),kind:z.enum(['enable','disable','refund','reactivate']),points:z.number().int(),refundOf:z.string().min(1).optional(),reactivates:z.string().min(1).optional()}).refine(row=>row.points===(row.kind==='enable'?10:row.kind==='disable'?-30:row.kind==='refund'?30:10)&&(row.kind!=='refund'||!!row.refundOf)&&(row.kind!=='reactivate'||!!row.reactivates));
type Source=Pick<State,'audits'>;
export function notificationPointEntries(s:Source){
 const rows=s.audits.flatMap(row=>{
  if(row.action!=='notificationPoints')return [];
  const parsed=entry.safeParse(row.changes);
  return parsed.success?[{...parsed.data,id:row.id,at:row.at,accountId:row.actor}]:[];
 });
 const penalties=new Map(rows.filter(row=>row.kind==='disable').map(row=>[row.id,row])),settled=new Set<string>();
 return rows.filter(row=>{
  if(row.kind!=='refund'&&row.kind!=='reactivate')return true;
  const penalty=penalties.get((row.kind==='refund'?row.refundOf:row.reactivates)!);
  if(!penalty||penalty.accountId!==row.accountId||(row.kind==='refund'&&(penalty.playerId!==row.playerId||penalty.period!==row.period))||row.at<penalty.at||settled.has(penalty.id))return false;
  settled.add(penalty.id);return true;
 });
}
function pendingPenalty(s:Source,accountId:string){const entries=notificationPointEntries(s).filter(row=>row.accountId===accountId),settled=new Set(entries.filter(row=>row.kind==='refund'||row.kind==='reactivate').map(row=>row.kind==='refund'?row.refundOf:row.reactivates));return entries.filter(row=>row.kind==='disable'&&!settled.has(row.id)).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))[0]}
export function notificationPointsStatus(s:Source,a:Pick<Account,'id'|'playerId'>){
 const entries=notificationPointEntries(s).filter(row=>row.accountId===a.id);
 return {policy:notificationPointsPolicy,enablePoints:notificationEnablePoints,disablePoints:notificationDisablePoints,reactivationPoints:notificationEnablePoints,status:pendingPenalty(s,a.id)?'disabled' as const:entries.some(row=>row.kind==='enable')?'earned' as const:'available' as const};
}
export function recordNotificationPoints(s:Source,a:Account,kind:'enable'|'disable'|'reactivate',now:number){
 const status=notificationPointsStatus(s,a);
 if(kind==='enable'?status.status!=='available':kind==='disable'?status.status!=='earned':status.status!=='disabled')return 0;
 const penalty=kind==='reactivate'?pendingPenalty(s,a.id):undefined;
 const points=kind==='enable'?notificationEnablePoints:kind==='disable'?-notificationDisablePoints:notificationEnablePoints;
 s.audits.push({id:crypto.randomUUID(),actor:a.id,at:now,action:'notificationPoints',reason:kind==='enable'?'首次开启活动通知奖励':kind==='disable'?'主动关闭任意一台通知设备':'重新开启活动通知奖励',changes:{policy:notificationPointsPolicy,playerId:a.playerId,period:month(now),kind,points,...(penalty?{reactivates:penalty.id}:{})}});
 return points;
}
