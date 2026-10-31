'use client';
import {useEffect,useState} from 'react';
import {CircleAlert} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {toast} from 'sonner';

const eventName='yulin-error';
/** Shows an error in a dialog the user must close, instead of a toast that disappears. Any component may call it. */
export function showError(message:string){
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(eventName,{detail:message||'操作未完成，请重试'}));
}

// Every error the app reports with toast.error opens the dialog instead ("全部报错应该是弹窗显示").
toast.error=((message:unknown)=>{showError(typeof message==='string'?message:message instanceof Error?message.message:'操作未完成，请重试');return 0}) as typeof toast.error;

/** Mounted once by the app. Errors that arrive while one is open are listed together. */
export default function ErrorDialog(){
 const [messages,setMessages]=useState<string[]>([]);
 useEffect(()=>{
  const listen=(event:Event)=>{const message=String((event as CustomEvent).detail);setMessages(current=>current.includes(message)?current:[...current,message])};
  window.addEventListener(eventName,listen);return ()=>window.removeEventListener(eventName,listen);
 },[]);
 return <Dialog open={messages.length>0} onOpenChange={open=>{if(!open)setMessages([])}}><DialogContent className="app-dialog error-dialog" role="alertdialog">
  <DialogHeader><DialogTitle><CircleAlert size={20} aria-hidden="true"/> 操作未完成</DialogTitle><DialogDescription asChild><div className="error-dialog-messages">{messages.map(m=><p key={m}>{m}</p>)}</div></DialogDescription></DialogHeader>
  <button type="button" className="primary full" onClick={()=>setMessages([])}>知道了</button>
 </DialogContent></Dialog>;
}
