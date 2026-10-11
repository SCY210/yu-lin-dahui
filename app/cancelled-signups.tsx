'use client';
import type {ClubData} from '../lib/contracts/club';
import {guestNote} from '../lib/client/guests';
import {fmt} from './form-fields';
import './cancelled-signups.css';

type Ctx={data:ClubData;name:(id:string)=>string};
type ClubEvent=ClubData['events'][number];

/** Who signed up and then cancelled, visible to everyone who can see the activity: when, who did it and the reason. */
export default function CancelledSignups({e,ctx}:{e:ClubEvent;ctx:Ctx}){
 const {data,name}=ctx;
 const rows=data.registrations.flatMap(r=>r.eventId===e.id&&'cancellation' in r&&r.cancellation?[{r,c:r.cancellation}]:[])
  .sort((a,b)=>(b.c.at??0)-(a.c.at??0));
 if(!rows.length)return null;
 const by=(c:typeof rows[number]['c'])=>c.by==='self'?'本人取消':c.by==='registrant'?'由 '+(c.byName??'代报名的人')+' 取消':c.by==='organizer'?'由组织者'+(c.byName?' '+c.byName:'')+'取消':c.byName?'由 '+c.byName+' 取消':'已取消';
 return <details className="ev-details cancelled-signups"><summary>已取消 · {rows.length} 人</summary><div className="ev-details-content">
  {rows.map(({r,c})=>{const note=guestNote(data.players,r.playerId);return <div className="cancelled-signup" key={r.id}>
   <strong>{name(r.playerId)}{note&&<small> · {note}</small>}</strong>
   <span>{c.at!==undefined?fmt(c.at,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+' · ':''}{by(c)}</span>
   {c.reason&&<small>原因：{c.reason}</small>}
  </div>})}
 </div></details>;
}
