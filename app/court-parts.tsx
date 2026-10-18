'use client';
import {Scissors} from 'lucide-react';
import HalfHourDateTime from './half-hour-date-time';
import {fitParts,partEpoch as epoch,partMiddle as middle,type CourtPart} from './court-parts-model';
import './court-parts.css';

const halfHour=1800000;
const hm=(v:string)=>v.slice(11,16);

/** Who booked each part of one court slot, with a bar that shows the parts to scale. Splitting halves the longest part
 * at its middle half hour (a six-hour court becomes three hours each); each later part's start can be moved. */
export default function CourtParts({start,end,parts,members,label,onChange}:{start:string;end:string;parts:CourtPart[];members:string[][];label:string;onChange:(parts:CourtPart[])=>void}){
 const list=fitParts(start,end,parts),ends=list.map((p,i)=>list[i+1]?.start??end);
 const total=Math.max(1,epoch(end)-epoch(start)),name=(id:string)=>members.find(([pid])=>pid===id)?.[1]??'';
 const hours=(i:number)=>Math.max(0,(epoch(ends[i])-epoch(list[i].start))/3600000);
 const set=(i:number,patch:Partial<CourtPart>)=>onChange(list.map((p,j)=>j===i?{...p,...patch}:p));
 const longest=list.map((_,i)=>i).sort((a,b)=>hours(b)-hours(a))[0],cut=middle(list[longest].start,ends[longest]);
 const split=()=>{if(cut)onChange([...list.slice(0,longest+1),{start:cut,advancedBy:''},...list.slice(longest+1)])};
 // A later part's start stays at least half an hour after the previous part's start and before its own end.
 const move=(i:number,value:string)=>{const at=epoch(value);if(at>=epoch(list[i-1].start)+halfHour&&at<=epoch(ends[i])-halfHour)set(i,{start:value})};
 return <div className="court-parts">
  <div className="court-parts-bar" aria-hidden="true">{list.map((p,i)=><span key={i} className={p.advancedBy?'':'is-empty'} style={{flexGrow:Math.max(1,(epoch(ends[i])-epoch(p.start))/total*100)}}><small>{hm(p.start)}–{hm(ends[i])}</small><b>{name(p.advancedBy)||'待选择'}</b></span>)}</div>
  {list.map((p,i)=><div className="court-part" key={i}>
   <div className="court-part-head"><strong>{list.length>1?'第 '+(i+1)+' 段':'整个时段'}</strong><span>{hm(p.start)}–{hm(ends[i])} · {hours(i)} 小时</span></div>
   {i>0&&<div className="court-part-field"><span>这一段从几点开始</span><HalfHourDateTime value={p.start} label={label+' 第 '+(i+1)+' 段开始'} onChange={value=>move(i,value)}/></div>}
   <label className="court-part-field"><span>{list.length>1?'这一段谁约的（这段场费由他垫付）':'谁约的（场费由他垫付）'}</span><select className="pick native-form-select" required value={p.advancedBy} aria-label={label+(list.length>1?' 第 '+(i+1)+' 段':'')+' 约场人'} onChange={ev=>set(i,{advancedBy:ev.target.value})}>
    {!p.advancedBy&&<option value="" disabled>请选择约场的球友</option>}{members.map(([id,n])=><option key={id} value={id}>{n}</option>)}
   </select></label>
   {i>0&&<button type="button" className="ghost danger" onClick={()=>onChange(list.filter((_,j)=>j!==i))}>删除这一段（并入上一段）</button>}
  </div>)}
  {cut&&<button type="button" className="ghost court-parts-split" onClick={split}><Scissors size={15} aria-hidden="true"/> {list.length>1?'再拆一段':'拆成两段（不同的人约的）'}</button>}
 </div>;
}
