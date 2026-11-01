import {bookingParts} from './booking-advancers';
import type {Handover,Payment,Settlement} from './types';

/** Fee advances (docs/FEE_ADVANCES.md). Members book courts and buy balls themselves, so a confirmed split is settled
 * by transfers between members instead of everyone paying one recipient: each person's net is what they advanced minus
 * their own share, and the owner also owes the club-subsidised part. This module is shared by the server and the app. */
/** cents: what the advancer is repaid; paid: what they actually paid (their receipts), before per-person rounding. */
export type Advance={playerId:string;cents:number;paid?:number};
export type Transfer={from:string;to:string;cents:number};
type Line=Settlement['detail'][number];
/** Payment method of a marked transfer; its `to` names the receiver. */
export const transferPayment='transfer';

type AdvanceItem={id:string;advancedBy?:string;start?:number|null;end?:number|null;handovers?:Handover[]};
/** Rounds exact amounts to whole cents that add up to `total`: floors first, then the largest remainders get the cents
 * left, earlier parts on ties. */
function roundParts(exact:number[],total:number){
 const parts=exact.map(x=>Math.floor(x+1e-9));let left=total-parts.reduce((a,b)=>a+b,0);
 for(const [,i] of exact.map((x,i)=>[x-parts[i],i]).sort((a,b)=>b[0]-a[0]||a[1]-b[1])){if(left<=0)break;parts[i]++;left--}
 return parts;
}
/** What each advancer is repaid (docs/FEE_ADVANCES.md): what they actually paid, the cost of every court slot, court
 * part or expense they advanced, so the fees page shows the amounts on their receipts. Shares are rounded per person,
 * so what members owe for one item can be a few cents off its cost (6.90 among 8 is 0.8625 each); summing those shares
 * per item showed 13.84/6.88/6.88 instead of 13.80/6.90/6.90. The few cents that per-person rounding collects above or
 * below the costs in total go to the advancers in proportion to what they paid, so the totals still balance exactly.
 * A court booked in turn repays each booker the cost of the time they booked (lib/domain/booking-advancers.ts). Null
 * while anything is still unallocated or an item with a cost has no advancer, so such a split is paid the old way. */
export function feeAdvances(items:AdvanceItem[],detail:Line[],unallocated:number):Advance[]|null{
 if(unallocated)return null;
 const repaid=new Map<string,{total:number;parts:{advancedBy?:string;exact:number}[]}>();
 let collected=0,cost=0;
 for(const line of detail){
  if(!line.item)return null;
  const item=items.find(x=>x.id===line.item);
  collected+=Object.values(line.shares).reduce((sum,c)=>sum+c,0)+line.subsidy;cost+=line.cents;
  const booked=!!item?.handovers?.length&&typeof item.start==='number'&&typeof item.end==='number';
  const parts=booked?bookingParts({...item!,start:item!.start!,end:item!.end!}):[{start:line.start,end:line.end,advancedBy:item?.advancedBy}];
  const key=booked?line.item:line.item+'#'+repaid.size;
  const row=repaid.get(key)??{total:0,parts:parts.map(p=>({advancedBy:p.advancedBy,exact:0}))};
  const weights=parts.map(p=>Math.max(0,Math.min(p.end,line.end)-Math.max(p.start,line.start))),sum=weights.reduce((a,b)=>a+b,0);
  row.total+=line.cents;
  parts.forEach((_,i)=>{row.parts[i].exact+=parts.length>1&&sum?line.cents*weights[i]/sum:i?0:line.cents});
  repaid.set(key,row);
 }
 const by=new Map<string,number>();let orphan=false;
 for(const {total,parts} of repaid.values())roundParts(parts.map(p=>p.exact),total).forEach((cents,i)=>{
  if(!cents)return;
  const advancedBy=parts[i].advancedBy;if(!advancedBy){orphan=true;return}
  by.set(advancedBy,(by.get(advancedBy)??0)+cents);
 });
 if(orphan)return null;
 const advancers=[...by.keys()].sort(),paid=advancers.map(id=>by.get(id)!),spent=paid.reduce((a,b)=>a+b,0),extra=collected-cost;
 if(extra&&spent){
  const sign=Math.sign(extra);
  roundParts(paid.map(c=>Math.abs(extra)*c/spent),Math.abs(extra)).forEach((cents,i)=>by.set(advancers[i],paid[i]+sign*cents));
 }
 const actual=new Map(advancers.map((id,i)=>[id,paid[i]]));
 return [...by].map(([playerId,cents])=>({playerId,cents,...(cents!==actual.get(playerId)?{paid:actual.get(playerId)}:{})})).sort((a,b)=>a.playerId.localeCompare(b.playerId));
}

/** Who transfers how much to whom. With a collector, everyone who owes pays the collector and the collector repays every
 * advancer. Without one, debts are matched to advancers largest first, so there are at most n-1 transfers. */
export function planTransfers(bills:{playerId:string;total:number}[],advances:Advance[],subsidy:number,ownerPlayerId:string|null,collector?:string):Transfer[]|null{
 const net=new Map<string,number>(),change=(id:string,cents:number)=>net.set(id,(net.get(id)??0)+cents);
 for(const b of bills)change(b.playerId,-b.total);
 for(const a of advances)change(a.playerId,a.cents);
 if(subsidy){if(!ownerPlayerId)return null;change(ownerPlayerId,-subsidy)}
 if([...net.values()].reduce((sum,cents)=>sum+cents,0)!==0)return null;
 const transfers:Transfer[]=[];
 if(collector){
  for(const [id,cents] of [...net].sort(([a],[b])=>a.localeCompare(b))){
   if(id===collector||!cents)continue;
   transfers.push(cents<0?{from:id,to:collector,cents:-cents}:{from:collector,to:id,cents});
  }
  return transfers;
 }
 const order=(rows:[string,number][])=>rows.sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 const debtors=order([...net].filter(([,c])=>c<0).map(([id,c])=>[id,-c])),creditors=order([...net].filter(([,c])=>c>0));
 let i=0,j=0;
 while(i<debtors.length&&j<creditors.length){
  const cents=Math.min(debtors[i][1],creditors[j][1]);
  transfers.push({from:debtors[i][0],to:creditors[j][0],cents});
  debtors[i][1]-=cents;creditors[j][1]-=cents;
  if(!debtors[i][1])i++;
  if(!creditors[j][1])j++;
 }
 return transfers;
}

type Paid=Pick<Payment,'eventId'|'playerId'|'cents'>&{to?:string};
/** Marked amounts of one payer-to-receiver pair. Later confirmed versions keep counting them, as bills do. */
export function transferPaidCents(payments:Paid[],eventId:string,from:string,to:string){
 return payments.filter(p=>p.eventId===eventId&&p.playerId===from&&p.to===to).reduce((sum,p)=>sum+p.cents,0);
}
export function transferPaid(payments:Paid[],eventId:string,t:Transfer){return transferPaidCents(payments,eventId,t.from,t.to)>=t.cents}
/** Whether a player owes nothing more on this confirmed version: every transfer they make is marked, or, for a split
 * paid the old way, their recorded payments cover the bill. Advancers whose advance covers their share owe nothing. */
/** For the collector of a version settled by transfers: the cents still to pass on to advancers (0 once every repayment
 * is marked). Null for anyone else, or a collector with nothing to repay: their status is the usual paid/unpaid one.
 * The collector keeps their own share out of what they collect, so this is all they still owe (docs/FEE_ADVANCES.md). */
export function collectorRepayment(payments:Paid[],settlement:Pick<Settlement,'eventId'|'transfers'|'collector'>,playerId:string){
 if(!settlement.transfers||settlement.collector!==playerId)return null;
 const repayments=settlement.transfers.filter(t=>t.from===playerId);if(!repayments.length)return null;
 return repayments.reduce((left,t)=>left+Math.max(0,t.cents-transferPaidCents(payments,settlement.eventId,t.from,t.to)),0);
}
export function playerSettled(payments:Paid[],settlement:Pick<Settlement,'eventId'|'transfers'|'bills'>,playerId:string){
 if(settlement.transfers)return settlement.transfers.every(t=>t.from!==playerId||transferPaid(payments,settlement.eventId,t));
 const bill=settlement.bills.find(b=>b.playerId===playerId);
 return !bill||bill.total<=0||payments.filter(p=>p.eventId===settlement.eventId&&p.playerId===playerId&&!p.to).reduce((sum,p)=>sum+p.cents,0)>=bill.total;
}
/** The transfers of this version that are still to be made. */
export function openTransfers(payments:Paid[],settlement:Pick<Settlement,'eventId'|'transfers'>){
 return (settlement.transfers??[]).filter(t=>!transferPaid(payments,settlement.eventId,t));
}
/** [playerId, name] of members who can advance fees or collect them: enabled players who are not friends. */
export function feeMembers(players:{id:string;name:string;enabled?:boolean;guest?:boolean;guestEventId?:string}[]){
 return players.filter(p=>p.enabled!==false&&!p.guest&&!p.guestEventId).map(p=>[p.id,p.name]).sort((a,b)=>a[1].localeCompare(b[1],'zh-CN'));
}
