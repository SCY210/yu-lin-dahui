'use client';
import Disclosure from './disclosure';
import {euro,fmt} from './form-fields';
import type {ClubData} from '../lib/contracts/club';

type SavedSplit=ClubData['settlements'][number];
export default function MyFeeList({settlements,playerId,eventName,onOpen}:{settlements:SavedSplit[];playerId:string;eventName:(id:string)=>string;onOpen:(id:string)=>void}){
 const latest=new Map<string,SavedSplit>();
 for(const s of settlements)if(s.confirmed&&s.bills.some(b=>b.playerId===playerId)&&(!latest.has(s.eventId)||latest.get(s.eventId)!.version<s.version))latest.set(s.eventId,s);
 const rows=[...latest.values()].sort((a,b)=>b.created-a.created);
 const row=(s:SavedSplit)=>{const bill=s.bills.find(b=>b.playerId===playerId)!;return <button type="button" className="my-fee-link" key={s.id} onClick={()=>onOpen(s.eventId)}><span><strong>{eventName(s.eventId)}</strong><small>{fmt(s.created,{month:'numeric',day:'numeric'})}确认 · 第{s.version}版</small></span><b>{euro(bill.total)}</b><span aria-hidden="true">›</span></button>};
 return <section className="card my-fee-summary"><h3>我的活动与分摊</h3>{rows.length?row(rows[0]):<p className="hint">暂无已确认分摊。</p>}{rows.length>1&&<Disclosure label={'历史分摊 · '+(rows.length-1)+'场'}>{rows.slice(1).map(row)}</Disclosure>}</section>;
}
