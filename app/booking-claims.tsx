'use client';
import {useRef,useState,type PointerEvent} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {advancerAt,bookingParts} from '../lib/domain/booking-advancers';
import {bookingClaimVersion} from '../lib/domain/booking-claims';
import {canManageEvent} from '../lib/domain/permissions';
import type {Booking,Event} from '../lib/domain/types';
import type {SchedulingContext} from './event-scheduling';
import AppSelect from './app-select';
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

/** One court's booking timeline, shown open: each segment's colour is its claim state (docs/BOOKING_CLAIMS.md). Tapping
 * 待认领 time opens the claim dialog with a draggable time bar; tapping booked time shows who booked it and what this
 * viewer may do. */
export default function BookingClaims({b,e,ctx}:{b:Booking;e:Event;ctx:Pick<SchedulingContext,'data'|'busy'|'open'|'send'|'name'|'readOnly'>}){
 const [chosen,setChosen]=useState<Segment|null>(null),[claiming,setClaiming]=useState<{start:number;end:number;correct:boolean;playerId?:string}|null>(null);
 const {data}=ctx,manager=canManageEvent(data.me,e),me=data.players.find(p=>p.id===data.me.playerId),settled=data.settlements.some(s=>s.eventId===e.id&&s.confirmed);
 if(e.deletedAt!==undefined||e.status==='cancelled'||ctx.readOnly)return null;
 const members=data.players.filter(p=>p.enabled&&!p.guest).map(p=>[p.id,p.name]);
 const canClaim=!ctx.busy&&!!me?.enabled&&!me.guest&&!(e.status==='draft'&&!manager);
 // A new claim starts on the tapped time, at most the usual two hours of one booking.
 const claim=(x:{start:number;end:number},correct=false,playerId?:string)=>{setChosen(null);setClaiming({start:x.start,end:Math.min(x.end,x.start+2*3600000),correct,playerId})};
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
 const claimable=(x:Segment)=>x.state==='pending'&&!settled&&canClaim;
 return <div className="booking-claims">
  <div className="booking-claims-head"><strong>约场认领</strong><span className={pendingHours?'is-pending':'is-done'}>{pendingHours?`还有 ${hoursText(pendingHours)}待认领`:segments.every(x=>x.state==='claimed')?'已全部认领':'已全部登记'}</span></div>
  <ol className="booking-claims-line" aria-label={b.name+' 约场认领时间线'}>{segments.map(x=><li key={x.start} className={'is-'+x.state} style={{flexGrow:x.end-x.start}}><button type="button" title={`${hm(x.start)}–${hm(x.end)} ${who(x)} · ${stateLabel[x.state]}`} aria-label={`${hm(x.start)}到${hm(x.end)}，${x.playerId?who(x)+'，':''}${stateLabel[x.state]}，${claimable(x)?'点按认领':'查看详情'}`} onClick={()=>claimable(x)?claim(x):setChosen(x)}><small>{hm(x.start)}–{hm(x.end)}</small><b>{claimable(x)?'点此认领':who(x)}</b></button></li>)}</ol>
  {chosen&&<SegmentDetails b={b} venue={b.venue??e.venue} x={chosen} who={who(chosen)} claimedAt={claims.find(c=>c.start<=chosen.start&&c.end>=chosen.end)?.at} mine={chosen.playerId===data.me.playerId} manager={manager} settled={settled} canClaim={canClaim} busy={ctx.busy} close={()=>setChosen(null)}
   claim={()=>claim(chosen)} correct={()=>claim(chosen,true,chosen.playerId)} release={()=>{setChosen(null);const form=bookingReleaseForm(b,chosen);ctx.open(form.title,form.action,form.values,form.fields,form.convert,form.description)}}/>}
  {claiming&&<ClaimRange b={b} initial={claiming} correct={claiming.correct} me={data.me.playerId} initialPlayer={claiming.playerId??data.me.playerId} members={members} manager={manager} busy={ctx.busy} name={ctx.name} close={()=>setClaiming(null)}
   submit={(start,end,playerId)=>{const correct=claiming.correct||playerId!==data.me.playerId;setClaiming(null);ctx.send('bookingClaim',{bookingId:b.id,start,end,expected:bookingClaimVersion(b),correct,...(correct?{playerId}:{}),reason:''})}}/>}
 </div>;
}

const halfHour=1800000;
/** The claim dialog: the court's whole booking as one bar, the chosen time on it between two grips, and the chosen time
 * in large type above the bar. Dragging anywhere on the bar moves the nearest end by half hours; a tap moves it there.
 * A claim lasts at least an hour (or the whole booking, if shorter). Time another member claimed is hatched and cannot
 * be taken; organisers may choose another booker, which corrects the claim. */
function ClaimRange({b,initial,correct,me,initialPlayer,members,manager,busy,name,close,submit}:{b:Booking;initial:{start:number;end:number};correct:boolean;me:string;initialPlayer:string;members:string[][];manager:boolean;busy:boolean;name:(id:string)=>string;close:()=>void;submit:(start:number,end:number,playerId:string)=>void}){
 const cuts=[b.start];for(let t=b.start+halfHour;t<b.end;t+=halfHour)cuts.push(t);cuts.push(b.end);
 const last=cuts.length-1,index=(t:number)=>cuts.reduce((best,c,i)=>Math.abs(c-t)<Math.abs(cuts[best]-t)?i:best,0);
 const minSteps=b.end-b.start<3600000?last:cuts.findIndex(c=>c-b.start>=3600000);
 const [range,setRange]=useState<[number,number]>(()=>{const a=Math.min(index(initial.start),last-minSteps);return [a,Math.max(index(initial.end),a+minSteps)]});
 const [playerId,setPlayerId]=useState(initialPlayer);
 const start=cuts[range[0]],end=cuts[range[1]],span=b.end-b.start,pct=(t:number)=>(t-b.start)/span*100;
 const correcting=correct||playerId!==me,taken=(b.claims??[]).filter(c=>c.playerId!==playerId);
 const clash=!correcting&&taken.some(c=>c.start<end&&c.end>start);
 const setEdge=(edge:0|1,i:number)=>setRange(([a,z])=>edge===0?[Math.max(0,Math.min(i,z-minSteps)),z]:[a,Math.min(last,Math.max(i,a+minSteps))]);
 const track=useRef<HTMLDivElement>(null),drag=useRef<{edge:0|1;x:number;moved:boolean}|null>(null);
 const at=(x:number)=>{const r=track.current?.getBoundingClientRect();return r&&r.width?index(b.start+(x-r.left)/r.width*span):range[0]};
 const nearest=(i:number):0|1=>i<=range[0]?0:i>=range[1]?1:i-range[0]<=range[1]-i?0:1;
 const down=(ev:PointerEvent<HTMLDivElement>)=>{drag.current={edge:nearest(at(ev.clientX)),x:ev.clientX,moved:false};ev.currentTarget.setPointerCapture?.(ev.pointerId)};
 const move=(ev:PointerEvent<HTMLDivElement>)=>{const d=drag.current;if(!d)return;if(!d.moved&&Math.abs(ev.clientX-d.x)<6)return;d.moved=true;ev.preventDefault();setEdge(d.edge,at(ev.clientX))};
 const up=(ev:PointerEvent<HTMLDivElement>)=>{const d=drag.current;drag.current=null;if(d&&!d.moved)setEdge(d.edge,at(ev.clientX))};
 const ticks=cuts.filter(t=>(t-b.start)%3600000===0);
 return <Dialog open onOpenChange={next=>{if(!next)close()}}><DialogContent className="app-dialog claim-range-dialog" showCloseButton>
  <DialogHeader><DialogTitle>{correct?'纠正约场人':'认领约场时间'} · {b.name}</DialogTitle><DialogDescription>{correct?'拖动两端选好时间，再选实际约场的球友。':'左右拖动两端，选出你实际约并垫付的时间。'}</DialogDescription></DialogHeader>
  <div className="claim-range-pick" aria-live="polite"><strong>{hm(start)}–{hm(end)}</strong><span>{hoursText((end-start)/3600000)}</span></div>
  <div ref={track} className="claim-range-track" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null}}>
   <div className="claim-range-bar" aria-hidden="true">
    {taken.map(c=>{const from=Math.max(b.start,c.start),to=Math.min(b.end,c.end);return <span key={c.start} className="claim-range-taken" style={{left:pct(from)+'%',width:(pct(to)-pct(from))+'%'}}><small>{name(c.playerId)}</small></span>})}
    <span className={'claim-range-chosen'+(clash?' is-clash':'')} style={{left:pct(start)+'%',width:(pct(end)-pct(start))+'%'}}/>
   </div>
   {[start,end].map((t,k)=><span key={k} className="claim-range-grip" aria-hidden="true" style={{left:pct(t)+'%'}}/>)}
   {/* Keyboard and screen-reader control of both ends; pointer input goes to the bar. */}
   {([0,1] as const).map(edge=><input key={edge} type="range" className="claim-range-handle" min={0} max={last} step={1} value={range[edge]} aria-label={edge?'结束时间':'开始时间'} aria-valuetext={hm(cuts[range[edge]])} onChange={ev=>setEdge(edge,Number(ev.target.value))}/>)}
  </div>
  <div className="claim-range-ticks" aria-hidden="true">{ticks.map(t=><span key={t} style={{left:pct(t)+'%'}}>{hm(t).slice(0,2)}</span>)}</div>
  {(correct||manager)&&<label className="claim-range-who"><span>约场人</span><AppSelect className="pick native-form-select" value={playerId} aria-label="约场人" onChange={ev=>setPlayerId(ev.target.value)}>{members.map(([id,n])=><option key={id} value={id}>{n}{id===me?'（我）':''}</option>)}</AppSelect></label>}
  {clash&&<p className="warning claim-range-clash">选中的时间里有别人已认领的部分，请避开；认领错了请联系组织者纠正。</p>}
  <div className="actions"><button type="button" className="primary" disabled={busy||clash||!playerId} onClick={()=>submit(start,end,playerId)}>{correcting?'保存约场人':'认领 '+hm(start)+'–'+hm(end)}</button></div>
 </DialogContent></Dialog>;
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
