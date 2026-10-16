import type {Payment,Settlement} from './types';

/** Fee advances (docs/FEE_ADVANCES.md). Members book courts and buy balls themselves, so a confirmed split is settled
 * by transfers between members instead of everyone paying one recipient: each person's net is what they advanced minus
 * their own share, and the owner also owes the club-subsidised part. This module is shared by the server and the app. */
export type Advance={playerId:string;cents:number};
export type Transfer={from:string;to:string;cents:number};
type Line=Settlement['detail'][number];
/** Payment method of a marked transfer; its `to` names the receiver. */
export const transferPayment='transfer';

/** What each advancer is repaid: for every court slot or expense, the members' shares of its lines plus its subsidy.
 * Equal-share rounding therefore goes to the advancer and the totals balance exactly. Null while anything is still
 * unallocated or an item with a cost has no advancer, so such a split is paid the old way. */
export function feeAdvances(items:{id:string;advancedBy?:string}[],detail:Line[],unallocated:number):Advance[]|null{
 if(unallocated)return null;
 const repaid=new Map<string,number>();
 for(const line of detail){
  if(!line.item)return null;
  repaid.set(line.item,(repaid.get(line.item)??0)+Object.values(line.shares).reduce((sum,cents)=>sum+cents,0)+line.subsidy);
 }
 const by=new Map<string,number>();
 for(const [itemId,cents] of repaid){
  if(!cents)continue;
  const advancer=items.find(item=>item.id===itemId)?.advancedBy;if(!advancer)return null;
  by.set(advancer,(by.get(advancer)??0)+cents);
 }
 return [...by].map(([playerId,cents])=>({playerId,cents})).sort((a,b)=>a.playerId.localeCompare(b.playerId));
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
