'use client';
import Disclosure from './disclosure';
import {euro,fmt} from './form-fields';
import type {ClubData} from '../lib/contracts/club';
import {feePaid,latestConfirmedSplits,type FeePayment} from '../lib/client/my-fees';
import './fee-status.css';

type SavedSplit=ClubData['settlements'][number];
export default function MyFeeList({settlements,playerId,eventName,onOpen,payments=[]}:{settlements:SavedSplit[];playerId:string;eventName:(id:string)=>string;onOpen:(id:string)=>void;payments?:FeePayment[]}){
 const latest=latestConfirmedSplits(settlements);
 const rows=[...latest.values()].filter(s=>s.bills.some(b=>b.playerId===playerId)).sort((a,b)=>b.created-a.created);
 const row=(s:SavedSplit)=>{const bill=s.bills.find(b=>b.playerId===playerId)!;return <button type="button" className="my-fee-link" key={s.id} onClick={()=>onOpen(s.eventId)}><span><strong>{eventName(s.eventId)}</strong><small>{fmt(s.created,{month:'numeric',day:'numeric'})}确认 · 第{s.version}版</small></span><b>{euro(bill.total)}</b>{feePaid(payments,s.eventId,bill)?<span className="fee-status is-paid">已付款</span>:<span className="fee-status is-unpaid">未付款</span>}<span aria-hidden="true">›</span></button>};
 return <section className="card my-fee-summary"><h3>我的活动与分摊</h3>{rows.length?row(rows[0]):<p className="hint">暂无已确认分摊。</p>}{rows.length>1&&<Disclosure label={'历史分摊 · '+(rows.length-1)+'场'}>{rows.slice(1).map(row)}</Disclosure>}</section>;
}
