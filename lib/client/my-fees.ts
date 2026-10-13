/** Client-side paid status, mirroring billPaid in lib/domain/fee-payments.ts on the projected data. */
export type FeeSplit={id:string;eventId:string;version:number;created:number;confirmed:boolean;bills:{playerId:string;total:number}[]};
export type FeePayment={eventId:string;playerId:string;cents:number};
type FeePlayer={id:string;ownerId:string};

export function latestConfirmedSplits<T extends FeeSplit>(settlements:T[]){
 const latest=new Map<string,T>();
 for(const s of settlements)if(s.confirmed&&(!latest.has(s.eventId)||latest.get(s.eventId)!.version<s.version))latest.set(s.eventId,s);
 return latest;
}
export function feePaid(payments:FeePayment[],eventId:string,bill:{playerId:string;total:number}){
 return bill.total<=0||payments.filter(p=>p.eventId===eventId&&p.playerId===bill.playerId).reduce((n,p)=>n+p.cents,0)>=bill.total;
}
/** Unpaid bills of the latest confirmed versions that this member owes: their own and those of friends they registered. */
export function unpaidFeesFor(settlements:FeeSplit[],payments:FeePayment[],players:FeePlayer[],me:{id:string;playerId:string},visibleEventIds:Set<string>){
 const mine=new Set([me.playerId,...players.filter(p=>p.id!==me.playerId&&p.ownerId===me.id).map(p=>p.id)]);
 return [...latestConfirmedSplits(settlements).values()].filter(s=>visibleEventIds.has(s.eventId)).flatMap(s=>s.bills.filter(b=>mine.has(b.playerId)&&!feePaid(payments,s.eventId,b)).map(b=>({eventId:s.eventId,settlementId:s.id,playerId:b.playerId,total:b.total,friend:b.playerId!==me.playerId,created:s.created})))
  .sort((a,b)=>b.created-a.created);
}
