'use client';
import {Minus,Plus} from 'lucide-react';
import './price-stepper.css';

export default function PriceStepper({value,label,onChange,step=0.1,min=0,max}:{value:number;label:string;onChange:(value:number)=>void;step?:number;min?:number;max?:number}){
 const adjust=(direction:number)=>onChange(Math.min(max??Infinity,Math.max(min,(Math.round(value*100)+direction*Math.round(step*100))/100)));
 return <div className="price-stepper" role="group" aria-label={label}>
  <button type="button" aria-label={`减少 ${step} 欧元`} disabled={value<=min} onClick={()=>adjust(-1)}><Minus size={20} aria-hidden="true"/></button>
  <output aria-live="polite" aria-atomic="true">{value.toFixed(1)}<span>欧元 / 小时</span></output>
  <button type="button" aria-label={`增加 ${step} 欧元`} disabled={max!==undefined&&value>=max} onClick={()=>adjust(1)}><Plus size={20} aria-hidden="true"/></button>
 </div>;
}
