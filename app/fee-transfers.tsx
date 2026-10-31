'use client';
import {ArrowRight,Copy} from 'lucide-react';
import {toast} from 'sonner';
import {euro} from './form-fields';
import {transferPaid,type Advance,type Transfer} from '../lib/domain/fee-transfers';
import './fee-transfers.css';

type Settlement={id:string;eventId:string;version:number;advances?:Advance[];transfers?:Transfer[];collector?:string};
type Ctx={data:{me:{playerId:string};payments?:{eventId:string;playerId:string;cents:number;to?:string}[]};name:(id:string)=>string;busy?:boolean;action:(action:string,payload:Record<string,unknown>,close?:boolean)=>Promise<unknown>};

/** The fee-advance part of a confirmed split (docs/FEE_ADVANCES.md): who advanced what, and each transfer that settles
 * it. The payer, the receiver and the organisers can mark a transfer as made. */
export default function FeeTransfers({e,settlement,ctx,manager}:{e:{id:string;title:string;feeRecipient?:{name:string;phone:string;playerId?:string}};settlement:Settlement;ctx:Ctx;manager:boolean}){
 const {data,name}=ctx,me=data.me.playerId,payments=data.payments??[],transfers=settlement.transfers??[];
 const done=(t:Transfer)=>transferPaid(payments,e.id,t);
 const mark=(t:Transfer,paid:boolean)=>void ctx.action('feeTransferPaid',{eventId:e.id,settlementId:settlement.id,from:t.from,to:t.to,paid,reason:paid?'标记已转账':'撤销转账标记'},false).catch(()=>{});
 const mine=transfers.filter(t=>t.from===me||t.to===me),others=transfers.filter(t=>t.from!==me&&t.to!==me);
 const collectorPhone=settlement.collector&&e.feeRecipient?.playerId===settlement.collector?e.feeRecipient.phone:'';
 const row=(t:Transfer)=>{const paid=done(t),can=t.from===me||t.to===me||manager;return <div className={'fee-transfer'+(paid?' is-paid':'')} key={t.from+'>'+t.to}>
  <span className="fee-transfer-people"><strong>{t.from===me?'我':name(t.from)}</strong><ArrowRight size={14} aria-label="转给"/><strong>{t.to===me?'我':name(t.to)}</strong></span>
  <b>{euro(t.cents)}</b>
  <span className={'fee-status '+(paid?'is-paid':'is-unpaid')}>{paid?'已转':'待转'}</span>
  {can&&<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>mark(t,!paid)}>{paid?'撤销':t.to===me?'确认已收到':'标记已转'}</button>}
 </div>};
 const copy=async()=>{try{await navigator.clipboard.writeText(`${e.title} · 转账结算 第${settlement.version}版\n${transfers.map(t=>`${name(t.from)} → ${name(t.to)}：${euro(t.cents)}`).join('\n')}`);toast.success('已复制转账明细')}catch{toast.error('复制失败')}};
 return <section className="fee-transfers">
  <div className="row"><h3>转账结算</h3><button type="button" className="ghost" onClick={()=>void copy()}><Copy size={16} aria-hidden="true"/> 复制转账明细</button></div>
  <p className="hint">{settlement.collector?`大家把分摊转给收款人 ${name(settlement.collector)}${collectorPhone?'（'+collectorPhone+'）':''}，${name(settlement.collector)} 再把垫付的钱转给约场、出球的人。`:'约场、出球的人已经垫付，按下面的转账结清，转账笔数已尽量少。'}垫付人自己的分摊已从垫付里扣除。</p>
  {(settlement.advances?.length??0)>0&&<p className="fee-advances">已垫付：{settlement.advances!.map(a=><span key={a.playerId}>{a.playerId===me?'我':name(a.playerId)} {euro(a.paid??a.cents)}</span>)}</p>}
  {(()=>{const extra=(settlement.advances??[]).reduce((n,a)=>n+a.cents-(a.paid??a.cents),0);return extra?<p className="hint">大家的分摊按人取整到分，合计{extra>0?'多收':'少收'} {euro(Math.abs(extra))}，已按垫付金额{extra>0?'摊给':'由'}垫付人{extra>0?'':'分担'}。</p>:null})()}
  {mine.length>0&&<div className="fee-transfer-list" aria-label="和我有关的转账">{mine.map(row)}</div>}
  {!mine.length&&<p className="hint">你没有需要转出或收取的钱。</p>}
  {others.length>0&&<details className="fee-transfer-others"><summary>其他人的转账 · {others.length} 笔 · 已转 {others.filter(done).length} 笔</summary><div className="fee-transfer-list">{others.map(row)}</div></details>}
 </section>;
}
