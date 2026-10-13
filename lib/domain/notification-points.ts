import {z} from 'zod';
import {month,type Account,type State} from './types';

export const notificationPointsPolicy='2026-10-13-v1';
export const notificationEnablePoints=10;
export const notificationDisablePoints=30;
const entry=z.object({policy:z.literal(notificationPointsPolicy),playerId:z.string().min(1),period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),kind:z.enum(['enable','disable']),points:z.number().int()}).refine(row=>row.points===(row.kind==='enable'?10:-30));
type Source=Pick<State,'audits'>;
export function notificationPointEntries(s:Source){
 return s.audits.flatMap(row=>{
  if(row.action!=='notificationPoints')return [];
  const parsed=entry.safeParse(row.changes);
  return parsed.success?[{...parsed.data,id:row.id,at:row.at,accountId:row.actor}]:[];
 });
}
export function notificationPointsStatus(s:Source,a:Pick<Account,'id'|'playerId'>){
 const entries=notificationPointEntries(s).filter(row=>row.accountId===a.id);
 return {policy:notificationPointsPolicy,enablePoints:notificationEnablePoints,disablePoints:notificationDisablePoints,status:entries.some(row=>row.kind==='disable')?'disabled' as const:entries.some(row=>row.kind==='enable')?'earned' as const:'available' as const};
}
export function recordNotificationPoints(s:Source,a:Account,kind:'enable'|'disable',now:number){
 const status=notificationPointsStatus(s,a);
 if(kind==='enable'?status.status!=='available':status.status!=='earned')return 0;
 s.audits.push({id:crypto.randomUUID(),actor:a.id,at:now,action:'notificationPoints',reason:kind==='enable'?'首次开启活动通知奖励':'主动关闭全部通知设备',changes:{policy:notificationPointsPolicy,playerId:a.playerId,period:month(now),kind,points:kind==='enable'?notificationEnablePoints:-notificationDisablePoints}});
 return kind==='enable'?notificationEnablePoints:-notificationDisablePoints;
}
