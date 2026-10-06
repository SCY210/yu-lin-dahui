'use client';
import {useRef,useState} from 'react';
import {Copy,Mail,MessageCircle,Send,Share2} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import type {Event} from '../lib/domain/types';
import {createEventShare,eventShareTargets,shareEvent,type EventShareData} from '../lib/client/event-sharing';
import './event-share.css';

export default function EventShare({event,clubName}:{event:Event;clubName:string}){
 const [payload,setPayload]=useState<EventShareData|null>(null),[busy,setBusy]=useState(false);
 const inFlight=useRef(false),linkInput=useRef<HTMLInputElement>(null),shareButton=useRef<HTMLButtonElement>(null);
 const unavailable=event.status==='draft'||event.deletedAt!==undefined||!!event.mergedInto;
 const share=async()=>{
  if(inFlight.current)return;
  const data=createEventShare(event,clubName,location.origin);if(!data)return;
  inFlight.current=true;setBusy(true);
  try{if(await shareEvent(data,navigator)==='fallback')setPayload(data)}
  finally{inFlight.current=false;setBusy(false)}
 };
 const copy=async()=>{
  if(!payload)return;
  try{await navigator.clipboard.writeText(payload.url);toast.success('活动链接已复制')}
  catch{linkInput.current?.focus();linkInput.current?.select();toast.error('无法自动复制，请选中下方链接手动复制')}
 };
 const targets=payload?eventShareTargets(payload):null;
 return <>
  <button ref={shareButton} type="button" className="secondary" onClick={share} disabled={busy||unavailable} title={unavailable?'草稿开放报名后可分享':undefined}><Share2 size={16}/>{busy?'正在打开分享…':'分享活动'}</button>
  <Dialog open={!!payload} onOpenChange={open=>{if(!open)setPayload(null)}}>
   <DialogContent className="app-dialog event-share-dialog" onCloseAutoFocus={ev=>{ev.preventDefault();shareButton.current?.focus()}}>
    <DialogHeader><DialogTitle>分享活动</DialogTitle><DialogDescription>选择应用直接发送活动邀请。对方需使用成员账号登录后查看与报名。</DialogDescription></DialogHeader>
    {payload&&targets&&<>
     <div className="event-share-preview"><Share2 size={22} aria-hidden="true"/><p>{payload.text}</p></div>
     <div className="event-share-targets">
      <a className="secondary" href={targets.whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>WhatsApp</a>
      <a className="secondary" href={targets.telegram} target="_blank" rel="noopener noreferrer"><Send size={18}/>Telegram</a>
      <a className="secondary" href={targets.email}><Mail size={18}/>邮件</a>
      <button type="button" className="secondary" onClick={copy}><Copy size={18}/>复制链接</button>
     </div>
     <label className="event-share-link">活动链接<input ref={linkInput} readOnly value={payload.url} onFocus={ev=>ev.currentTarget.select()}/></label>
    </>}
   </DialogContent>
  </Dialog>
 </>;
}
