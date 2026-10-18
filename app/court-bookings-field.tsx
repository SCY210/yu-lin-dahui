'use client';
import {Plus} from 'lucide-react';
import HalfHourDateTime from './half-hour-date-time';
import CourtParts from './court-parts';
import {fitParts,fromParts,rowParts,type CourtRow} from './court-parts-model';
import './court-bookings-field.css';
export type {CourtRow};

/** Courts of a new activity. A court booked by members in turn stays one court with several parts; two courts at the
 * same time are separate courts. Every part needs the member who booked it. */
export default function CourtBookingsField({rows,members,onChange}:{rows:CourtRow[];members:string[][];onChange:(rows:CourtRow[])=>void}){
 const set=(index:number,patch:Partial<CourtRow>)=>onChange(rows.map((row,i)=>{
  if(i!==index)return row;const next={...row,...patch};
  // Moving the court's start or end keeps only the parts that still fit.
  return {...next,...fromParts(fitParts(next.start,next.end,rowParts(next)))};
 }));
 // Another court at the same time as the first one, numbered after the courts already listed.
 const add=()=>{const first=rows[0],numbers=rows.map(r=>Number(/^(\d+)号场$/.exec(r.name.trim())?.[1]??0));onChange([...rows,{name:(Math.max(0,...numbers)+1)+'号场',start:first.start,end:first.end,advancedBy:'',handovers:[]}])};
 return <div className="court-bookings">
  {rows.map((row,i)=><fieldset className="court-booking" key={i}>
   <legend>场地 {i+1}</legend>
   <label><span>场地名称</span><input value={row.name} required maxLength={150} onChange={ev=>set(i,{name:ev.target.value})}/></label>
   <div className="court-booking-times">
    <div><span>开始</span><HalfHourDateTime value={row.start} label={'场地 '+(i+1)+' 开始'} onChange={start=>set(i,{start})}/></div>
    <div><span>结束</span><HalfHourDateTime value={row.end} label={'场地 '+(i+1)+' 结束'} onChange={end=>set(i,{end})}/></div>
   </div>
   <CourtParts start={row.start} end={row.end} parts={rowParts(row)} members={members} label={'场地 '+(i+1)} onChange={parts=>set(i,fromParts(parts))}/>
   {rows.length>1&&<div className="actions"><button type="button" className="ghost danger" onClick={()=>onChange(rows.filter((_,j)=>j!==i))}>删除这片场地</button></div>}
  </fieldset>)}
  <button type="button" className="secondary" onClick={add}><Plus size={16} aria-hidden="true"/> 添加另一片场地</button>
  <small className="hint">一片场地由几个人分时段约的（每人每次约 1–2 小时），先选由几个人约，再拖动时间轴上的分界点调整每一段（按整点移动），最后选每一段是谁约的。同时约了几片场地，用“添加另一片场地”。活动结束后，每段的场费从大家的分摊里还给约那一段的人。</small>
 </div>;
}
