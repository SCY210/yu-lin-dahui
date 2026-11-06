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
  <DialogHeader><DialogTitle><UserRound size={22} aria-hidden="true"/>道友仙箓尚缺阴阳</DialogTitle><DialogDescription>天机阁排场布阵，讲究阴阳相济、男女相配。道友仙箓上尚未写明性别，还请择定男（乾道）或女（坤道），以免阵法失衡。</DialogDescription></DialogHeader>
  <div className="actions"><button type="button" className="primary" onClick={()=>{close();onFill()}}>即刻补录</button><button type="button" className="secondary" onClick={close}>容后再议</button></div>
 </DialogContent></Dialog>;
}
