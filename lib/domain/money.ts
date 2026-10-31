import {equalFeeAmounts} from './equal-fees';
import {attendanceForEvent,usesAutomaticAttendance} from './attendance';
import {courtSpans} from './booking-signups';
import {feeAdvances,planTransfers} from './fee-transfers';
import {clubOwnerId} from './ownership';
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
 if(e.tournament)return entryFeeSettlement(s,e);
 // Every lookup below reads only this activity's rows. Narrowing them once keeps the organiser's fee previews of all
 // activities linear in the club's history instead of rescanning every activity's rows per player and segment.
 const own=<T extends {eventId:string}>(rows:T[])=>rows.filter(row=>row.eventId===e.id);
 s={...s,registrations:own(s.registrations),attendance:own(s.attendance),bookings:own(s.bookings),costs:own(s.costs)};
 const spans=attendanceForEvent(s,e).map(a=>({...a,end:Math.min(a.end??Math.min(now,e.end),e.end,...(usesAutomaticAttendance(e)?[now]:[])),start:Math.max(a.start,e.start)})).filter(a=>a.end>a.start);
 const ids=[...new Set(spans.map(a=>a.playerId))].sort(); const minutes=(id:string)=>spans.filter(a=>a.playerId===id).reduce((t,a)=>t+(a.end-a.start)/60000,0);
 const bills=ids.map(playerId=>({playerId,court:0,ball:0,other:0,total:0,minutes:minutes(playerId)}));
 const detail:Settlement['detail']=[];let total=0,subsidy=0,unallocated=0;
 const points=[e.start,e.end,...spans.flatMap(a=>[a.start,a.end]),...s.bookings.filter(b=>b.eventId===e.id).flatMap(b=>[b.start,b.end,...(b.handovers??[]).map(h=>h.at)])];
 for(const c of s.costs.filter(c=>c.eventId===e.id)){if(c.start!==null&&c.end!==null)points.push(c.start,c.end);for(const o of c.overrides??[])points.push(o.start,o.end)}
 for(const b of s.bookings.filter(b=>b.eventId===e.id))for(const a of courtSpans(s,e,b))points.push(a.start,Math.min(a.end,now));
 const cuts=[...new Set(points)].filter(t=>t>=e.start&&t<=e.end).sort((a,b)=>a-b);
 const active=(a:number,b:number)=>ids.filter(id=>spans.some(x=>x.playerId===id&&x.start<b&&x.end>a));
 const distribute=(name:string,type:'court'|'ball'|'other',amount:number,start:number,end:number,mode:Mode,estimated:boolean,bearer='members',bookingId:string|undefined,item:string)=>{
  const scoped=usesAutomaticAttendance(e)&&(s.registrations.some(r=>r.eventId===e.id&&r.bookingSignups)||s.attendance.some(a=>a.eventId===e.id&&a.bookingId));
  const booking=bookingId&&scoped?s.bookings.find(b=>b.id===bookingId):undefined;
  // A court's fee is shared by everyone taking part while it is booked, whichever court they signed up for, so
  // courts that filled unevenly at the same time still give everyone the same share. A booking only limits the time window.
  const scopeIds=ids.filter(id=>spans.some(a=>a.playerId===id&&a.start<end&&a.end>start));
  const scopedActive=(a:number,b:number)=>scopeIds.filter(id=>spans.some(x=>x.playerId===id&&x.start<b&&x.end>a));
  const scopedMinutes=(id:string)=>{const rows=spans.filter(a=>a.playerId===id).map(a=>[Math.max(a.start,start),Math.min(a.end,end)]).filter(a=>a[1]>a[0]).sort((a,b)=>a[0]-b[0]);let total=0,last=-Infinity;for(const [a,b]of rows){total+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b)}return total};
  total+=amount;const segmentWeights:Record<string,number>={};const intervals:{key:string;start:number;end:number;members:string[]}[]=[];
  if(mode==='interval'){for(let i=0;i<cuts.length-1;i++){const a=Math.max(cuts[i],start),b=Math.min(cuts[i+1],end);if(b>a){const members=scopedActive(a,b);const key=String(i);segmentWeights[key]=b-a;intervals.push({key,start:a,end:b,members})}}}
  else{intervals.push({key:'all',start,end,members:booking?scopeIds:ids});segmentWeights.all=1}
  const amounts=allocate(amount,segmentWeights); if(!intervals.length){unallocated+=amount;detail.push({item,name,type,start,end,cents:amount,shares:{},subsidy:0,unallocated:amount,estimated});return}
  for(const seg of intervals){const cents=amounts[seg.key]??0;const weights:Record<string,number>={};const ex=(id:string):Exemption=>{const r=s.registrations.find(r=>r.eventId===e.id&&r.playerId===id);return type==='court'?r?.courtExempt??{mode:'none',reason:''}:type==='ball'?r?.ballExempt??{mode:'none',reason:''}:{mode:'none',reason:''}};
   for(const id of seg.members){if(ex(id).mode==='redistribute')continue;const w=mode==='duration'?(booking?scopedMinutes(id):Math.round(minutes(id)*60000)):1;const key=ex(id).mode==='subsidy'?'@subsidy':id;weights[key]=(weights[key]??0)+w}
   const shares=bearer==='subsidy'?{'@subsidy':cents}:allocate(cents,weights);const sub=shares['@subsidy']??0;delete shares['@subsidy'];const missing=cents-sub-Object.values(shares).reduce((a,b)=>a+b,0);subsidy+=sub;unallocated+=missing;
   for(const [id,n]of Object.entries(shares)){const bill=bills.find(b=>b.playerId===id)!;bill[type]+=n;bill.total+=n}
   detail.push({item,name,type,start:seg.start,end:seg.end,cents,shares,subsidy:sub,unallocated:missing,estimated});
  }
 };
 for(const b of s.bookings.filter(b=>b.eventId===e.id))distribute(b.name,'court',bookingCents(b),b.start,b.end,e.courtMode,false,b.bearer??'members',b.id,b.id);
 for(const c of s.costs.filter(c=>c.eventId===e.id)){const amount=c.type==='ball'?ballCents(c):c.cents;if(c.overrides?.length){if(c.overrides.reduce((a,x)=>a+x.cents,0)!==amount)fail('球费时段调整合计必须等于总球费');for(const o of c.overrides)distribute(c.name,c.type==='ball'?'ball':'other',o.cents,o.start,o.end,e.ballMode,false,c.bearer,undefined,c.id)}
  else if(c.start!==null&&c.end!==null)distribute(c.name,c.type==='ball'?'ball':'other',amount,c.start,c.end,c.type==='ball'?e.ballMode:'equal',false,c.bearer,undefined,c.id);
  else if(c.type==='ball'&&e.ballMode==='interval'){const weights:Record<string,number>={};const segs:{key:string;start:number;end:number}[]=[];for(let i=0;i<cuts.length-1;i++){const a=cuts[i],b=cuts[i+1];const courts=s.bookings.filter(x=>x.eventId===e.id&&x.start<=a&&x.end>=b).length;if(active(a,b).length&&courts){weights[String(i)]=(b-a)*courts;segs.push({key:String(i),start:a,end:b})}}const parts=allocate(amount,weights);if(!segs.length)distribute(c.name,'ball',amount,e.start,e.end,e.ballMode,true,c.bearer,undefined,c.id);else for(const seg of segs)distribute(c.name,'ball',parts[seg.key],seg.start,seg.end,e.ballMode,true,c.bearer,undefined,c.id)}
  else distribute(c.name,c.type==='ball'?'ball':'other',amount,e.start,e.end,c.type==='ball'?e.ballMode:'equal',c.type==='ball',c.bearer,undefined,c.id);
 }
 if(bills.reduce((a,b)=>a+b.total,0)+subsidy+unallocated!==total)fail('对账失败');
 return withFeeTransfers(s,e,equalFeeAmounts(s,e,now,{eventId:e.id,bills,detail,total,subsidy,unallocated},allocate));
}
/** What a competition costs (docs/TOURNAMENTS.md): its courts, its shuttles and other expenses, and the prizes for
 * the top three. The entry fee is that total divided by the confirmed entrants, rounded up to a whole euro. */
export function competitionCosts(s:Pick<State,'bookings'|'costs'|'registrations'>,e:Event){
 const courts=s.bookings.filter(b=>b.eventId===e.id).reduce((n,b)=>n+bookingCents(b),0);
 const shuttles=s.costs.filter(c=>c.eventId===e.id).reduce((n,c)=>n+(c.type==='ball'?ballCents(c):c.cents),0);
 const p=e.tournament?.prizes,prizes=p?p.first+p.second+p.third:0,total=courts+shuttles+prizes;
 const entrants=[...new Set(s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed').map(r=>r.playerId))].sort();
 const fee=entrants.length?Math.ceil(total/entrants.length/100)*100:0;
 return {courts,shuttles,prizes,total,entrants,fee};
}
/** A competition is paid by a compulsory entry fee, never split: every confirmed entrant owes the same fee. What the
 * rounding up collects above the costs is recorded as roundingDifference. A new confirmation is a new version. */
function entryFeeSettlement(s:State,e:Event){
 const c=competitionCosts(s,e),total=c.fee*c.entrants.length,line=(item:string,name:string,cents:number)=>({item,name,type:'other' as const,start:e.start,end:e.end,cents,shares:{},subsidy:0,unallocated:0,estimated:false});
 return {eventId:e.id,bills:c.entrants.map(playerId=>({playerId,court:0,ball:0,other:c.fee,total:c.fee,minutes:0})),detail:[line('courts','场地费',c.courts),line('shuttles','球费',c.shuttles),line('prizes','冠亚季奖品',c.prizes)],total,subsidy:0,unallocated:0,expenseTotal:c.total,roundingDifference:total-c.total};
}
/** When every court slot and expense records who advanced it, the split also says who transfers what to whom
 * (lib/domain/fee-transfers.ts). The collector is the activity's fee recipient when that is a member. */
function withFeeTransfers<T extends Pick<Settlement,'bills'|'detail'|'subsidy'|'unallocated'>>(s:State,e:Event,result:T):T&Pick<Settlement,'advances'|'transfers'|'collector'>{
 const items=[...s.bookings.filter(b=>b.eventId===e.id),...s.costs.filter(c=>c.eventId===e.id)];
 const advances=feeAdvances(items,result.detail,result.unallocated);if(!advances)return result;
 const owner=s.accounts.find(a=>a.id===clubOwnerId(s))?.playerId??null,recipient=e.feeRecipient?.playerId;
 const collector=recipient&&s.accounts.some(a=>a.playerId===recipient)?recipient:undefined;
 // A friend registered by a member owes through that member, so transfers only run between members.
 const payer=(id:string)=>{if(s.accounts.some(a=>a.playerId===id))return id;const host=s.accounts.find(a=>a.id===s.players.find(p=>p.id===id)?.ownerId);return host&&s.players.some(p=>p.id===host.playerId&&p.enabled)?host.playerId:id};
 const owed=result.bills.map(b=>({playerId:payer(b.playerId),total:b.total}));
 const transfers=planTransfers(owed,advances,result.subsidy,owner,collector);if(!transfers)return result;
 return {...result,advances,transfers,...(collector?{collector}:{})};
}


/** Estimates use complete automatic signup spans; actual accounting still clips participation to now. */
export function isPlannedFeeEstimate(e:Event,now:number){return usesAutomaticAttendance(e)&&now<e.end&&!['ended','cancelled'].includes(e.status)}
export function calculateSettlementPreview(s:State,e:Event,now:number){
 return calculateSettlement(s,e,isPlannedFeeEstimate(e,now)?e.end:now);
}
