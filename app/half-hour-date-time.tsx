'use client';
import {useEffect,useId,useRef} from 'react';
import {halfHourTimes,isHalfHourTime,madridEpoch,plannedDateChange} from '../lib/time-planning';
import './half-hour-date-time.css';

export default function HalfHourDateTime({value='',label,onChange,optional=false}:{value?:string;label:string;onChange:(value:string)=>void;optional?:boolean}){
 const [date='',time='']=value.split('T');
 const originalTime=useRef(time),dateInput=useRef<HTMLInputElement>(null),hintId=useId();
 const legacy=!!time&&!isHalfHourTime(time)&&time===originalTime.current;
 let error='';
 if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&/^\d{2}:\d{2}$/.test(time))try{madridEpoch(value)}catch(e){error=e instanceof Error?e.message:'时间无效'}
 useEffect(()=>{dateInput.current?.setCustomValidity(error)},[error]);
 return <div className="half-hour-field"><div className="half-hour-controls">
  <input ref={dateInput} type="date" className="half-hour-date" aria-label={`${label} · 日期`} aria-invalid={!!error} aria-describedby={hintId} value={date} required={!optional} onChange={ev=>onChange(plannedDateChange(value,ev.target.value))}/>
  <select className="pick native-form-select half-hour-time" aria-label={`${label} · 时间`} aria-describedby={hintId} value={time} required={!optional} onChange={ev=>onChange(`${date}T${ev.target.value}`)}>
   <option value="" disabled>请选择时间</option>{halfHourTimes.map(t=><option key={t} value={t}>{t}</option>)}{legacy&&<option value={time}>{time}（原时间）</option>}
  </select>
 </div><small id={hintId} className={error?'half-hour-error':'half-hour-hint'} role={error?'alert':undefined}>{error||'马德里时间 · 整点 / 半点'}</small></div>;
}
