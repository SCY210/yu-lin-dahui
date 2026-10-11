'use client';
import {Gift,ChevronRight} from 'lucide-react';
import './treasure-entry.css';

export default function TreasureEntry({balance,onOpen}:{balance:number;onOpen:()=>void}){
 return <button type="button" className="card treasure-entry" onClick={onOpen}>
  <span className="treasure-entry-icon"><Gift size={23}/></span>
  <span className="treasure-entry-copy"><strong>羽林宝阁</strong><small>用羽币，兑换一份打球的小快乐</small></span>
  <span className="treasure-entry-balance">{balance.toLocaleString('zh-CN')}<small>羽币</small></span><ChevronRight size={18} aria-hidden="true"/>
 </button>;
}
