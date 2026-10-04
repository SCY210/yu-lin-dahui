'use client';
import {useState,type ReactNode} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
function DateFrame({children,previous,next,previousLabel,nextLabel,first,last}:{children:ReactNode;previous:()=>void;next:()=>void;previousLabel:string;nextLabel:string;first:boolean;last:boolean}) {
 return <div className="month-picker rv-date-picker"><button type="button" className="month-arrow" aria-label={previousLabel} disabled={first} onClick={previous}><ChevronLeft size={18}/></button>{children}<button type="button" className="month-arrow" aria-label={nextLabel} disabled={last} onClick={next}><ChevronRight size={18}/></button></div>;
}

export default function MonthPicker({value,onChange}:{value:string;onChange:(v:string)=>void}) {
 const [open,setOpen]=useState(false),[browseYear,setBrowseYear]=useState(Number(value.slice(0,4)));
 const [year,month]=value.split('-').map(Number);
 function move(delta:number){const index=year*12+month-1+delta,y=Math.floor(index/12),m=index%12+1;if(y<2000||y>2100)return;onChange(`${y}-${String(m).padStart(2,'0')}`);setBrowseYear(y)}
 return <DateFrame previous={()=>move(-1)} next={()=>move(1)} previousLabel="上个月" nextLabel="下个月" first={value==='2000-01'} last={value==='2100-12'}>
  <Popover open={open} onOpenChange={v=>{setOpen(v);if(v)setBrowseYear(year)}}><PopoverTrigger asChild><button type="button" className="month-current" aria-label="选择排名月份"><CalendarDays size={18}/><span>{year}年{month}月</span></button></PopoverTrigger><PopoverContent className="month-panel" align="end" sideOffset={8}>
   <div className="month-year"><button type="button" className="month-arrow" aria-label="上一年" disabled={browseYear<=2000} onClick={()=>setBrowseYear(browseYear-1)}><ChevronLeft size={18}/></button><strong>{browseYear}年</strong><button type="button" className="month-arrow" aria-label="下一年" disabled={browseYear>=2100} onClick={()=>setBrowseYear(browseYear+1)}><ChevronRight size={18}/></button></div>
   <div className="month-grid">{Array.from({length:12},(_,i)=>i+1).map(m=><button type="button" key={m} className={browseYear===year&&m===month?'selected':''} onClick={()=>{onChange(`${browseYear}-${String(m).padStart(2,'0')}`);setOpen(false)}}>{m}月</button>)}</div>
  </PopoverContent></Popover>
 </DateFrame>;
}

export function YearPicker({value,onChange}:{value:number;onChange:(v:number)=>void}) {
 return <DateFrame previous={()=>onChange(value-1)} next={()=>onChange(value+1)} previousLabel="上一年排名" nextLabel="下一年排名" first={value<=2000} last={value>=2100}>
  <div className="month-current rv-year-current"><CalendarDays size={18}/><select aria-label="选择排名年份" value={value} onChange={e=>onChange(Number(e.target.value))}>{Array.from({length:101},(_,i)=>2000+i).map(year=><option key={year} value={year}>{year}年</option>)}</select></div>
 </DateFrame>;
}
