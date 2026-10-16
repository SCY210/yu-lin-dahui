'use client';
import {Plus} from 'lucide-react';
import HalfHourDateTime from './half-hour-date-time';
import {madridDateTime,madridEpoch} from '../lib/time-planning';
import './court-bookings-field.css';

/** One booked court slot of a new activity and the member who booked (and pays) it (docs/FEE_ADVANCES.md). */
export type CourtRow={name:string;start:string;end:string;advancedBy:string};
const later=(value:string,ms:number)=>{try{return madridDateTime(madridEpoch(value)+ms)}catch{return value}};

/** Court slots of a new activity. Slots booked by different members, or two courts at the same time, are separate rows;
 * every row needs the member who booked it. */
export default function CourtBookingsField({rows,members,onChange}:{rows:CourtRow[];members:string[][];onChange:(rows:CourtRow[])=>void}){
 const set=(index:number,patch:Partial<CourtRow>)=>onChange(rows.map((row,i)=>i===index?{...row,...patch}:row));
 const add=()=>{const last=rows.at(-1)!;onChange([...rows,{name:last.name,start:last.end,end:later(last.end,3600000),advancedBy:''}])};
 return <div className="court-bookings">
  {rows.map((row,i)=><fieldset className="court-booking" key={i}>
   <legend>场地时段 {i+1}</legend>
   <label><span>场地名称</span><input value={row.name} required maxLength={150} onChange={ev=>set(i,{name:ev.target.value})}/></label>
   <div className="court-booking-times">
    <div><span>开始</span><HalfHourDateTime value={row.start} label={'场地时段 '+(i+1)+' 开始'} onChange={start=>set(i,{start})}/></div>
    <div><span>结束</span><HalfHourDateTime value={row.end} label={'场地时段 '+(i+1)+' 结束'} onChange={end=>set(i,{end})}/></div>
   </div>
   <label><span>谁约的（场费由他垫付）</span><select className="pick native-form-select" required value={row.advancedBy} onChange={ev=>set(i,{advancedBy:ev.target.value})}>
    {!row.advancedBy&&<option value="" disabled>请选择约场的球友</option>}{members.map(([id,name])=><option key={id} value={id}>{name}</option>)}
   </select></label>
   {rows.length>1&&<button type="button" className="ghost danger" onClick={()=>onChange(rows.filter((_,j)=>j!==i))}>删除这个时段</button>}
  </fieldset>)}
  <button type="button" className="secondary" onClick={add}><Plus size={16} aria-hidden="true"/> 添加场地时段</button>
  <small className="hint">不同的人约的时段分开填写，同一时间的两片场地也分开填写。活动结束后，约场的人垫付的场费会从大家的分摊里还给他。</small>
 </div>;
}
