'use client';
import {Gift,ChevronRight} from 'lucide-react';
import './treasure-entry.css';

/** Header shortcut to 羽林宝阁, next to 提醒; the balance is in the accessible name and tooltip. */
export function TreasureIcon({balance,active,onOpen}:{balance:number;active:boolean;onOpen:()=>void}){
 const label='羽林宝阁 · '+balance.toLocaleString('zh-CN')+' 羽币';
 return <button type="button" className={'treasure-icon'+(active?' is-active':'')} aria-label={label} title={label} aria-current={active?'page':undefined} onClick={onOpen}><Gift size={20} aria-hidden="true"/></button>;
}
export default function TreasureEntry({balance,onOpen}:{balance:number;onOpen:()=>void}){
 return <button type="button" className="card treasure-entry" onClick={onOpen}>
  <span className="treasure-entry-icon"><Gift size={23}/></span>
  <span className="treasure-entry-copy"><strong>羽林宝阁</strong><small>用羽币，兑换一份打球的小快乐</small></span>
  <span className="treasure-entry-balance">{balance.toLocaleString('zh-CN')}<small>羽币</small></span><ChevronRight size={18} aria-hidden="true"/>
 </button>;
}
