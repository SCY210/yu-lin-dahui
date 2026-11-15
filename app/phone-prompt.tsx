'use client';
import {useState} from 'react';
import {Phone} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {needsPhone} from '../lib/player-profile-options';

/** Every time the app opens, a member without a phone number is asked for one, the same way as for gender
 * (app/gender-prompt.tsx): when a fee split has no single collector, members transfer to each other and need each
 * other's numbers (docs/PROFILE_PHONE.md). Closing it lasts until the app is opened again. */
export default function PhonePrompt({phone,blocked,onFill,onClose}:{phone?:string;blocked:boolean;onFill:()=>void;onClose:()=>void}){
 const [dismissed,setDismissed]=useState(false),close=()=>{setDismissed(true);onClose()};
 if(dismissed||!needsPhone(phone))return null;
 return <Dialog open={!blocked} onOpenChange={next=>{if(!next)close()}}><DialogContent className="app-dialog gender-prompt" showCloseButton>
  <DialogHeader><DialogTitle><Phone size={22} aria-hidden="true"/>道友仙箓尚缺传讯之号</DialogTitle><DialogDescription>分摊场费时若无统一收款人，道友之间各转各的，须知彼此电话号码。还请留下电话，免去收款人逐一转达之劳。号码仅宗主、副宗主和与你互相转账的道友可见。</DialogDescription></DialogHeader>
  <div className="actions"><button type="button" className="primary" onClick={()=>{close();onFill()}}>即刻补录</button><button type="button" className="secondary" onClick={close}>容后再议</button></div>
 </DialogContent></Dialog>;
}
