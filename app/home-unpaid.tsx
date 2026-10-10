'use client';
import {Wallet,Copy,Check} from 'lucide-react';
import {toast} from 'sonner';
import {euro} from './form-fields';
import {unpaidFeesFor,type FeePayment,type FeeSplit} from '../lib/client/my-fees';
import './fee-status.css';

type Bill={eventId:string;settlementId:string;playerId:string};
type Props={settlements:FeeSplit[];payments:FeePayment[];players:{id:string;ownerId:string;name:string}[];me:{id:string;playerId:string};
 events:{id:string;title:string;feeRecipient?:{name:string;phone:string}}[];onOpen:(eventId:string)=>void;
 /** When given, each activity offers "mark paid" directly on the home page, covering all of its unpaid bills. */
 onMarkPaid?:(bills:Bill[])=>void;busy?:boolean};
/** A prominent home notice while this member (or a friend they registered) has an unpaid confirmed fee. One entry per
 * activity lists the member's own bill and those of their friends, the transfer recipient with a copy button, and can be
 * marked paid without opening the fees page. */
export default function HomeUnpaid({settlements,payments,players,me,events,onOpen,onMarkPaid,busy}:Props){
 const byId=new Map(events.map(e=>[e.id,e])),rows=unpaidFeesFor(settlements,payments,players,me,new Set(byId.keys()));
 if(!rows.length)return null;
 const groups=[...new Set(rows.map(r=>r.eventId))].map(eventId=>({eventId,bills:rows.filter(r=>r.eventId===eventId)}));
 const name=(id:string)=>players.find(p=>p.id===id)?.name??'代报名朋友';
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);toast.success('收款信息已复制')}catch{toast.error('复制失败，请手动复制号码')}};
 return <section className="card home-unpaid" role="status" aria-live="polite">
  <div className="home-unpaid-title"><Wallet size={20} aria-hidden="true"/><strong>有 {groups.length} 场活动还没付款</strong></div>
  <p className="hint">转账后点“标记已付款”，提示就会消失。</p>
  <div className="home-unpaid-list">{groups.map(({eventId,bills})=>{const e=byId.get(eventId),payee=e?.feeRecipient,total=bills.reduce((n,b)=>n+b.total,0);return <div className="home-unpaid-item" key={eventId}>
   <button type="button" className="home-unpaid-row" onClick={()=>onOpen(eventId)}>
    <span><strong>{e?.title}</strong>{bills.length>1?bills.map(b=><small key={b.playerId}>{b.friend?'代 '+name(b.playerId)+' 付':'自己'} · {euro(b.total)}</small>):bills[0].friend&&<small>代 {name(bills[0].playerId)} 付</small>}</span><b>{euro(total)}</b><span aria-hidden="true">去费用页 ›</span>
   </button>
   {(payee||onMarkPaid)&&<div className="home-unpaid-actions">
    {payee&&<span className="home-unpaid-payee">转账给 <strong>{payee.name}</strong> · {payee.phone}</span>}
    {payee&&<button type="button" className="ghost" onClick={()=>void copy(payee.name+' · '+payee.phone)}><Copy size={15} aria-hidden="true"/> 复制收款信息</button>}
    {onMarkPaid&&<button type="button" className="primary" disabled={busy} onClick={()=>onMarkPaid(bills.map(({eventId,settlementId,playerId})=>({eventId,settlementId,playerId})))}><Check size={15} aria-hidden="true"/> {bills.length>1?'全部标记已付款':'标记已付款'}</button>}
   </div>}
  </div>})}</div>
 </section>;
}
