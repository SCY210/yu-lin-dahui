import {equalFeeAmounts} from './equal-fees';
import {attendanceForEvent,usesAutomaticAttendance} from './attendance';
import {courtSpans} from './booking-signups';
import {fail,type State,type Event,type Settlement,type Mode,type Exemption} from './types';
type Q={n:bigint;d:bigint};
const q=(n:number|bigint,d:number|bigint=1):Q=>({n:BigInt(n),d:BigInt(d)});
const add=(a:Q,b:Q):Q=>({n:a.n*b.d+b.n*a.d,d:a.d*b.d});
const mul=(a:Q,b:Q):Q=>({n:a.n*b.n,d:a.d*b.d});
const zero=()=>q(0);
export function allocate(total:number,weights:Record<string,number>):Record<string,number>{return allocateQ(total,Object.fromEntries(Object.entries(weights).map(([k,v])=>[k,q(v)])))}
function allocateQ(total:number,weights:Record<string,Q>){const entries=Object.entries(weights).filter(([,v])=>v.n>BigInt(0));const sum=entries.reduce((a,[,v])=>add(a,v),zero());if(!sum.n)return {};const list=entries.map(([id,v])=>{const n=BigInt(total)*v.n*sum.d,d=v.d*sum.n;return {id,base:Number(n/d),n:n%d,d}});let left=total-list.reduce((a,v)=>a+v.base,0);list.sort((a,b)=>{const diff=a.n*b.d-b.n*a.d;return diff===BigInt(0)?a.id.localeCompare(b.id):diff>BigInt(0)?-1:1});for(const v of list){if(left-->0)v.base++}return Object.fromEntries(list.map(v=>[v.id,v.base]))}
// 新耗球记录只按单颗价格×消耗颗数（pricing=unit）。pricing=tube 仅用于读取旧记录：仍按原公式 每筒价×颗数÷每筒颗数、不足1分按半向上，历史金额不变。
export function ballCents(c:{pricing:string;cents:number;tubeCount:number;used:number}){return c.pricing==='tube'?Number((BigInt(c.cents)*BigInt(c.used)*BigInt(2)+BigInt(c.tubeCount))/(BigInt(c.tubeCount)*BigInt(2))):c.pricing==='unit'?c.cents*c.used:c.cents}
/** 旧按筒记录折合的单颗价格（欧分）；仅当每筒价能被每筒颗数整除、折算不改变任何金额时返回，否则为null。 */
export function legacyTubeUnitCents(c:{pricing:string;cents:number;tubeCount:number}){return c.pricing==='tube'&&c.tubeCount>0&&c.cents%c.tubeCount===0?c.cents/c.tubeCount:null}
export function bookingCents(b:{pricing:string;cents:number;start:number;end:number}){return b.pricing==='total'?b.cents:Math.round(b.cents*(b.end-b.start)/3600000)}
export function calculateSettlement(s:State,e:Event,now:number):Omit<Settlement,'id'|'version'|'created'|'reason'|'confirmed'>{
 const spans=attendanceForEvent(s,e).map(a=>({...a,end:Math.min(a.end??Math.min(now,e.end),e.end,...(usesAutomaticAttendance(e)?[now]:[])),start:Math.max(a.start,e.start)})).filter(a=>a.end>a.start);
 const ids=[...new Set(spans.map(a=>a.playerId))].sort(); const minutes=(id:string)=>spans.filter(a=>a.playerId===id).reduce((t,a)=>t+(a.end-a.start)/60000,0);
 const bills=ids.map(playerId=>({playerId,court:0,ball:0,other:0,total:0,minutes:minutes(playerId)}));
 const detail:Settlement['detail']=[];let total=0,subsidy=0,unallocated=0;
 const points=[e.start,e.end,...spans.flatMap(a=>[a.start,a.end]),...s.bookings.filter(b=>b.eventId===e.id).flatMap(b=>[b.start,b.end])];
 for(const c of s.costs.filter(c=>c.eventId===e.id)){if(c.start!==null&&c.end!==null)points.push(c.start,c.end);for(const o of c.overrides??[])points.push(o.start,o.end)}
 for(const b of s.bookings.filter(b=>b.eventId===e.id))for(const a of courtSpans(s,e,b))points.push(a.start,Math.min(a.end,now));
 const cuts=[...new Set(points)].filter(t=>t>=e.start&&t<=e.end).sort((a,b)=>a-b);
 const active=(a:number,b:number)=>ids.filter(id=>spans.some(x=>x.playerId===id&&x.start<b&&x.end>a));
 const distribute=(name:string,type:'court'|'ball'|'other',amount:number,start:number,end:number,mode:Mode,estimated:boolean,bearer='members',bookingId?:string)=>{
  const scoped=usesAutomaticAttendance(e)&&(s.registrations.some(r=>r.eventId===e.id&&r.bookingSignups)||s.attendance.some(a=>a.eventId===e.id&&a.bookingId));
  const booking=bookingId&&scoped?s.bookings.find(b=>b.id===bookingId):undefined;
  const scope=booking&&usesAutomaticAttendance(e)?courtSpans(s,e,booking).map(a=>({...a,end:Math.min(a.end,now)})).filter(a=>a.end>a.start):spans;
  const scopeIds=ids.filter(id=>scope.some(a=>a.playerId===id&&a.start<end&&a.end>start));
  const scopedActive=(a:number,b:number)=>scopeIds.filter(id=>scope.some(x=>x.playerId===id&&x.start<b&&x.end>a));
  const scopedMinutes=(id:string)=>{const rows=scope.filter(a=>a.playerId===id).map(a=>[Math.max(a.start,start),Math.min(a.end,end)]).filter(a=>a[1]>a[0]).sort((a,b)=>a[0]-b[0]);let total=0,last=-Infinity;for(const [a,b]of rows){total+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b)}return total};
  total+=amount;const segmentWeights:Record<string,number>={};const intervals:{key:string;start:number;end:number;members:string[]}[]=[];
  if(mode==='interval'){for(let i=0;i<cuts.length-1;i++){const a=Math.max(cuts[i],start),b=Math.min(cuts[i+1],end);if(b>a){const members=scopedActive(a,b);const key=String(i);segmentWeights[key]=b-a;intervals.push({key,start:a,end:b,members})}}}
  else{intervals.push({key:'all',start,end,members:booking?scopeIds:ids});segmentWeights.all=1}
  const amounts=allocate(amount,segmentWeights); if(!intervals.length){unallocated+=amount;detail.push({name,type,start,end,cents:amount,shares:{},subsidy:0,unallocated:amount,estimated});return}
  for(const seg of intervals){const cents=amounts[seg.key]??0;const weights:Record<string,number>={};const ex=(id:string):Exemption=>{const r=s.registrations.find(r=>r.eventId===e.id&&r.playerId===id);return type==='court'?r?.courtExempt??{mode:'none',reason:''}:type==='ball'?r?.ballExempt??{mode:'none',reason:''}:{mode:'none',reason:''}};
   for(const id of seg.members){if(ex(id).mode==='redistribute')continue;const w=mode==='duration'?(booking?scopedMinutes(id):Math.round(minutes(id)*60000)):1;const key=ex(id).mode==='subsidy'?'@subsidy':id;weights[key]=(weights[key]??0)+w}
   const shares=bearer==='subsidy'?{'@subsidy':cents}:allocate(cents,weights);const sub=shares['@subsidy']??0;delete shares['@subsidy'];const missing=cents-sub-Object.values(shares).reduce((a,b)=>a+b,0);subsidy+=sub;unallocated+=missing;
   for(const [id,n]of Object.entries(shares)){const bill=bills.find(b=>b.playerId===id)!;bill[type]+=n;bill.total+=n}
   detail.push({name,type,start:seg.start,end:seg.end,cents,shares,subsidy:sub,unallocated:missing,estimated});
  }
 };
 for(const b of s.bookings.filter(b=>b.eventId===e.id))distribute(b.name,'court',bookingCents(b),b.start,b.end,e.courtMode,false,b.bearer??'members',b.id);
 for(const c of s.costs.filter(c=>c.eventId===e.id)){const amount=c.type==='ball'?ballCents(c):c.cents;if(c.overrides?.length){if(c.overrides.reduce((a,x)=>a+x.cents,0)!==amount)fail('球费时段调整合计必须等于总球费');for(const o of c.overrides)distribute(c.name,c.type==='ball'?'ball':'other',o.cents,o.start,o.end,e.ballMode,false,c.bearer)}
  else if(c.start!==null&&c.end!==null)distribute(c.name,c.type==='ball'?'ball':'other',amount,c.start,c.end,c.type==='ball'?e.ballMode:'equal',false,c.bearer);
  else if(c.type==='ball'&&e.ballMode==='interval'){const weights:Record<string,number>={};const segs:{key:string;start:number;end:number}[]=[];for(let i=0;i<cuts.length-1;i++){const a=cuts[i],b=cuts[i+1];const courts=s.bookings.filter(x=>x.eventId===e.id&&x.start<=a&&x.end>=b).length;if(active(a,b).length&&courts){weights[String(i)]=(b-a)*courts;segs.push({key:String(i),start:a,end:b})}}const parts=allocate(amount,weights);if(!segs.length)distribute(c.name,'ball',amount,e.start,e.end,e.ballMode,true,c.bearer);else for(const seg of segs)distribute(c.name,'ball',parts[seg.key],seg.start,seg.end,e.ballMode,true,c.bearer)}
  else distribute(c.name,c.type==='ball'?'ball':'other',amount,e.start,e.end,c.type==='ball'?e.ballMode:'equal',c.type==='ball',c.bearer);
 }
 if(bills.reduce((a,b)=>a+b.total,0)+subsidy+unallocated!==total)fail('对账失败');return equalFeeAmounts(s,e,now,{eventId:e.id,bills,detail,total,subsidy,unallocated},allocate);
}

