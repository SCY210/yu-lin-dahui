import {z} from 'zod';
import {month,type Account,type State} from './types';

export const notificationPointsPolicy='2026-10-13-v1';
export const notificationEnablePoints=10;
export const notificationDisablePoints=30;
const entry=z.object({policy:z.literal(notificationPointsPolicy),playerId:z.string().min(1),period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),kind:z.enum(['enable','disable','refund']),points:z.number().int(),refundOf:z.string().min(1).optional()}).refine(row=>row.points===(row.kind==='enable'?10:row.kind==='disable'?-30:30)&&(row.kind!=='refund'||!!row.refundOf));
type Source=Pick<State,'audits'>;
export function notificationPointEntries(s:Source){
 const rows=s.audits.flatMap(row=>{
  if(row.action!=='notificationPoints')return [];
  const parsed=entry.safeParse(row.changes);
  return parsed.success?[{...parsed.data,id:row.id,at:row.at,accountId:row.actor}]:[];
 });
 const penalties=new Map(rows.filter(row=>row.kind==='disable').map(row=>[row.id,row])),refunded=new Set<string>();
 return rows.filter(row=>{
  if(row.kind!=='refund')return true;
  const penalty=penalties.get(row.refundOf!);
  if(!penalty||penalty.accountId!==row.accountId||penalty.playerId!==row.playerId||penalty.period!==row.period||row.at<penalty.at||refunded.has(penalty.id))return false;
  refunded.add(penalty.id);return true;
 });
}
function pendingPenalty(s:Source,accountId:string){const entries=notificationPointEntries(s).filter(row=>row.accountId===accountId),refunded=new Set(entries.filter(row=>row.kind==='refund').map(row=>row.refundOf));return entries.filter(row=>row.kind==='disable'&&!refunded.has(row.id)).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))[0]}
export function notificationPointsStatus(s:Source,a:Pick<Account,'id'|'playerId'>){
 const entries=notificationPointEntries(s).filter(row=>row.accountId===a.id);
 return {policy:notificationPointsPolicy,enablePoints:notificationEnablePoints,disablePoints:notificationDisablePoints,refundPoints:notificationDisablePoints,status:pendingPenalty(s,a.id)?'disabled' as const:entries.some(row=>row.kind==='enable')?'earned' as const:'available' as const};
}
export function recordNotificationPoints(s:Source,a:Account,kind:'enable'|'disable'|'refund',now:number){
 const status=notificationPointsStatus(s,a);
 if(kind==='enable'?status.status!=='available':kind==='disable'?status.status!=='earned':status.status!=='disabled')return 0;
 const penalty=kind==='refund'?pendingPenalty(s,a.id):undefined;
 const points=kind==='enable'?notificationEnablePoints:kind==='disable'?-notificationDisablePoints:notificationDisablePoints;
 s.audits.push({id:crypto.randomUUID(),actor:a.id,at:now,action:'notificationPoints',reason:kind==='enable'?'首次开启活动通知奖励':kind==='disable'?'主动关闭任意一台通知设备':'重新开启通知退还关闭扣分',changes:{policy:notificationPointsPolicy,playerId:penalty?.playerId??a.playerId,period:penalty?.period??month(now),kind,points,...(penalty?{refundOf:penalty.id}:{})}});
 return points;
}
