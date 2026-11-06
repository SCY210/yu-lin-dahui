'use client';
import {useState} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {advancerAt,bookingParts} from '../lib/domain/booking-advancers';
import {bookingClaimVersion} from '../lib/domain/booking-claims';
import {canManageEvent} from '../lib/domain/permissions';
import type {Booking,Event} from '../lib/domain/types';
import type {SchedulingContext} from './event-scheduling';
import {choice,dt,epoch,fmt,hm,type Form} from './form-fields';
import './booking-claims.css';

/** Preserve the exact booking timestamps in option values; labels always use the club's Madrid time. */
/** `range` presets the form to one segment of the timeline. */
export function bookingClaimForm(b:Booking,playerId:string,correct=false,members:string[][]=[],range?:{start:number;end:number}):Form{
 const cuts=[b.start];for(let t=b.start+1800000;t<b.end;t+=1800000)cuts.push(t);cuts.push(b.end);
 const label=(t:number)=>fmt(t,{month:'numeric',day:'numeric'})+' '+hm(t);
 // Start at the first time still 待认领, else at the first time nobody else has claimed.
 const open=(t:number)=>!(b.claims??[]).some(c=>c.playerId!==playerId&&c.start<=t&&c.end>t);
 const available=range?.start??cuts.slice(0,-1).find(t=>open(t)&&!advancerAt(b,t))??cuts.slice(0,-1).find(open)??b.start;
 const end=range?.end??Math.min(b.end,available+2*3600000);
 return {title:correct?'纠正约场人 · '+b.name:'认领我的约场时段 · '+b.name,action:'bookingClaim',
  description:`${b.venue?b.venue+' · ':''}${label(b.start)}–${hm(b.end)}。请选择你实际预约并垫付的时间，认领会同步场费垫付归属，不会改变接龙和排场。${correct?'组织者可纠正已认领时段。':'别人已认领的时间不可覆盖；认领错了请联系组织者。'}`,
  values:{bookingId:b.id,start:dt(available),end:dt(end),expected:bookingClaimVersion(b),correct,playerId,reason:''},
  fields:[choice('start','我约的开始时间',cuts.slice(0,-1).map(t=>[dt(t),label(t)])),choice('end','我约的结束时间',cuts.slice(1).map(t=>[dt(t),label(t)])),...(correct?[choice('playerId','实际约场人',members)]:[])],
  convert:v=>({...v,start:epoch(v.start),end:epoch(v.end)}),
 };
}

/** Sets one segment back to 待认领 (lib/domain/booking-claims.ts, `release`). */
export function bookingReleaseForm(b:Booking,range:{start:number;end:number}):Form{
 return {title:'改回待认领 · '+b.name+' '+hm(range.start)+'–'+hm(range.end),action:'bookingClaim',
  description:'这段时间的约场人和认领记录会清除，重新显示为待认领，由实际约场的球友再认领。场费垫付归属随之清除；还有待认领的时间时不能确认费用分摊。',
  values:{bookingId:b.id,start:range.start,end:range.end,expected:bookingClaimVersion(b),release:true,reason:''},fields:[]};
}

/** 待认领: nobody has claimed the time yet. 组织者登记: the organiser named a booker who has not confirmed it. 已认领: the
 * member who booked it claimed it (or the organiser corrected the claim). */
type ClaimState='pending'|'registered'|'claimed';
type Segment={start:number;end:number;playerId?:string;state:ClaimState};
const stateLabel:Record<ClaimState,string>={pending:'待认领',registered:'组织者登记',claimed:'已认领'};
const hoursText=(h:number)=>(Number.isInteger(h)?h:h.toFixed(1))+' 小时';

/** One court's booking timeline, shown open: each segment's colour is its claim state; claiming opens a dialog. */
export default function BookingClaims({b,e,ctx}:{b:Booking;e:Event;ctx:Pick<SchedulingContext,'data'|'busy'|'open'|'name'|'readOnly'>}){
 const [chosen,setChosen]=useState<Segment|null>(null);
 const {data}=ctx,manager=canManageEvent(data.me,e),me=data.players.find(p=>p.id===data.me.playerId),settled=data.settlements.some(s=>s.eventId===e.id&&s.confirmed);
 if(e.deletedAt!==undefined||e.status==='cancelled'||ctx.readOnly)return null;
 const show=(form:Form)=>{setChosen(null);ctx.open(form.title,form.action,form.values,form.fields,form.convert,form.description)};
 const launch=(correct=false,range?:{start:number;end:number})=>show(bookingClaimForm(b,data.me.playerId,correct,data.players.filter(p=>p.enabled&&!p.guest).map(p=>[p.id,p.name]),range));
 const canClaim=!ctx.busy&&!!me?.enabled&&!me.guest&&!(e.status==='draft'&&!manager);
 const cuts=[...new Set([b.start,b.end,...bookingParts(b).map(p=>p.start),...(b.claims??[]).flatMap(c=>[c.start,c.end])])].filter(t=>t>=b.start&&t<=b.end).sort((a,b)=>a-b);
 const parts=bookingParts(b),claims=b.claims??[];
 // Neighbouring pieces with the same booker and state are one segment of the timeline.
 const segments:Segment[]=[];
 for(let i=0;i+1<cuts.length;i++){
  const from=cuts[i],to=cuts[i+1],playerId=parts.find(p=>p.start<=from&&p.end>from)?.advancedBy;
  const state:ClaimState=!playerId?'pending':claims.some(c=>c.start<=from&&c.end>=to)?'claimed':'registered',last=segments.at(-1);
  if(last&&last.state===state&&last.playerId===playerId)last.end=to;else segments.push({start:from,end:to,playerId,state});
 }
 const pendingHours=segments.filter(x=>x.state==='pending').reduce((n,x)=>n+(x.end-x.start)/3600000,0);
 const who=(x:Segment)=>x.playerId?ctx.name(x.playerId):'待认领';
 return <div className="booking-claims">
  <div className="booking-claims-head"><strong>约场认领</strong><span className={pendingHours?'is-pending':'is-done'}>{pendingHours?`还有 ${hoursText(pendingHours)}待认领`:segments.every(x=>x.state==='claimed')?'已全部认领':'已全部登记'}</span></div>
  <ol className="booking-claims-line" aria-label={b.name+' 约场认领时间线'}>{segments.map(x=><li key={x.start} className={'is-'+x.state} style={{flexGrow:x.end-x.start}}><button type="button" title={`${hm(x.start)}–${hm(x.end)} ${who(x)} · ${stateLabel[x.state]}`} aria-label={`${hm(x.start)}到${hm(x.end)}，${who(x)}，${stateLabel[x.state]}，查看详情`} onClick={()=>setChosen(x)}><small>{hm(x.start)}–{hm(x.end)}</small><b>{who(x)}</b></button></li>)}</ol>
  <p className="booking-claims-tip">点时间段可查看详情、认领或改回待认领。</p>
  <ul className="booking-claims-legend" aria-label="颜色说明">{(['pending','registered','claimed'] as const).map(state=><li key={state} className={'is-'+state}>{stateLabel[state]}</li>)}</ul>
  {settled?<p className="hint">费用已确认；如需纠正，请联系组织者从费用页调整并重新确认分摊。</p>:<div className="actions"><button type="button" className="secondary" disabled={ctx.busy||!me?.enabled||!!me.guest||e.status==='draft'&&!manager} onClick={()=>launch()}>认领我约的时间</button>{manager&&<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>launch(true)}>纠正约场人</button>}</div>}
  {chosen&&<SegmentDetails b={b} venue={b.venue??e.venue} x={chosen} who={who(chosen)} claimedAt={claims.find(c=>c.start<=chosen.start&&c.end>=chosen.end)?.at} mine={chosen.playerId===data.me.playerId} manager={manager} settled={settled} canClaim={canClaim} busy={ctx.busy} close={()=>setChosen(null)}
   claim={()=>launch(false,chosen)} correct={()=>launch(true,chosen)} release={()=>show(bookingReleaseForm(b,chosen))}/>}
 </div>;
}

/** What one timeline segment is and what this viewer may do with it. Members claim time nobody else has claimed and may
 * set their own time back to 待认领; the event creator, owner and admins may correct or release any segment. */
function SegmentDetails({b,venue,x,who,claimedAt,mine,manager,settled,canClaim,busy,close,claim,correct,release}:{b:Booking;venue?:string;x:Segment;who:string;claimedAt?:number;mine:boolean;manager:boolean;settled:boolean;canClaim:boolean;busy:boolean;close:()=>void;claim:()=>void;correct:()=>void;release:()=>void}){
 const hours=(x.end-x.start)/3600000,otherClaim=x.state==='claimed'&&!mine;
 return <Dialog open onOpenChange={next=>{if(!next)close()}}><DialogContent className="app-dialog booking-claim-details" showCloseButton>
  <DialogHeader><DialogTitle>{b.name} · {hm(x.start)}–{hm(x.end)}</DialogTitle><DialogDescription>{fmt(x.start,{month:'numeric',day:'numeric'})} · {hoursText(hours)}{venue?' · '+venue:''}</DialogDescription></DialogHeader>
  <dl className="booking-claim-facts"><div><dt>约场人</dt><dd>{who}</dd></div><div><dt>状态</dt><dd><span className={'booking-claim-state is-'+x.state}>{stateLabel[x.state]}</span></dd></div>{claimedAt!==undefined&&<div><dt>认领时间</dt><dd>{fmt(claimedAt,{month:'numeric',day:'numeric'})} {hm(claimedAt)}</dd></div>}</dl>
  {settled?<p className="hint">费用已确认；如需纠正，请联系组织者从费用页调整并重新确认分摊。</p>:<div className="actions">
   {!mine&&!otherClaim&&<button type="button" className="primary" disabled={!canClaim||busy} onClick={claim}>这段是我约的</button>}
   {manager&&<button type="button" className="secondary" disabled={busy} onClick={correct}>纠正约场人</button>}
   {x.state!=='pending'&&(manager||mine)&&<button type="button" className="ghost danger" disabled={busy} onClick={release}>改回待认领</button>}
  </div>}
  {!settled&&otherClaim&&!manager&&<p className="hint">这段已由{who}认领；认领错了请联系组织者纠正。</p>}
 </DialogContent></Dialog>;
}
