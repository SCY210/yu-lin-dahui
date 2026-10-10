'use client';
import {Wallet,Copy,Check} from 'lucide-react';
import {toast} from 'sonner';
import {euro} from './form-fields';
import {unpaidFeesFor,type FeePayment,type FeeSplit} from '../lib/client/my-fees';
import './fee-status.css';

type Props={settlements:FeeSplit[];payments:FeePayment[];players:{id:string;ownerId:string;name:string}[];me:{id:string;playerId:string};
 events:{id:string;title:string;feeRecipient?:{name:string;phone:string}}[];onOpen:(eventId:string)=>void;
 /** When given, each row offers "mark paid" directly on the home page. */
 onMarkPaid?:(row:{eventId:string;settlementId:string;playerId:string})=>void;busy?:boolean};
/** A prominent home notice while this member (or a friend they registered) has an unpaid confirmed fee. Each row shows
 * the transfer recipient with a copy button and can be marked paid without opening the fees page. */
export default function HomeUnpaid({settlements,payments,players,me,events,onOpen,onMarkPaid,busy}:Props){
 const byId=new Map(events.map(e=>[e.id,e])),rows=unpaidFeesFor(settlements,payments,players,me,new Set(byId.keys()));
 if(!rows.length)return null;
 const count=new Set(rows.map(r=>r.eventId)).size,name=(id:string)=>players.find(p=>p.id===id)?.name??'代报名朋友';
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);toast.success('收款信息已复制')}catch{toast.error('复制失败，请手动复制号码')}};
 return <section className="card home-unpaid" role="status" aria-live="polite">
  <div className="home-unpaid-title"><Wallet size={20} aria-hidden="true"/><strong>有 {count} 场活动还没付款</strong></div>
  <p className="hint">转账后点“标记已付款”，提示就会消失。</p>
  <div className="home-unpaid-list">{rows.map(r=>{const e=byId.get(r.eventId),payee=e?.feeRecipient;return <div className="home-unpaid-item" key={r.eventId+':'+r.playerId}>
   <button type="button" className="home-unpaid-row" onClick={()=>onOpen(r.eventId)}>
    <span><strong>{e?.title}</strong>{r.friend&&<small>代 {name(r.playerId)} 付</small>}</span><b>{euro(r.total)}</b><span aria-hidden="true">去费用页 ›</span>
   </button>
   {(payee||onMarkPaid)&&<div className="home-unpaid-actions">
    {payee&&<span className="home-unpaid-payee">转账给 <strong>{payee.name}</strong> · {payee.phone}</span>}
    {payee&&<button type="button" className="ghost" onClick={()=>void copy(payee.name+' · '+payee.phone)}><Copy size={15} aria-hidden="true"/> 复制收款信息</button>}
    {onMarkPaid&&<button type="button" className="primary" disabled={busy} onClick={()=>onMarkPaid({eventId:r.eventId,settlementId:r.settlementId,playerId:r.playerId})}><Check size={15} aria-hidden="true"/> 标记已付款</button>}
   </div>}
  </div>})}</div>
 </section>;
}
