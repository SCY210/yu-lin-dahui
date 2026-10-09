'use client';
import {Wallet} from 'lucide-react';
import {euro} from './form-fields';
import {unpaidFeesFor,type FeePayment,type FeeSplit} from '../lib/client/my-fees';
import './fee-status.css';

type Props={settlements:FeeSplit[];payments:FeePayment[];players:{id:string;ownerId:string;name:string}[];me:{id:string;playerId:string};events:{id:string;title:string}[];onOpen:(eventId:string)=>void};
/** A prominent home notice while this member (or a friend they registered) has an unpaid confirmed fee. */
export default function HomeUnpaid({settlements,payments,players,me,events,onOpen}:Props){
 const titles=new Map(events.map(e=>[e.id,e.title])),rows=unpaidFeesFor(settlements,payments,players,me,new Set(titles.keys()));
 if(!rows.length)return null;
 const count=new Set(rows.map(r=>r.eventId)).size,name=(id:string)=>players.find(p=>p.id===id)?.name??'代报名朋友';
 return <section className="card home-unpaid" role="status" aria-live="polite">
  <div className="home-unpaid-title"><Wallet size={20} aria-hidden="true"/><strong>有 {count} 场活动还没付款</strong></div>
  <p className="hint">付款后在活动费用页点“标记已付款”，提示就会消失。</p>
  <div className="home-unpaid-list">{rows.map(r=><button type="button" className="home-unpaid-row" key={r.eventId+':'+r.playerId} onClick={()=>onOpen(r.eventId)}>
   <span><strong>{titles.get(r.eventId)}</strong>{r.friend&&<small>代 {name(r.playerId)} 付</small>}</span><b>{euro(r.total)}</b><span aria-hidden="true">去付款 ›</span>
  </button>)}</div>
 </section>;
}
