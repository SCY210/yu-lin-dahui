'use client';
import {Filter} from 'lucide-react';
import './match-player-filter.css';

export default function MatchPlayerFilter({ids,value,myId,name,onChange}:{ids:string[];value:string;myId:string;name:(id:string)=>string;onChange:(value:string)=>void}){
 return <section className="match-player-filter" aria-label="对局筛选">
  <label><span><Filter size={16} aria-hidden="true"/>筛选球友</span><select value={value} onChange={event=>onChange(event.target.value)}><option value="">全部球友</option>{ids.map(id=><option key={id} value={id}>{name(id)}{id===myId?'（我）':''}</option>)}</select></label>
  <div className="match-filter-shortcuts">{ids.includes(myId)&&value!==myId&&<button type="button" className="secondary" onClick={()=>onChange(myId)}>只看我的</button>}{value&&<button type="button" className="ghost" onClick={()=>onChange('')}>清除筛选</button>}</div>
 </section>;
}
