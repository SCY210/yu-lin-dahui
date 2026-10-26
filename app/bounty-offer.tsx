'use client';
import {ScrollText} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {bountyTitles,type BountyKind} from '../lib/domain/bounties';
import {BountyScroll} from './bounty-card';
import './bounty.css';

type Offer={eventId:string;playerId:string;kind:BountyKind;coins:number;points:number;penalty:number};
/** Pops up once per visit when a bounty is offered (from 30 minutes before a points match). Closing it only postpones
 * the answer: the offer stays on the home and activity pages until the member's first game starts. */
export default function BountyOffer({offer,title,busy,onRespond,onLater}:{offer:Offer;title:string;busy?:boolean;onRespond:(accept:boolean)=>void;onLater:()=>void}){
 return <Dialog open onOpenChange={open=>{if(!open)onLater()}}><DialogContent className="app-dialog bounty-offer">
  <DialogHeader><div className="bounty-offer-seal" aria-hidden="true"><ScrollText size={34}/></div><DialogTitle>悬赏令 · {bountyTitles[offer.kind]}</DialogTitle><DialogDescription>{title}</DialogDescription></DialogHeader>
  <BountyScroll {...offer}/>
  <p className="hint">接不接都可以，不接没有惩罚；只能回应一次。也可以稍后在主页回应，你的第一局开始后悬赏令失效。</p>
  <div className="bounty-offer-actions"><button type="button" className="primary full" disabled={busy} onClick={()=>onRespond(true)}>接下悬赏</button><button type="button" className="ghost full" disabled={busy} onClick={()=>onRespond(false)}>不接</button></div>
 </DialogContent></Dialog>;
}
