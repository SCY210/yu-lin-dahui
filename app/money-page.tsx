'use client';
import type {ComponentProps} from 'react';
import HomeUnpaid from './home-unpaid';
import HomeFeesOwed from './home-fees-owed';
import {incomingTransfersFor,openTransfersFor,overdueFees,unpaidFeesFor} from '../lib/client/my-fees';

/** The money page (`page=money`, docs/HOME_TODAY.md): everything the home summaries count, in full, with the same mark
 * buttons. What this member still has to pay comes first, then what others owe them and, for the owner and
 * administrators, who has not paid after the automatic reminders. */
export default function MoneyPage({pay,owed,back}:{pay:ComponentProps<typeof HomeUnpaid>;owed:ComponentProps<typeof HomeFeesOwed>;back:()=>void}){
 const all=new Set(pay.events.map(e=>e.id)),visible=new Set(owed.events.filter(e=>!['draft','cancelled'].includes(e.status??'')).map(e=>e.id));
 const empty=!unpaidFeesFor(pay.settlements,pay.payments,pay.players,pay.me,all).length&&!openTransfersFor(pay.settlements,pay.payments,pay.me,all).length
  &&!incomingTransfersFor(owed.settlements,owed.payments,owed.me,visible,owed.now).length&&!(owed.admin&&overdueFees(owed.settlements,owed.payments,visible,owed.now).length);
 return <>
  <button type="button" className="secondary" onClick={back}>返回首页</button>
  <div className="heading"><div><p className="eyebrow">付款与收款</p><h1>收付款</h1></div></div>
  {empty?<p className="hint" role="status">现在没有要付或要收的钱。</p>:<><HomeUnpaid {...pay}/><HomeFeesOwed {...owed}/></>}
 </>;
}
