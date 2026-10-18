'use client';
import {madridDateTime} from '../lib/time-planning';
import {evenBounds,fitParts,maxPartHours,moveBound,partCounts,partEpoch as epoch,validBounds,type CourtPart} from './court-parts-model';
import './court-parts.css';

const hour=3600000;
const hm=(v:string)=>v.slice(11,16);
const hoursText=(h:number)=>(Number.isInteger(h)?h:h.toFixed(1))+' 小时';

/** Who booked each part of one court slot. A member books one to two hours at a time, so the organiser first chooses
 * how many parts the court has (only counts that fit), then drags the boundaries along the court's hours; every part
 * stays one to two hours long. Each part then gets its booker. */
export default function CourtParts({start,end,parts,members,label,onChange}:{start:string;end:string;parts:CourtPart[];members:string[][];label:string;onChange:(parts:CourtPart[])=>void}){
 const list=fitParts(start,end,parts),from=epoch(start),total=(epoch(end)-from)/hour;
 const bounds=list.slice(1).map(p=>(epoch(p.start)-from)/hour),edges=[0,...bounds,total];
 const at=(h:number)=>madridDateTime(from+h*hour),name=(id:string)=>members.find(([pid])=>pid===id)?.[1]??'';
 const counts=Number.isFinite(total)?partCounts(total):[];
 // Changing the boundaries keeps each part's booker by position.
 const save=(next:number[])=>onChange([{...list[0],start},...next.map((h,i)=>({start:at(h),advancedBy:list[i+1]?.advancedBy??''}))]);
 const choose=(n:number)=>n===list.length?undefined:save(n>1?evenBounds(total,n):[]);
 const set=(i:number,advancedBy:string)=>onChange(list.map((p,j)=>j===i?{...p,advancedBy}:p));
 const ticks=Number.isFinite(total)?Array.from({length:Math.floor(total)+1},(_,h)=>h):[];
 return <div className="court-parts">
  <div className="court-parts-count" role="group" aria-label={label+' 拆成几段'}>
   <span>这片场地由几个人约（每人每次 1–2 小时）</span>
   <div>{[1,...counts].map(n=><button key={n} type="button" className={n===list.length?'secondary':'ghost'} aria-pressed={n===list.length} onClick={()=>choose(n)}>{n===1?'一个人约':n+' 段'}</button>)}</div>
   {list.length===1&&total>maxPartHours&&counts.length>0&&<small className="hint">每人每次最多约 {maxPartHours} 小时：{hoursText(total)}至少要拆成 {counts[0]} 段。</small>}
   {list.length>1&&!validBounds(total,bounds)&&<small className="warning">有一段不在 1–2 小时之间，请拖动分界点调整。</small>}
  </div>
  <div className="court-parts-track">
   <div className="court-parts-bar" aria-hidden="true">{list.map((p,i)=><span key={i} className={p.advancedBy?'':'is-empty'} style={{flexGrow:Math.max(.01,edges[i+1]-edges[i])}}><small>{hm(p.start)}–{hm(at(edges[i+1]))}</small><b>{name(p.advancedBy)||'待选择'}</b></span>)}</div>
   {bounds.map((b,k)=><input key={k} type="range" className="court-parts-handle" min={0} max={total} step={1} value={b} aria-label={label+' 第 '+(k+1)+' 段和第 '+(k+2)+' 段的分界'} aria-valuetext={hm(at(b))} onChange={ev=>save(moveBound(total,bounds,k,Number(ev.target.value)))}/>)}
  </div>
  {list.length>1&&<div className="court-parts-ticks" aria-hidden="true">{ticks.map(h=><span key={h} style={{left:(h/total*100)+'%'}}>{hm(at(h)).slice(0,2)}</span>)}</div>}
  {list.map((p,i)=><div className="court-part" key={i}>
   <div className="court-part-head"><strong>{list.length>1?'第 '+(i+1)+' 段':'整个时段'}</strong><span>{hm(p.start)}–{hm(at(edges[i+1]))} · {hoursText(edges[i+1]-edges[i])}</span></div>
   <label className="court-part-field"><span>{list.length>1?'这一段谁约的（这段场费由他垫付）':'谁约的（场费由他垫付）'}</span><select className="pick native-form-select" required value={p.advancedBy} aria-label={label+(list.length>1?' 第 '+(i+1)+' 段':'')+' 约场人'} onChange={ev=>set(i,ev.target.value)}>
    {!p.advancedBy&&<option value="" disabled>请选择约场的球友</option>}{members.map(([id,n])=><option key={id} value={id}>{n}</option>)}
   </select></label>
  </div>)}
 </div>;
}
