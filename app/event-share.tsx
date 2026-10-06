'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Copy,Mail,MessageCircle,Send} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import type {Event} from '../lib/domain/types';
import {createEventShare,eventShareTargets,isWeChatBrowser,shareEvent,type EventShareData} from '../lib/client/event-sharing';
import './event-share.css';

export default function EventShare({event,clubName}:{event:Event;clubName:string}){
 const [payload,setPayload]=useState<EventShareData|null>(null),[busy,setBusy]=useState(false),[inWeChat,setInWeChat]=useState(false);
 const inFlight=useRef(false),linkInput=useRef<HTMLInputElement>(null),shareButton=useRef<HTMLButtonElement>(null);
 const unavailable=event.status==='draft'||event.deletedAt!==undefined||!!event.mergedInto;
 useEffect(()=>{
  const previous=document.title,title=`${clubName} · ${event.title}`;
  document.title=title;
  return()=>{if(document.title===title)document.title=previous};
 },[clubName,event.title]);
 const share=async()=>{
  if(inFlight.current)return;
  const data=createEventShare(event,clubName,location.origin);if(!data)return;
  setInWeChat(isWeChatBrowser(navigator.userAgent));
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
  <button ref={shareButton} type="button" className="secondary event-wechat-button" onClick={share} disabled={busy||unavailable} title={unavailable?'草稿开放报名后可分享':undefined}><MessageCircle size={16}/>{busy?'正在打开分享…':'分享至微信群'}</button>
  <Dialog open={!!payload} onOpenChange={open=>{if(!open)setPayload(null)}}>
   <DialogContent className="app-dialog event-share-dialog" onCloseAutoFocus={ev=>{ev.preventDefault();shareButton.current?.focus()}}>
    <DialogHeader><DialogTitle>分享至微信群</DialogTitle><DialogDescription>{inWeChat?'通过微信右上角菜单转发本次活动，无需复制接龙。':'手机分享菜单中选择微信，再选择群聊。对方需使用成员账号登录后接龙。'}</DialogDescription></DialogHeader>
    {payload&&targets&&<>
     <section className="event-wechat-guide" aria-label="微信群分享步骤">
      <div className="event-wechat-guide-heading"><MessageCircle size={22} aria-hidden="true"/><strong>{inWeChat?'在微信内直接转发':'发到你的微信群'}</strong>{inWeChat&&<ArrowUpRight size={24} aria-hidden="true"/>}</div>
      {inWeChat?<><ol><li>关闭此提示，点击微信右上角「···」</li><li>选择「发送给朋友」或「转发」</li><li>选择微信群，确认发送</li></ol><button type="button" className="primary event-wechat-dismiss" onClick={()=>setPayload(null)}>知道了，去转发<ArrowUpRight size={18}/></button></>:<p>如果手机分享菜单未提供微信，可以在微信中打开下方活动链接，再点击右上角「···」转发给群聊。</p>}
     </section>
     <div className="event-share-preview"><p>{payload.text}</p></div>
     <label className="event-share-link">活动链接<input ref={linkInput} readOnly value={payload.url} onFocus={ev=>ev.currentTarget.select()}/></label>
     <button type="button" className="secondary" onClick={copy}><Copy size={18}/>复制活动链接（备用）</button>
     <details className="event-share-other"><summary>其他分享方式</summary><div className="event-share-targets">
      <a className="secondary" href={targets.whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>WhatsApp</a>
      <a className="secondary" href={targets.telegram} target="_blank" rel="noopener noreferrer"><Send size={18}/>Telegram</a>
      <a className="secondary" href={targets.email}><Mail size={18}/>邮件</a>
     </div></details>
    </>}
   </DialogContent>
  </Dialog>
 </>;
}
