'use client';
import {HandCoins,AlertTriangle,Check,ChevronRight} from 'lucide-react';
import {euro} from './form-fields';
import {incomingTransfersFor,overdueFees,type FeePayment,type FeeSplit} from '../lib/client/my-fees';
import {automaticFeeReminders} from '../lib/fee-reminder-schedule';
import './fee-status.css';
import './home-fees-owed.css';

type Transfer={eventId:string;settlementId:string;from:string;to:string};
type Props={settlements:FeeSplit[];payments:FeePayment[];players:{id:string;name:string}[];me:{playerId:string};admin:boolean;now:number;
 events:{id:string;title:string;status?:string}[];onOpen:(eventId:string)=>void;
 /** Lets the receiver confirm transfers they got (docs/FEE_ADVANCES.md). */
 onMarkTransfers?:(transfers:Transfer[])=>void;busy?:boolean;
 /** Home: one summary line per card that opens the money page (`page=money`), where the full lists are. */
 onOpenAll?:()=>void};
/** Payers as one wrapping line of chips under each activity on the money page. */
function OwedNames({items}:{items:{id:string;label:string;overdue?:boolean}[]}){
 return <p className="home-owed-names">{items.map(i=><span key={i.id} className={i.overdue?'is-overdue':undefined}>{i.label}</span>)}</p>;
}
/** Home cards about money other members still owe (docs/FEE_PAYMENTS.md): the transfers this member is still waiting
 * for, and, for the owner and administrators, who has not paid after all automatic reminders. */
export default function HomeFeesOwed({settlements,payments,players,me,admin,now,events,onOpen,onMarkTransfers,busy,onOpenAll}:Props){
 const byId=new Map(events.map(e=>[e.id,e])),visible=new Set(events.filter(e=>!['draft','cancelled'].includes(e.status??'')).map(e=>e.id));
 const incoming=incomingTransfersFor(settlements,payments,me,visible,now);
 // A payer already listed as owing this member is not listed again in the overdue card; the receivable row says how many were reminded.
 const overdue=(admin?overdueFees(settlements,payments,visible,now):[]).map(o=>({...o,owing:o.owing.filter(x=>!incoming.some(t=>t.eventId===o.eventId&&t.from===x.playerId))})).filter(o=>o.owing.length);
 if(!incoming.length&&!overdue.length)return null;
 const name=(id:string)=>players.find(p=>p.id===id)?.name??'球友';
 const groups=[...new Set(incoming.map(t=>t.eventId))].map(eventId=>({eventId,list:incoming.filter(t=>t.eventId===eventId)}));
 if(onOpenAll){
  // Home: a collector with whole activities unpaid would otherwise list every payer; the money page has them all.
  const people=(ids:string[])=>new Set(ids).size,late=incoming.filter(t=>t.overdue).length,overduePeople=overdue.reduce((n,o)=>n+o.owing.length,0);
  return <>
   {groups.length>0&&<button type="button" className="card home-unpaid home-receivable home-money-summary" onClick={onOpenAll}>
    <span className="home-unpaid-title"><HandCoins size={20} aria-hidden="true"/><strong>等你收款：{groups.length} 场活动</strong></span>
    <span className="home-money-line">{people(incoming.map(t=>t.from))} 人未付 · {euro(incoming.reduce((n,t)=>n+t.cents,0))}{late>0&&<em className="fee-overdue-tag">其中 {late} 笔已提醒 {automaticFeeReminders} 次仍未付</em>}</span>
    <span className="home-money-go">查看并确认收款<ChevronRight size={16} aria-hidden="true"/></span>
   </button>}
   {overdue.length>0&&<button type="button" className="card home-unpaid home-overdue home-money-summary" onClick={onOpenAll}>
    <span className="home-unpaid-title"><AlertTriangle size={20} aria-hidden="true"/><strong>提醒 {automaticFeeReminders} 次仍未付款</strong></span>
    <span className="home-money-line">{overdue.length} 场活动 · {overduePeople} 人次</span>
    <span className="home-money-go">查看<ChevronRight size={16} aria-hidden="true"/></span>
   </button>}
  </>;
 }
 return <>
  {groups.length>0&&<section className="card home-unpaid home-receivable" role="status" aria-live="polite">
   <div className="home-unpaid-title"><HandCoins size={20} aria-hidden="true"/><strong>等你收款：{groups.length} 场活动</strong></div>
   <p className="hint">这些球友还没标记转账给你。收到后点“标记已收到”。</p>
   <div className="home-unpaid-list">{groups.map(({eventId,list})=>{const total=list.reduce((n,t)=>n+t.cents,0),late=list.filter(t=>t.overdue).length;return <div className="home-unpaid-item" key={eventId}>
    <button type="button" className="home-unpaid-row" onClick={()=>onOpen(eventId)}>
     <span><strong>{byId.get(eventId)?.title}</strong><small>{list.length} 人未付{late>0&&<em className="fee-overdue-tag">其中 {late} 人已提醒 {automaticFeeReminders} 次仍未付</em>}</small></span><b>{euro(total)}</b><span aria-hidden="true">去费用页 ›</span>
    </button>
    <OwedNames items={list.map(t=>({id:t.from,label:name(t.from)+' · '+euro(t.cents),overdue:t.overdue}))}/>
    {onMarkTransfers&&<div className="home-unpaid-actions"><button type="button" className="primary" disabled={busy} onClick={()=>onMarkTransfers(list.map(({eventId,settlementId,from,to})=>({eventId,settlementId,from,to})))}><Check size={15} aria-hidden="true"/> {list.length>1?'全部标记已收到':'标记已收到'}</button></div>}
   </div>})}</div>
  </section>}
  {overdue.length>0&&<section className="card home-unpaid home-overdue" role="status" aria-live="polite">
   <div className="home-unpaid-title"><AlertTriangle size={20} aria-hidden="true"/><strong>提醒 {automaticFeeReminders} 次仍未付款</strong></div>
   <p className="hint">分摊确认后已每天自动提醒，这些球友仍未付款。可在费用页再次提醒或代为标记。</p>
   <div className="home-unpaid-list">{overdue.map(({eventId,owing})=><div className="home-unpaid-item" key={eventId}><button type="button" className="home-unpaid-row" onClick={()=>onOpen(eventId)}>
    <span><strong>{byId.get(eventId)?.title}</strong></span><b>{owing.length} 人</b><span aria-hidden="true">去费用页 ›</span>
   </button><OwedNames items={owing.map(o=>({id:o.playerId,label:name(o.playerId)+' · '+euro(o.cents)}))}/></div>)}</div>
  </section>}
 </>;
}
