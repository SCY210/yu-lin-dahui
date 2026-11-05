'use client';
import {bookingParts} from '../lib/domain/booking-advancers';
import {bookingClaimVersion} from '../lib/domain/booking-claims';
import {canManageEvent} from '../lib/domain/permissions';
import type {Booking,Event} from '../lib/domain/types';
import type {SchedulingContext} from './event-scheduling';
import {choice,dt,epoch,fmt,hm,type Form} from './form-fields';
import Disclosure from './disclosure';
import './booking-claims.css';

/** Preserve the exact booking timestamps in option values; labels always use the club's Madrid time. */
export function bookingClaimForm(b:Booking,playerId:string,correct=false,members:string[][]=[]):Form{
 const cuts=[b.start];for(let t=b.start+1800000;t<b.end;t+=1800000)cuts.push(t);cuts.push(b.end);
 const label=(t:number)=>fmt(t,{month:'numeric',day:'numeric'})+' '+hm(t);
 const available=cuts.slice(0,-1).find(t=>!(b.claims??[]).some(c=>c.playerId!==playerId&&c.start<=t&&c.end>t))??b.start;
 const end=Math.min(b.end,available+2*3600000);
 return {title:correct?'纠正约场人 · '+b.name:'认领我的约场时段 · '+b.name,action:'bookingClaim',
  description:`${b.venue??''} · ${label(b.start)}–${hm(b.end)}。请选择你实际预约并垫付的时间，认领会同步场费垫付归属，不会改变接龙和排场。${correct?'组织者可纠正已认领时段。':'别人已认领的时间不可覆盖；认领错了请联系组织者。'}`,
  values:{bookingId:b.id,start:dt(available),end:dt(end),expected:bookingClaimVersion(b),correct,playerId,reason:''},
  fields:[choice('start','我约的开始时间',cuts.slice(0,-1).map(t=>[dt(t),label(t)])),choice('end','我约的结束时间',cuts.slice(1).map(t=>[dt(t),label(t)])),...(correct?[choice('playerId','实际约场人',members)]:[])],
  convert:v=>({...v,start:epoch(v.start),end:epoch(v.end)}),
 };
}

export default function BookingClaims({b,e,ctx}:{b:Booking;e:Event;ctx:Pick<SchedulingContext,'data'|'busy'|'open'|'name'|'readOnly'>}){
 const {data}=ctx,manager=canManageEvent(data.me,e),me=data.players.find(p=>p.id===data.me.playerId),settled=data.settlements.some(s=>s.eventId===e.id&&s.confirmed);
 if(e.deletedAt!==undefined||e.status==='cancelled'||ctx.readOnly)return null;
 const launch=(correct=false)=>{const form=bookingClaimForm(b,data.me.playerId,correct,data.players.filter(p=>p.enabled&&!p.guest).map(p=>[p.id,p.name]));ctx.open(form.title,form.action,form.values,form.fields,form.convert,form.description)};
 const cuts=[...new Set([b.start,b.end,...bookingParts(b).map(p=>p.start),...(b.claims??[]).flatMap(c=>[c.start,c.end])])].filter(t=>t>=b.start&&t<=b.end).sort((a,b)=>a-b);
 const parts=bookingParts(b),rows=cuts.slice(0,-1).map((start,i)=>({start,end:cuts[i+1],playerId:parts.find(p=>p.start<=start&&p.end>start)?.advancedBy,claimed:(b.claims??[]).some(c=>c.start<=start&&c.end>=cuts[i+1])}));
 return <div className="booking-claims"><Disclosure label={'约场时段认领'+(b.claims?.length?' · '+b.claims.length+' 段已认领':' · 待核对')}>
  <p className="hint">登记人可以先由组织者代填，再由实际约场的球友认领。</p>
  <ul className="booking-claim-rows">{rows.map(row=><li key={row.start}><span>{hm(row.start)}–{hm(row.end)}</span><strong>{row.playerId?ctx.name(row.playerId):'未登记'}</strong><small>{row.claimed?'已认领':'当前登记'}</small></li>)}</ul>
  {settled?<p className="hint">费用已确认；如需纠正，请联系组织者从费用页调整并重新确认分摊。</p>:<div className="actions"><button type="button" className="secondary" disabled={ctx.busy||!me?.enabled||!!me.guest||e.status==='draft'&&!manager} onClick={()=>launch()}>认领我约的时间</button>{manager&&<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>launch(true)}>纠正约场人</button>}</div>}
 </Disclosure></div>;
}
