'use client';
import {useRef,useState} from 'react';
import GiftArt,{GiftReveal} from './gift-art';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {bondCoinPoints,type GiftNotice} from '../lib/domain/bond-tiers';
import './bond.css';

/** Shown when the app opens while the member has received gifts they have not acknowledged (docs/BONDS.md). */
export default function GiftPopup({notices,name,blocked,busy,acknowledge,onDismiss}:{notices:GiftNotice[];name:(id:string)=>string;blocked:boolean;busy:boolean;acknowledge:(ids:string[])=>Promise<unknown>;onDismiss?:(ids:string[])=>void}){
 const [dismissed,setDismissed]=useState<string[]>([]);
 const inFlight=useRef(false);
 const shown=notices.filter(n=>!dismissed.includes(n.id)).slice(0,50);
 if(!shown.length||blocked)return null;
 const ids=shown.map(n=>n.id),bond=shown.reduce((sum,n)=>sum+(n.affinity??n.value*bondCoinPoints),0);
 // Close at once; if saving fails the gift is simply announced again on the next visit.
 const confirm=()=>{if(busy||inFlight.current)return;inFlight.current=true;setDismissed(d=>[...d,...ids]);onDismiss?.(ids);void acknowledge(ids).catch(()=>{}).finally(()=>{inFlight.current=false})};
 return <Dialog open onOpenChange={open=>{if(!open)confirm()}}><DialogContent className="app-dialog gift-popup">
  <DialogHeader><GiftReveal key={shown[0].id} name={shown[0].item}/><DialogTitle>你收到了{shown.length>1?' '+shown.length+' 份':''}礼物！</DialogTitle><DialogDescription>道缘缘值共 +{new Intl.NumberFormat('zh-CN').format(bond)}。</DialogDescription></DialogHeader>
  <ul className="gift-popup-list">{shown.map(n=><li key={n.id}>
   <div className="gift-receipt"><GiftArt name={n.item} className="gift-receipt-art"/><span><strong>{name(n.fromPlayerId)}</strong> 送你{n.item?<>：{n.item}<small>{n.instant?'心意已送达':'由群主发放'}</small></>:<> <b>{n.coins}</b> 羽币</>}</span></div>
   {n.message&&<q>{n.message}</q>}
  </li>)}</ul>
  <button type="button" className="primary full gift-popup-confirm" disabled={busy} onClick={confirm}>收下礼物</button>
 </DialogContent></Dialog>;
}
