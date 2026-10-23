'use client';
import {HandCoins,AlertTriangle,Check} from 'lucide-react';
import {euro} from './form-fields';
import {incomingTransfersFor,overdueFees,type FeePayment,type FeeSplit} from '../lib/client/my-fees';
import {automaticFeeReminders} from '../lib/fee-reminder-schedule';
import './fee-status.css';
import './home-fees-owed.css';

type Transfer={eventId:string;settlementId:string;from:string;to:string};
type Props={settlements:FeeSplit[];payments:FeePayment[];players:{id:string;name:string}[];me:{playerId:string};admin:boolean;now:number;
 events:{id:string;title:string;status?:string}[];onOpen:(eventId:string)=>void;
 /** Lets the receiver confirm transfers they got (docs/FEE_ADVANCES.md). */
 onMarkTransfers?:(transfers:Transfer[])=>void;busy?:boolean};
/** Home cards about money other members still owe (docs/FEE_PAYMENTS.md): the transfers this member is still waiting
 * for, and, for the owner and administrators, who has not paid after all automatic reminders. */
export default function HomeFeesOwed({settlements,payments,players,me,admin,now,events,onOpen,onMarkTransfers,busy}:Props){
 const byId=new Map(events.map(e=>[e.id,e])),visible=new Set(events.filter(e=>!['draft','cancelled'].includes(e.status??'')).map(e=>e.id));
 const incoming=incomingTransfersFor(settlements,payments,me,visible,now),overdue=admin?overdueFees(settlements,payments,visible,now):[];
 if(!incoming.length&&!overdue.length)return null;
 const name=(id:string)=>players.find(p=>p.id===id)?.name??'球友';
 const groups=[...new Set(incoming.map(t=>t.eventId))].map(eventId=>({eventId,list:incoming.filter(t=>t.eventId===eventId)}));
 return <>
  {groups.length>0&&<section className="card home-unpaid home-receivable" role="status" aria-live="polite">
   <div className="home-unpaid-title"><HandCoins size={20} aria-hidden="true"/><strong>等你收款：{groups.length} 场活动</strong></div>
   <p className="hint">这些球友还没标记转账给你。收到后点“标记已收到”。</p>
   <div className="home-unpaid-list">{groups.map(({eventId,list})=>{const total=list.reduce((n,t)=>n+t.cents,0);return <div className="home-unpaid-item" key={eventId}>
    <button type="button" className="home-unpaid-row" onClick={()=>onOpen(eventId)}>
     <span><strong>{byId.get(eventId)?.title}</strong>{list.map(t=><small key={t.from}>{name(t.from)} · {euro(t.cents)}{t.overdue&&<em className="fee-overdue-tag">已提醒 {automaticFeeReminders} 次仍未付</em>}</small>)}</span><b>{euro(total)}</b><span aria-hidden="true">去费用页 ›</span>
    </button>
    {onMarkTransfers&&<div className="home-unpaid-actions"><button type="button" className="primary" disabled={busy} onClick={()=>onMarkTransfers(list.map(({eventId,settlementId,from,to})=>({eventId,settlementId,from,to})))}><Check size={15} aria-hidden="true"/> {list.length>1?'全部标记已收到':'标记已收到'}</button></div>}
   </div>})}</div>
  </section>}
  {overdue.length>0&&<section className="card home-unpaid home-overdue" role="status" aria-live="polite">
   <div className="home-unpaid-title"><AlertTriangle size={20} aria-hidden="true"/><strong>提醒 {automaticFeeReminders} 次仍未付款</strong></div>
   <p className="hint">分摊确认后已每天自动提醒，这些球友仍未付款。可在费用页再次提醒或代为标记。</p>
   <div className="home-unpaid-list">{overdue.map(({eventId,owing})=><button type="button" className="home-unpaid-row" key={eventId} onClick={()=>onOpen(eventId)}>
    <span><strong>{byId.get(eventId)?.title}</strong>{owing.map(o=><small key={o.playerId}>{name(o.playerId)} · {euro(o.cents)}</small>)}</span><b>{owing.length} 人</b><span aria-hidden="true">去费用页 ›</span>
   </button>)}</div>
  </section>}
 </>;
}
