'use client';
import {useEffect,useState} from 'react';
import {canManageEvent} from '../lib/domain/permissions';
import {cancellationDeadline,cancellationNeedsApproval} from '../lib/domain/cancellation';
import {fmt} from './ui';

export default function CancelRegistration({e,registration:r,ctx,bookingId}:any){
 const [now,setNow]=useState(Date.now),manager=canManageEvent(ctx.data.me,e),deadline=cancellationDeadline(e);
 useEffect(()=>{if(manager||now>deadline)return;const timer=setTimeout(()=>setNow(Date.now()),Math.min(2147483647,Math.max(0,deadline-Date.now()+1)));return()=>clearTimeout(timer)},[manager,deadline,now]);
 if(!r||r.status==='cancelled')return null;
 const late=cancellationNeedsApproval(e,now,manager),pending=r.cancelRequested&&!manager,closed=['ended','cancelled'].includes(e.status);
 const label=pending?'已申请取消':late?'申请取消':'取消报名';
 function request(){
  const needsApproval=cancellationNeedsApproval(e,Date.now(),manager);
  ctx.setDanger({action:bookingId?'courtCancel':'cancel',payload:bookingId?{bookingId,playerId:r.playerId}:{eventId:e.id,playerId:r.playerId},title:needsApproval?'申请取消报名':'取消报名',description:needsApproval?'距离活动开始不足24小时，不能直接取消。申请会交给活动创建者或管理员处理，处理前保留原名额。':'报名将被取消。正式名额空出后，最早的有效候补自动递补。',reason:needsApproval?'申请取消报名':'取消报名'});
 }
 return <button type="button" className="ghost danger" disabled={ctx.busy||pending||closed} title={'自由取消截止：'+fmt(deadline)} aria-label={label+'：'+ctx.name(r.playerId)} onClick={request}>{label}</button>;
}
