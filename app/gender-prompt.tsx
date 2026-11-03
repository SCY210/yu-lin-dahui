'use client';
import {useState} from 'react';
import {UserRound} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {needsGender} from '../lib/player-profile-options';

/** Every time the app opens, a member whose gender is neither male nor female is asked to set it: scheduling uses it
 * to balance mixed doubles (docs/GENDER_BALANCE.md). Closing it lasts until the app is opened again. */
export default function GenderPrompt({gender,blocked,onFill,onClose}:{gender?:string;blocked:boolean;onFill:()=>void;onClose:()=>void}){
 const [dismissed,setDismissed]=useState(false),close=()=>{setDismissed(true);onClose()};
 if(dismissed||!needsGender(gender))return null;
 return <Dialog open={!blocked} onOpenChange={next=>{if(!next)close()}}><DialogContent className="app-dialog gender-prompt" showCloseButton>
  <DialogHeader><DialogTitle><UserRound size={22} aria-hidden="true"/>请填写性别</DialogTitle><DialogDescription>排场会按性别安排男女搭配，很重要。请选择男或女。</DialogDescription></DialogHeader>
  <div className="actions"><button type="button" className="primary" onClick={()=>{close();onFill()}}>去填写</button><button type="button" className="secondary" onClick={close}>稍后</button></div>
 </DialogContent></Dialog>;
}
