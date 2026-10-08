'use client';
import {Copy,Plus,MapPin,Clock} from 'lucide-react';
import {toast} from 'sonner';
import {canManageEvent} from '../lib/domain/permissions';
import {bookingCapacity,bookingRows} from '../lib/domain/booking-signups';
import {bookingCents} from '../lib/domain/money';
import {findVenue,googleMapsUrl} from '../lib/venues';
import {plannedEpoch,plannedInterval} from '../lib/time-planning';
import {dt,fmt,hm,euro,text,halfTimed,choice,money,number,why} from './ui';
import {Avatar} from './avatar';
import CancelRegistration from './cancel-registration';
import FeatureGuide from './feature-guide';
import './event-court-signup.css';

export default function EventCourtSignup({e,ctx,rules}:any){
 const {data,name,open,openProfile}=ctx,manager=canManageEvent(data.me,e);
 const courts=data.bookings.filter((b:any)=>b.eventId===e.id).slice().sort((a:any,b:any)=>a.start-b.start||a.name.localeCompare(b.name));
 const own=(id:string)=>manager||data.players.find((p:any)=>p.id===id)?.ownerId===data.me.id;
 const owned=data.players.filter((p:any)=>own(p.id)&&p.enabled);
 const regs=data.registrations.filter((r:any)=>r.eventId===e.id&&r.status!=='cancelled');
 const count=regs.filter((r:any)=>r.status==='confirmed').length;
 const bookingForm=(b?:any)=>{
  const plan=plannedInterval(b?.start??e.start,b?.end??e.end);
  open(b?'修改场地与时段':'添加场地与时段',b?'bookingEdit':'booking',{...(b?{bookingId:b.id}:{eventId:e.id}),name:b?.name??`${courts.length+1}号场`,venue:b?.venue??e.venue,address:b?.address??e.address,navigationUrl:b?.mapUrl??e.mapUrl,navigationVenue:b?.venue??e.venue,start:dt(plan.start),end:dt(plan.end),pricing:b?.pricing??'hourly',cents:b?.cents??690,signupCapacity:b?bookingCapacity(b,e):Math.min(e.capacity,8),reason:b?'调整场地时段':'新增场地时段'},[text('name','场地名称'),{key:'venue',label:'球馆',type:'venue'},halfTimed('start','开始'),halfTimed('end','结束'),number('signupCapacity','本场接龙人数上限'),choice('pricing','计价方式',[['hourly','每小时'],['total','时段总价']]),money('cents','价格 · 欧元'),why],(v:any)=>({...v,start:plannedEpoch(v.start,plan.start),end:plannedEpoch(v.end,plan.end)}),'每个场地时段独立接龙与候补。新增时段超出活动时间时，会自动扩展活动起止时间。');
 };
 const register=(b:any,playerId=data.me.playerId)=>{
  const r=data.registrations.find((r:any)=>r.eventId===e.id&&r.playerId===playerId),row=r?.bookingSignups?.find((x:any)=>x.bookingId===b.id&&x.status!=='cancelled'),plan=plannedInterval(b.start,b.end);
  const arrival=row?.arrival??plan.start,departure=row?.departure??plan.end;
  open(row?'修改本场接龙':'接龙 · '+b.name,'courtRegister',{bookingId:b.id,playerId,arrival:dt(arrival),departure:dt(departure),note:row?.note??''},[choice('playerId','球友 / 代报名',owned.map((p:any)=>[p.id,p.name])),halfTimed('arrival','参加开始'),halfTimed('departure','参加结束'),text('note','备注')],(v:any)=>({...v,arrival:plannedEpoch(v.arrival,arrival),departure:plannedEpoch(v.departure,departure)}),`${b.venue??e.venue} · ${b.name} · ${hm(b.start)}–${hm(b.end)}。可报名多个不重叠时段，满员自动候补。`);
 };
 const copy=async()=>{try{
  const lines=[`${data.settings.name} · ${e.title}`,fmt(e.start)+'–'+hm(e.end)];
  for(const b of courts){lines.push(`\n${b.venue??e.venue} · ${b.name} · ${hm(b.start)}–${hm(b.end)}（上限${bookingCapacity(b,e)}人）`);const rows=bookingRows(data,b.id);for(const status of ['confirmed','waitlist']){lines.push(status==='confirmed'?'正式':'候补');lines.push(rows.filter((x:any)=>x.status===status).sort((a:any,b:any)=>a.sequence-b.sequence).map((x:any,i:number)=>`${i+1}. ${name(x.playerId)} ${hm(x.arrival)}–${hm(x.departure)}`).join('\n')||'暂无')}}
  lines.push(`\n${location.origin}/?page=events&event=${e.id}`);await navigator.clipboard.writeText(lines.join('\n'));toast.success('已复制场地接龙');
 }catch{toast.error('复制失败，请检查剪贴板权限')}};
 const member=(r:any,i:number,b?:any)=>{const player=data.players.find((p:any)=>p.id===r.playerId);return <div className="signup-line signup-member-line" key={r.playerId}><button type="button" className="signup-identity signup-avatar-link" aria-label={'查看'+name(r.playerId)+'的球员档案'} onClick={()=>openProfile(r.playerId)}><Avatar p={player??{name:name(r.playerId)}} size="signup-avatar"/><span className="signup-position">{i+1}</span></button><div className="grow"><strong><button type="button" className="signup-name-link" onClick={()=>openProfile(r.playerId)}>{name(r.playerId)}</button></strong><p>{hm(r.arrival)}–{hm(r.departure)}{r.note?' · '+r.note:''}</p>{r.cancelRequested&&<small className="warning">已申请取消，等待处理</small>}</div>{own(r.playerId)&&<div className="actions compact"><button className="ghost" onClick={()=>register(b,r.playerId)}>修改</button><CancelRegistration e={b?{...e,start:b.start}:e} registration={r} bookingId={b?.id} ctx={ctx}/></div>}</div>};
 return <div className="ev-court-signup"><section className="ev-signup-summary"><div className="ev-summary-heading"><h2>场地接龙 <span>{count} 位球友 · {courts.length} 个时段</span></h2><FeatureGuide rules={rules} topic="signup" iconOnly/></div><div className="ev-summary-actions"><button className="secondary" onClick={copy}><Copy size={16}/>复制接龙</button>{manager&&<button className="primary" onClick={()=>bookingForm()}><Plus size={16}/>添加场地 / 时段</button>}</div></section><div className="ev-court-list">{courts.map((b:any)=>{
  const rows=bookingRows(data,b.id).sort((a:any,b:any)=>a.sequence-b.sequence),formal=rows.filter((x:any)=>x.status==='confirmed'),waiting=rows.filter((x:any)=>x.status==='waitlist'),me=rows.find((x:any)=>x.playerId===data.me.playerId),address=findVenue(b.venue??e.venue)?.address||b.address||e.address;
  return <section className="ev-court-card" key={b.id}><header><div><h3>{b.name}</h3><p><Clock size={14}/>{fmt(b.start,{month:'numeric',day:'numeric'})} · {hm(b.start)}–{hm(b.end)}</p><a href={b.mapUrl??googleMapsUrl(b.venue??e.venue,address)} target="_blank" rel="noopener noreferrer"><MapPin size={14}/>{b.venue??e.venue}</a></div><span className="ev-court-count">{formal.length}<small> / {bookingCapacity(b,e)} 人</small></span></header><div className="ev-court-controls"><span>{me?(me.status==='confirmed'?'我已报名':'我在候补'):'尚未报名'} · 场费 {euro(bookingCents(b))}</span><div className="actions"><button className="primary" disabled={ctx.busy||['ended','cancelled'].includes(e.status)} onClick={()=>register(b)}>{me?'修改 / 代报名':'在此接龙'}</button>{manager&&<button className="ghost" onClick={()=>bookingForm(b)}>设置</button>}</div></div><div className="ev-court-roster"><h4>正式名单 <span>{formal.length} 人</span></h4>{formal.map((r:any,i:number)=>member(r,i,b))}{!formal.length&&<p className="ev-court-empty">还没有人接龙</p>}{waiting.length>0&&<><h4>候补 <span>{waiting.length} 人</span></h4>{waiting.map((r:any,i:number)=><div key={r.playerId}>{member(r,i,b)}{manager&&i>0&&<button className="ghost ev-queue-move" onClick={()=>open('调整本场候补顺序','courtMoveQueue',{bookingId:b.id,playerId:r.playerId,beforePlayerId:waiting[0].playerId,reason:''},[why])}>移到本场候补首位</button>}</div>)}</>}</div></section>;
 })}</div></div>;
}
