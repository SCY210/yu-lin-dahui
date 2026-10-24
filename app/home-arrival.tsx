'use client';
import {UserCheck,Clock} from 'lucide-react';
import {arrivalCommand,myArrivalHolds,type ArrivalHold} from '../lib/client/arrival-holds';
import type {Event} from '../lib/domain/types';
import './home-arrival.css';

type Props={events:Event[];players:{id:string;ownerId:string;name:string}[];me:{id:string;playerId:string};now:number;busy?:boolean;
 onArrive:(action:string,payload:Record<string,unknown>)=>void;onOpen:(eventId:string)=>void};
/** Top of the home page while this member (or a friend they registered) was reported late or absent in a running
 * activity: scheduling skips them until they confirm they are here (docs/POINTS_ATTENDANCE.md). */
export default function HomeArrival({events,players,me,now,busy,onArrive,onOpen}:Props){
 const holds=myArrivalHolds(events,players,me,now);
 if(!holds.length)return null;
 const name=(id:string)=>players.find(p=>p.id===id)?.name??'代报名朋友',title=(id:string)=>events.find(e=>e.id===id)?.title??'活动';
 const self=(h:ArrivalHold)=>h.playerId===me.playerId;
 return <section className="card home-arrival" role="status" aria-live="polite">
  <div className="home-arrival-title"><Clock size={20} aria-hidden="true"/><strong>{holds.some(self)?'你还没确认到场，暂时不会排你上场':'代报名的朋友还没确认到场'}</strong></div>
  <p className="hint">到了球馆就点下面的按钮，系统会马上恢复排场，按场数正常轮换上场。</p>
  <div className="home-arrival-list">{holds.map(h=><div className="home-arrival-item" key={h.eventId+h.playerId}>
   <button type="button" className="home-arrival-event" onClick={()=>onOpen(h.eventId)}><strong>{title(h.eventId)}</strong><small>{self(h)?'':name(h.playerId)+' · '}{h.kind==='late'?'被报告迟到':'被标记没到场'}</small></button>
   <button type="button" className="primary home-arrival-button" disabled={busy} onClick={()=>{const c=arrivalCommand(h);onArrive(c.action,c.payload)}}><UserCheck size={18} aria-hidden="true"/>{self(h)?'我已到场':name(h.playerId)+' 已到场'}</button>
  </div>)}</div>
 </section>;
}
