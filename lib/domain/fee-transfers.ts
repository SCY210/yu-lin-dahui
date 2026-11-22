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
 * advancer. Without one, see `settleDirect`: advancers owed money only receive, members who owe transfer once where
 * possible, and no transfer is below `minTransfer` when that can be avoided. */
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
 return settleDirect(net);
}

/** The smallest transfer a split without a collector asks for (2026-11-22, the club owner): 0.50 euro. */
export const minTransfer=50;
type Plan={transfers:Transfer[];cost:number[]};
/** Transfers without a collector (docs/FEE_ADVANCES.md). The club owner asked (2026-11-22) that no transfer be below
 * 0.50 euro and that each member transfer only once where possible, but never at the cost of an advancer transferring:
 * an advancer whose advance covers their share only receives. So each member who owes pays one advancer, and only
 * when the amounts do not fit does a member split their payment between advancers. Who pays whom is searched for, in
 * this order: fewest transfers below 0.50, fewest extra transfers by members who split their payment, fewest members
 * who pass on someone else's money (only to avoid a tiny transfer: someone who owes 0.30 collects another member's
 * payment and passes it on with their 0.30), fewest transfers, then the least money moved. An advancer owed less than
 * 0.50 in total is necessarily paid in one small transfer. The search is deterministic, so the server and the app
 * agree. */
function settleDirect(net:Map<string,number>):Transfer[]{
 const by=(a:{id:string;cents:number},b:{id:string;cents:number})=>b.cents-a.cents||a.id.localeCompare(b.id);
 const debtors=[...net].filter(([,c])=>c<0).map(([id,c])=>({id,cents:-c})).sort(by);
 const creditors=[...net].filter(([,c])=>c>0).map(([id,c])=>({id,cents:c})).sort(by);
 if(!debtors.length||!creditors.length)return [];
 const k=creditors.length,d=debtors.length;
 // parent[i]: whom debtor i pays; below k an advancer, from k on another debtor who passes it on.
 const plan=(parent:number[]):Plan|null=>{
  const carried=debtors.map(x=>x.cents),received=creditors.map(()=>0);
  for(let i=0;i<d;i++){
   let at=parent[i],steps=0;
   while(at>=k){if(at-k===i||++steps>d)return null;carried[at-k]+=debtors[i].cents;at=parent[at-k]}
   received[at]+=debtors[i].cents;
  }
  // pay[i]: what debtor i sends to each receiver. An advancer paid too much has the excess redirected by the members
  // paying them, largest payment first, to the advancers paid too little: those members split their payment.
  const pay=debtors.map((_,i)=>new Map<number,number>([[parent[i],carried[i]]]));
  const under=creditors.map((x,c)=>({c,cents:x.cents-received[c]})).filter(x=>x.cents>0);
  for(let c=0;c<k;c++){
   let excess=received[c]-creditors[c].cents;
   const payers=debtors.map((_,i)=>i).filter(i=>parent[i]===c).sort((x,y)=>carried[y]-carried[x]||x-y);
   for(const i of payers){
    while(excess>0&&(pay[i].get(c)??0)>0){
     const u=under.find(x=>x.cents>0)!,cents=Math.min(excess,u.cents,pay[i].get(c)!);
     pay[i].set(c,pay[i].get(c)!-cents);pay[i].set(u.c,(pay[i].get(u.c)??0)+cents);
     excess-=cents;u.cents-=cents;
    }
    if(!excess)break;
   }
  }
  const transfers:Transfer[]=[];
  debtors.forEach((x,i)=>{for(const [to,cents] of pay[i])if(cents>0)transfers.push({from:x.id,to:to<k?creditors[to].id:debtors[to-k].id,cents})});
  const relays=new Set(parent.filter(p=>p>=k)).size,extra=transfers.length-new Set(transfers.map(t=>t.from)).size;
  return {transfers,cost:[transfers.filter(t=>t.cents<minTransfer).length,extra,relays,transfers.length,transfers.reduce((n,t)=>n+t.cents,0)]};
 };
 const better=(a:Plan,b:Plan)=>{for(let i=0;i<a.cost.length;i++)if(a.cost[i]!==b.cost[i])return a.cost[i]<b.cost[i];return false};
 // Start from filling the advancer with the most still to receive, largest debt first, then improve one move at a
 // time: pay someone else, or swap whom two members pay.
 const start=(order:number[])=>{
  const parent=new Array<number>(d).fill(0),need=creditors.map(x=>x.cents);
  for(const i of order){let c=0;for(let j=1;j<k;j++)if(need[j]>need[c])c=j;parent[i]=c;need[c]-=debtors[i].cents}
  return parent;
 };
 const improve=(parent:number[])=>{
  let best=plan(parent)!;
  for(let pass=0;pass<200;pass++){
   const moves:number[][]=[];
   for(let i=0;i<d;i++)for(let t=0;t<k+d;t++)if(t!==parent[i]&&t!==k+i){const next=[...parent];next[i]=t;moves.push(next)}
   for(let i=0;i<d;i++)for(let j=i+1;j<d;j++)if(parent[i]!==parent[j]){const next=[...parent];next[i]=parent[j];next[j]=parent[i];moves.push(next)}
   let found:{parent:number[];plan:Plan}|null=null;
   for(const next of moves){const p=plan(next);if(p&&better(p,found?.plan??best))found={parent:next,plan:p}}
   if(!found)break;
   parent=found.parent;best=found.plan;
  }
  return best;
 };
 const ids=debtors.map((_,i)=>i),plans=[improve(start(ids)),improve(start([...ids].reverse()))];
 return (better(plans[1],plans[0])?plans[1]:plans[0]).transfers;
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
