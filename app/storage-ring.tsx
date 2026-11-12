'use client';
import {useState} from 'react';
import {Gem,Megaphone,Package} from 'lucide-react';
import type {ClubData} from '../lib/contracts/club';
import GiftArt from './gift-art';
import {fmt} from './form-fields';
import {hornDuration,hornTextMax} from '../lib/domain/horn';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import './storage-ring.css';

type Item=ClubData['treasureShop']['ring'][number];
const page=12;

/** An unused gifted 传音喇叭 can be used; everything else is kept as a record. */
export function ringUnused(item:Item){return item.kind==='horn'&&item.hornText===undefined}
function ringStatus(item:Item,onAir:boolean){
 if(item.kind==='horn'){
  if(item.hornText===undefined)return '待使用';
  if(item.hornRemovedAt!==undefined)return '已被撤下';
  return onAir&&item.hornEnd!==undefined?'传音中，至 '+fmt(item.hornEnd):'已用完';
 }
 if(item.kind==='gift')return '珍藏中';
 return item.status==='pending'?'待宗主发放':'已发放';
}

/** 储物戒 (docs/BONDS.md): the shop items a member holds, received as gifts or redeemed for themselves. A gifted
 * 传音喇叭 waits here until its receiver writes their own text and puts it on air. */
export default function StorageRing({items,busy,name,onAir,onUseHorn}:{items:Item[];busy:boolean;name:(id:string)=>string;onAir:Set<string>;onUseHorn:(item:Item,text:string)=>void}){
 const [limit,setLimit]=useState(page),[using,setUsing]=useState<Item|null>(null);
 const sorted=[...items].sort((a,b)=>Number(ringUnused(b))-Number(ringUnused(a))||b.at-a.at);
 const unused=sorted.filter(ringUnused).length;
 return <section className="ts-ring" aria-labelledby="ts-ring-title">
  <div className="ts-ring-head"><h2 id="ts-ring-title"><Gem size={19} aria-hidden="true"/>储物戒</h2><span>{items.length?items.length+' 件道具'+(unused?' · '+unused+' 件待使用':''):'空空如也'}</span></div>
  {!items.length?<p className="ts-ring-empty">戒中尚无一物。兑换的好物、道友相赠的礼物都会收进这里。</p>:<>
   <ul className="ts-ring-items">{sorted.slice(0,limit).map(item=>{const free=ringUnused(item);return <li key={item.id} className={'ts-ring-item'+(free?' ts-ring-ready':'')}>
    <span className="ts-ring-icon" aria-hidden="true">{item.kind==='gift'?<GiftArt name={item.productName}/>:item.kind==='horn'?<Megaphone size={22}/>:<Package size={22}/>}</span>
    <div className="ts-ring-main">
     <strong>{item.productName}{item.kind==='horn'?(item.hornHours?' · '+hornDuration(item.hornHours):''):' × '+item.quantity}</strong>
     <small>{item.fromPlayerId?name(item.fromPlayerId)+' 所赠':'自己兑换'} · {fmt(item.at)}</small>
     {item.message&&<q>{item.message}</q>}
     {item.kind==='horn'&&item.hornText!==undefined&&<small className="ts-ring-horn-text">“{item.hornText}”</small>}
    </div>
    {free?<button type="button" className="primary ts-ring-use" disabled={busy} onClick={()=>setUsing(item)}>使用</button>:<span className="ts-ring-status">{ringStatus(item,onAir.has(item.id))}</span>}
   </li>})}</ul>
   {sorted.length>limit&&<button type="button" className="ghost ts-ring-more" onClick={()=>setLimit(limit+page)}>再看 {Math.min(page,sorted.length-limit)} 件（共 {sorted.length} 件）</button>}
  </>}
  {using&&<HornUse key={using.id} item={using} busy={busy} onClose={()=>setUsing(null)} onUse={text=>{setUsing(null);onUseHorn(using,text)}}/>}
 </section>;
}

function HornUse({item,busy,onClose,onUse}:{item:Item;busy:boolean;onClose:()=>void;onUse:(text:string)=>void}){
 const [text,setText]=useState(''),trimmed=text.trim(),length=[...trimmed].length,hours=item.hornHours??0;
 return <Dialog open onOpenChange={next=>{if(!next)onClose()}}><DialogContent className="app-dialog ts-product-dialog">
  <DialogHeader><DialogTitle>使用{item.productName}</DialogTitle><DialogDescription className="ts-product-description">写下一句话，确认后立刻在所有道友页面顶部滚动传音 {hornDuration(hours)}，到期自动停止。</DialogDescription></DialogHeader>
  <label className="ts-gift-field">喇叭内容<textarea aria-label="喇叭内容" rows={2} maxLength={hornTextMax*2} value={text} disabled={busy} onChange={e=>setText(e.target.value.replace(/[\r\n]+/g,' '))} placeholder={`最多 ${hornTextMax} 个字，所有道友都会看到`}/></label>
  <p className="ts-horn-count" aria-live="polite">{length}/{hornTextMax} 字 · 屏蔽词会显示为 *；宗主或副宗主可提前撤下不当内容。</p>
  {trimmed&&<p className="ts-horn-preview"><Megaphone size={14} aria-hidden="true"/><span>预览：我 传音：{trimmed}</span></p>}
  <button type="button" className="primary ts-redeem" disabled={busy||!length||length>hornTextMax} onClick={()=>onUse(trimmed)}>{!length?'请填写喇叭内容':length>hornTextMax?`最多 ${hornTextMax} 个字`:'开始传音 '+hornDuration(hours)}</button>
 </DialogContent></Dialog>;
}
