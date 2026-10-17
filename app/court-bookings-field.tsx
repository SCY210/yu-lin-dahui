'use client';
import {Plus} from 'lucide-react';
import HalfHourDateTime from './half-hour-date-time';
import {madridDateTime,madridEpoch} from '../lib/time-planning';
import './court-bookings-field.css';

/** One booked court slot of a new activity and the member who booked (and pays) it (docs/FEE_ADVANCES.md). */
export type CourtRow={name:string;start:string;end:string;advancedBy:string};
const halfHour=1800000;
/** The half hour nearest the middle of a slot, or null when the slot is shorter than an hour or not a valid time. */
function middle(row:CourtRow){try{const start=madridEpoch(row.start),end=madridEpoch(row.end);if(end-start<2*halfHour)return null;return madridDateTime(start+Math.round((end-start)/2/halfHour)*halfHour)}catch{return null}}

/** Court slots of a new activity. Slots booked by different members, or two courts at the same time, are separate rows;
 * every row needs the member who booked it. */
export default function CourtBookingsField({rows,members,onChange}:{rows:CourtRow[];members:string[][];onChange:(rows:CourtRow[])=>void}){
 const set=(index:number,patch:Partial<CourtRow>)=>onChange(rows.map((row,i)=>i===index?{...row,...patch}:row));
 // One court booked by two members in turn (each may book only two hours a day): split the slot where the second
 // booking starts, then choose who booked each part.
 const split=(index:number,at:string)=>onChange(rows.flatMap((row,i)=>i===index?[{...row,end:at},{...row,start:at,advancedBy:''}]:[row]));
 // Another court at the same time as the first slot, numbered after the courts already listed.
 const add=()=>{const first=rows[0],numbers=rows.map(r=>Number(/^(\d+)号场$/.exec(r.name.trim())?.[1]??0));onChange([...rows,{name:(Math.max(0,...numbers)+1)+'号场',start:first.start,end:first.end,advancedBy:''}])};
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
   <div className="actions">{middle(row)&&<button type="button" className="ghost" onClick={()=>split(i,middle(row)!)}>拆成两段（不同的人约的）</button>}{rows.length>1&&<button type="button" className="ghost danger" onClick={()=>onChange(rows.filter((_,j)=>j!==i))}>删除这个时段</button>}</div>
  </fieldset>)}
  <button type="button" className="secondary" onClick={add}><Plus size={16} aria-hidden="true"/> 添加另一片场地</button>
  <small className="hint">同一场地由不同的人连续预约，拆开填写约场人后会自动合并为一个接龙，不重复计算人数上限；另一片场地请使用不同名称。每段垫付的场费仍分别结算。</small>
 </div>;
}
