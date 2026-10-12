'use client';
import {useRef,useState} from 'react';
import {Trophy,Sparkles} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import type {BonusNotice} from '../lib/domain/bonus-notices';
import './bonus-popup.css';

/** Shown when the app opens while the member has unacknowledged extra points (MVP or an owner grant). */
export default function BonusPopup({notices,blocked,busy,acknowledge,onDismiss}:{notices:BonusNotice[];blocked:boolean;busy:boolean;acknowledge:(ids:string[])=>Promise<unknown>;onDismiss?:(ids:string[])=>void}){
 const [dismissed,setDismissed]=useState<string[]>([]);
 const inFlight=useRef(false);
 const shown=notices.filter(n=>!dismissed.includes(n.id)).slice(0,50);
 if(!shown.length||blocked)return null;
 const total=shown.reduce((sum,n)=>sum+n.points,0),ids=shown.map(n=>n.id);
 // Close at once; if saving fails the notice simply returns on the next visit.
 const confirm=()=>{if(busy||inFlight.current)return;inFlight.current=true;setDismissed(d=>[...d,...ids]);onDismiss?.(ids);void acknowledge(ids).catch(()=>{}).finally(()=>{inFlight.current=false})};
 return <Dialog open onOpenChange={open=>{if(!open)confirm()}}><DialogContent className="app-dialog bonus-popup">
  <DialogHeader><div className="bonus-popup-icon" aria-hidden="true"><Trophy size={34}/></div><DialogTitle>恭喜你获得 {total} 积分！</DialogTitle><DialogDescription>额外积分已经计入赛季排行榜。</DialogDescription></DialogHeader>
  <ul className="bonus-popup-list">{shown.map(n=><li key={n.id}><Sparkles size={16} aria-hidden="true"/><span>{n.kind==='mvp'?<>在「{n.title}」被评为本场 <strong>MVP</strong></>:<>群主加分：{n.title}</>}</span><b>+{n.points}</b></li>)}</ul>
  <button type="button" className="primary full bonus-popup-confirm" disabled={busy} onClick={confirm}>我是最棒哒！</button>
 </DialogContent></Dialog>;
}
