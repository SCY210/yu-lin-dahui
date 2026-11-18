'use client';
import AppSelect from './app-select';
import {Filter} from 'lucide-react';
import './match-player-filter.css';

/** compact: only the select with a filter icon, beside the 排场方式 tokens (app/event-scheduling.tsx). */
export default function MatchPlayerFilter({ids,value,myId,name,onChange,compact=false}:{ids:string[];value:string;myId:string;name:(id:string)=>string;onChange:(value:string)=>void;compact?:boolean}){
 const options=<><option value="">全部球友</option>{ids.map(id=><option key={id} value={id}>{name(id)}{id===myId?'（我）':''}</option>)}</>;
 if(compact)return <label className={'match-player-filter is-compact'+(value?' is-active':'')} aria-label="对局筛选"><Filter size={15} aria-hidden="true"/><AppSelect aria-label="筛选球友" value={value} onChange={event=>onChange(event.target.value)}>{options}</AppSelect></label>;
 return <section className="match-player-filter" aria-label="对局筛选">
  <label><span><Filter size={16} aria-hidden="true"/>筛选球友</span><AppSelect aria-label="筛选球友" value={value} onChange={event=>onChange(event.target.value)}>{options}</AppSelect></label>
  <div className="match-filter-shortcuts">{ids.includes(myId)&&value!==myId&&<button type="button" className="secondary" onClick={()=>onChange(myId)}>只看我的</button>}{value&&<button type="button" className="ghost" onClick={()=>onChange('')}>清除筛选</button>}</div>
 </section>;
}
