'use client';
import {useState} from 'react';
import {HandCoins,AlertTriangle,Check} from 'lucide-react';
import {euro} from './form-fields';
import {incomingTransfersFor,overdueFees,type FeePayment,type FeeSplit} from '../lib/client/my-fees';
import {automaticFeeReminders} from '../lib/fee-reminder-schedule';
import FoldList from './fold-list';
import './fee-status.css';
import './home-fees-owed.css';

type Transfer={eventId:string;settlementId:string;from:string;to:string};
type Props={settlements:FeeSplit[];payments:FeePayment[];players:{id:string;name:string}[];me:{playerId:string};admin:boolean;now:number;
 events:{id:string;title:string;status?:string}[];onOpen:(eventId:string)=>void;
 /** Lets the receiver confirm transfers they got (docs/FEE_ADVANCES.md). */
 onMarkTransfers?:(transfers:Transfer[])=>void;busy?:boolean};
/** Names wrap as one line of chips instead of a line each; long lists show the first few and expand on request,
 * so a collector with a whole activity unpaid does not push the rest of the home page several screens down. */
const shownNames=6;
function OwedNames({items}:{items:{id:string;label:string;overdue?:boolean}[]}){
 const [all,setAll]=useState(false),shown=all?items:items.slice(0,shownNames);
 return <p className="home-owed-names">{shown.map(i=><span key={i.id} className={i.overdue?'is-overdue':undefined}>{i.label}</span>)}
  {items.length>shownNames&&<button type="button" className="home-owed-more" aria-expanded={all} onClick={()=>setAll(!all)}>{all?'收起':'还有 '+(items.length-shownNames)+' 人'}</button>}</p>;
}
/** Home cards about money other members still owe (docs/FEE_PAYMENTS.md): the transfers this member is still waiting
 * for, and, for the owner and administrators, who has not paid after all automatic reminders. */
export default function HomeFeesOwed({settlements,payments,players,me,admin,now,events,onOpen,onMarkTransfers,busy}:Props){
 const byId=new Map(events.map(e=>[e.id,e])),visible=new Set(events.filter(e=>!['draft','cancelled'].includes(e.status??'')).map(e=>e.id));
 const incoming=incomingTransfersFor(settlements,payments,me,visible,now);
 // A payer already listed as owing this member is not listed again in the overdue card; the receivable row says how many were reminded.
 const overdue=(admin?overdueFees(settlements,payments,visible,now):[]).map(o=>({...o,owing:o.owing.filter(x=>!incoming.some(t=>t.eventId===o.eventId&&t.from===x.playerId))})).filter(o=>o.owing.length);
 if(!incoming.length&&!overdue.length)return null;
 const name=(id:string)=>players.find(p=>p.id===id)?.name??'球友';
 const groups=[...new Set(incoming.map(t=>t.eventId))].map(eventId=>({eventId,list:incoming.filter(t=>t.eventId===eventId)}));
 return <>
  {groups.length>0&&<section className="card home-unpaid home-receivable" role="status" aria-live="polite">
   <div className="home-unpaid-title"><HandCoins size={20} aria-hidden="true"/><strong>等你收款：{groups.length} 场活动</strong></div>
   <p className="hint">这些球友还没标记转账给你。收到后点“标记已收到”。</p>
   <div className="home-unpaid-list"><FoldList items={groups.map(({eventId,list})=>{const total=list.reduce((n,t)=>n+t.cents,0),late=list.filter(t=>t.overdue).length;return <div className="home-unpaid-item" key={eventId}>
    <button type="button" className="home-unpaid-row" onClick={()=>onOpen(eventId)}>
     <span><strong>{byId.get(eventId)?.title}</strong><small>{list.length} 人未付{late>0&&<em className="fee-overdue-tag">其中 {late} 人已提醒 {automaticFeeReminders} 次仍未付</em>}</small></span><b>{euro(total)}</b><span aria-hidden="true">去费用页 ›</span>
    </button>
    <OwedNames items={list.map(t=>({id:t.from,label:name(t.from)+' · '+euro(t.cents),overdue:t.overdue}))}/>
    {onMarkTransfers&&<div className="home-unpaid-actions"><button type="button" className="primary" disabled={busy} onClick={()=>onMarkTransfers(list.map(({eventId,settlementId,from,to})=>({eventId,settlementId,from,to})))}><Check size={15} aria-hidden="true"/> {list.length>1?'全部标记已收到':'标记已收到'}</button></div>}
   </div>})}/></div>
  </section>}
  {overdue.length>0&&<section className="card home-unpaid home-overdue" role="status" aria-live="polite">
   <div className="home-unpaid-title"><AlertTriangle size={20} aria-hidden="true"/><strong>提醒 {automaticFeeReminders} 次仍未付款</strong></div>
   <p className="hint">分摊确认后已每天自动提醒，这些球友仍未付款。可在费用页再次提醒或代为标记。</p>
   <div className="home-unpaid-list"><FoldList items={overdue.map(({eventId,owing})=><div className="home-unpaid-item" key={eventId}><button type="button" className="home-unpaid-row" onClick={()=>onOpen(eventId)}>
    <span><strong>{byId.get(eventId)?.title}</strong></span><b>{owing.length} 人</b><span aria-hidden="true">去费用页 ›</span>
   </button><OwedNames items={owing.map(o=>({id:o.playerId,label:name(o.playerId)+' · '+euro(o.cents)}))}/></div>)}/></div>
  </section>}
 </>;
}
