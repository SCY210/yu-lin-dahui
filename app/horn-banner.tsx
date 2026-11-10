'use client';
import {Megaphone} from 'lucide-react';
import './horn-banner.css';

export type HornBroadcast={id:string;playerId:string;hornText:string;start:number;end:number};

/** The 传音喇叭 strip at the very top of every page (docs/HORN_BROADCAST.md): each bought text scrolls right to
 * left with the buyer's name until its duration ends. Tapping it opens the shop, where members see every broadcast
 * and can buy their own. With reduced motion the texts stand still and wrap. */
export default function HornBanner({horns,name,onOpen}:{horns?:HornBroadcast[];name:(id:string)=>string;onOpen:()=>void}){
 if(!horns?.length)return null;
 const items=horns.map(h=>({key:h.id,who:name(h.playerId),text:h.hornText}));
 const seconds=Math.max(12,Math.round(items.reduce((n,i)=>n+i.who.length+i.text.length+4,0)*.3));
 // Phrasing content only: the whole strip is one button.
 const list=(copy:boolean)=><span className="horn-list" aria-hidden={copy||undefined}>{items.map(i=><span className="horn-item" key={i.key}><span className="horn-who">{i.who} 传音：</span>{i.text}</span>)}</span>;
 return <button type="button" className="horn-banner" aria-label={'传音喇叭，共 '+items.length+' 条，点按进入羽林宝阁'} onClick={onOpen}>
  <span className="horn-seal" aria-hidden="true"><Megaphone size={15}/></span>
  <span className="horn-window"><span className="horn-track" style={{animationDuration:seconds+'s'}}>{list(false)}{list(true)}</span></span>
 </button>;
}
