'use client';
import {useMemo,useState} from 'react';
import {courtOccupancy,occupancyDuration,type OccupancySegment} from '../lib/client/court-occupancy';
import type {Booking,Event,Registration} from '../lib/domain/types';
import {hm} from './ui';
import './court-occupancy.css';

const statusName={empty:'无人接龙',short:'人数不足',ready:'可开打'};
const range=(s:Pick<OccupancySegment,'start'|'end'>)=>hm(s.start)+'–'+hm(s.end);
export default function CourtOccupancy({e,bookings,registrations,name}:{e:Event;bookings:Booking[];registrations:Registration[];name:(id:string)=>string}){
 const courts=useMemo(()=>courtOccupancy(e,bookings,registrations),[e,bookings,registrations]);
 const [selected,setSelected]=useState<Record<string,number>>({});
 if(!courts.length||e.status==='cancelled')return null;
 const emptyMs=courts.reduce((total,c)=>total+c.emptyMs,0);
 return <section className="court-occupancy" aria-label="场地时间占用"><header className="occupancy-heading"><div><h3>场地时间占用</h3><p>按正式接龙的参加时段统计 · 候补不计入，不代表实际对局</p></div><strong>{emptyMs?'累计空档 '+occupancyDuration(emptyMs):'所有时段均有人接龙'}</strong></header>
  <div className="occupancy-legend"><span className="occupancy-empty">无人接龙</span><span className="occupancy-short">人数不足</span><span className="occupancy-ready">可开打</span></div>
  {courts.map(({booking:b,segments,needed,emptyMs})=>{
   const gaps=segments.filter(s=>s.status==='empty'),current=segments.find(s=>s.start===selected[b.id])??gaps[0]??segments[0];
   return <div className="occupancy-court" key={b.id}><div className="occupancy-court-heading"><strong>{b.name}<small>{b.venue??e.venue}</small></strong><span>{emptyMs?'空档 '+occupancyDuration(emptyMs):'全程有人接龙'}</span></div>
    <div className="occupancy-track" role="group" aria-label={b.name+'参加时段'}>{segments.map(s=><button type="button" key={s.start} style={{flexGrow:s.end-s.start}} className={'occupancy-segment occupancy-'+s.status} aria-pressed={current.start===s.start} aria-label={b.name+' '+range(s)+' · '+s.playerIds.length+'人 · '+statusName[s.status]} title={range(s)+' · '+s.playerIds.length+'人 · '+statusName[s.status]} onClick={()=>setSelected({...selected,[b.id]:s.start})}><span>{s.playerIds.length?s.playerIds.length+'人':'空'}</span></button>)}</div>
    <div className="occupancy-axis"><time>{hm(b.start)}</time><span>点时间条查看球友</span><time>{hm(b.end)}</time></div>
    {gaps.length>0&&<ul className="occupancy-gaps" aria-label={b.name+'空档'}>{gaps.map(g=><li key={g.start}><strong>{range(g)}</strong><span>无人接龙 · {occupancyDuration(g.end-g.start)}</span></li>)}</ul>}
    <div className="occupancy-selection" aria-live="polite"><p><strong>{range(current)}</strong><span>{current.playerIds.length}人 · {statusName[current.status]}{current.status==='short'?'（至少'+needed+'人）':''}</span></p><div>{current.playerIds.length?current.playerIds.map(id=><span className="occupancy-player" key={id}>{name(id)}</span>):<span className="occupancy-no-player">这个时段暂时没有正式接龙球友</span>}</div></div>
   </div>;
  })}
  {courts.length>1&&emptyMs>0&&<p className="occupancy-footnote">累计空档按各场地分别相加，同一时间两片场地空着会分别计时。</p>}
 </section>;
}
