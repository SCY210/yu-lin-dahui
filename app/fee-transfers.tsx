'use client';
import {ArrowRight,Copy,Phone} from 'lucide-react';
import {toast} from 'sonner';
import {euro} from './form-fields';
import {transferPaid,type Advance,type Transfer} from '../lib/domain/fee-transfers';
import {useState} from 'react';
import './fee-transfers.css';

type Settlement={id:string;eventId:string;version:number;advances?:Advance[];transfers?:Transfer[];collector?:string};
type Ctx={data:{me:{playerId:string};players?:{id:string;profile?:{phone?:string}}[];payments?:{eventId:string;playerId:string;cents:number;to?:string}[]};name:(id:string)=>string;busy?:boolean;action:(action:string,payload:Record<string,unknown>,close?:boolean)=>Promise<unknown>};

/** The transfer a "去付款" link brings into view (docs/JUMP_TO_MATCH.md): the viewer's first open transfer out, else
 * their first open transfer in. */
export function payTransfer(transfers:Transfer[],payments:{eventId:string;playerId:string;cents:number;to?:string}[],eventId:string,me:string){
 const open=transfers.filter(t=>(t.from===me||t.to===me)&&!transferPaid(payments,eventId,t));
 return open.find(t=>t.from===me)??open[0];
}
export const payRowId=(eventId:string)=>'fee-pay-'+eventId;

/** The fee-advance part of a confirmed split (docs/FEE_ADVANCES.md): who advanced what, and each transfer that settles
 * it. The payer, the receiver and the organisers can mark a transfer as made. */
export default function FeeTransfers({e,settlement,ctx,manager}:{e:{id:string;title:string;feeRecipient?:{name:string;phone:string;playerId?:string}};settlement:Settlement;ctx:Ctx;manager:boolean}){
 const [tab,setTab]=useState<'open'|'done'>('open');
 const {data,name}=ctx,me=data.me.playerId,payments=data.payments??[],transfers=settlement.transfers??[];
 const done=(t:Transfer)=>transferPaid(payments,e.id,t);
 const mark=(t:Transfer,paid:boolean)=>void ctx.action('feeTransferPaid',{eventId:e.id,settlementId:settlement.id,from:t.from,to:t.to,paid,reason:paid?'标记已转账':'撤销转账标记'},false).catch(()=>{});
 const target=payTransfer(transfers,payments,e.id,me);
 const mine=transfers.filter(t=>t.from===me||t.to===me),others=transfers.filter(t=>t.from!==me&&t.to!==me);
 // Members see the numbers of the people they transfer with (lib/club-view.ts phonePeers), so they can pay directly.
 // The collector is reached at the number given when they were made recipient, else their profile number.
 const phoneOf=(id:string)=>(id===settlement.collector&&e.feeRecipient?.playerId===id?e.feeRecipient.phone.trim():'')||(data.players?.find(p=>p.id===id)?.profile?.phone?.trim()??'');
 const copyPhone=async(phone:string)=>{try{await navigator.clipboard.writeText(phone);toast.success('已复制电话号码')}catch{toast.error('复制失败')}};
 // One transfer, compact: who to whom with the amount beside it, the other side's phone when it is one's own, then its
 // status and the one action this viewer may take.
 const row=(t:Transfer)=>{const paid=done(t),can=t.from===me||t.to===me||manager;return <div className={'fee-transfer'+(paid?' is-paid':'')} key={t.from+'>'+t.to} id={t===target?payRowId(e.id):undefined}>
  <div className="fee-transfer-top">
   <div className={'fee-transfer-people'+(t.from===me?' from-me':t.to===me?' to-me':'')}>
    <strong className={'fee-transfer-person'+(t.from===me?' is-self':'')} data-side="from" title={name(t.from)}>{t.from===me?'我':name(t.from)}</strong>
    <ArrowRight className="fee-transfer-direction" size={16} aria-label="转给"/>
    <strong className={'fee-transfer-person'+(t.to===me?' is-self':'')} data-side="to" title={name(t.to)}>{t.to===me?'我':name(t.to)}</strong>
   </div>
   <b className="fee-transfer-amount">{euro(t.cents)}</b>
  </div>
  {(t.from===me||t.to===me)&&(()=>{const other=t.from===me?t.to:t.from,phone=phoneOf(other);return <div className="fee-transfer-phone">{phone?<><Phone size={14} aria-hidden="true"/><span>{name(other)} 的电话 <b>{phone}</b></span><button type="button" className="ghost" onClick={()=>void copyPhone(phone)}><Copy size={14} aria-hidden="true"/> 复制</button></>:<span className="hint">{name(other)} 还没填电话</span>}</div>})()}
  <div className="fee-transfer-footer">
   <span className={'fee-status '+(paid?'is-paid':'is-unpaid')}>{paid?'已转':'待转'}</span>
   {can&&<button type="button" className={paid?'ghost':'secondary'} disabled={ctx.busy} onClick={()=>mark(t,!paid)}>{paid?'撤销':t.to===me?'确认已收到':'标记已转'}</button>}
  </div>
 </div>};
 const copy=async()=>{try{await navigator.clipboard.writeText(`${e.title} · 转账结算 第${settlement.version}版\n${transfers.map(t=>`${name(t.from)} → ${name(t.to)}：${euro(t.cents)}`).join('\n')}`);toast.success('已复制转账明细')}catch{toast.error('复制失败')}};
 const advances=settlement.advances??[],extra=advances.reduce((n,a)=>n+a.cents-(a.paid??a.cents),0);
 return <section className="fee-transfers" aria-label="转账结算">
  <div className="fee-transfer-heading"><h3>转账</h3><button type="button" className="ghost" onClick={()=>void copy()}><Copy size={14} aria-hidden="true"/> 复制明细</button></div>
  {mine.length>0&&<div className="fee-transfer-list" aria-label="和我有关的转账">{(()=>{
   // A collector's long list: once some transfers are done, two tabs keep the open ones in view instead of one long
   // mixed list. A short list stays as it is.
   const open=mine.filter(t=>!done(t)),closed=mine.filter(done);
   if(mine.length<=6||!open.length||!closed.length)return mine.map(row);
   return <><div className="fee-transfer-tabs" role="tablist" aria-label="我的转账">{(['open','done'] as const).map(k=><button type="button" role="tab" key={k} aria-selected={tab===k} className={tab===k?'is-selected':''} onClick={()=>setTab(k)}>{k==='open'?'待处理 '+open.length:'已完成 '+closed.length}</button>)}</div>{(tab==='open'?open:closed).map(row)}</>;
  })()}</div>}
  {!mine.length&&<p className="hint">你没有需要转出或收取的钱。</p>}
  {/* Who advanced what is on each ledger item; only the organisers see how rounding was settled. */}
  {manager&&extra!==0&&<p className="fee-advances">取整{extra>0?'多收':'少收'} {euro(Math.abs(extra))}，已按垫付金额{extra>0?'摊给':'由'}垫付人{extra>0?'':'分担'}。</p>}
  {others.length>0&&<details className="fee-transfer-others"><summary>其他人的转账 · {others.length} 笔 · 已转 {others.filter(done).length} 笔</summary><div className="fee-transfer-list">{others.map(row)}</div></details>}
 </section>;
}
