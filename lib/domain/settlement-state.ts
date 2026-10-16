import type {Settlement} from './types';

type Snapshot=Pick<Settlement,'eventId'|'bills'|'detail'|'total'|'subsidy'|'unallocated'|'expenseTotal'|'roundingDifference'|'transfers'|'collector'>;
/** Versions and audit notes do not change the financial result. Object/row
 * ordering from persistence must not make a confirmed snapshot look unsaved. */
export function sameSettlement(a:Snapshot,b:Snapshot){
 const facts=(s:Snapshot)=>JSON.stringify({
  eventId:s.eventId,total:s.total,expenseTotal:s.expenseTotal??s.total,roundingDifference:s.roundingDifference??0,subsidy:s.subsidy,unallocated:s.unallocated,
  bills:s.bills.map(x=>({playerId:x.playerId,court:x.court,ball:x.ball,other:x.other,total:x.total,minutes:x.minutes})).sort((a,b)=>a.playerId.localeCompare(b.playerId)),
  // Who transfers to whom is part of the result: filling in an advancer or a member collector needs a new version.
  transfers:s.transfers?[...s.transfers].map(t=>t.from+'>'+t.to+':'+t.cents).sort():null,collector:s.collector??null,
  detail:s.detail.map(x=>JSON.stringify({name:x.name,start:x.start,end:x.end,cents:x.cents,shares:Object.entries(x.shares).sort(([a],[b])=>a.localeCompare(b)),subsidy:x.subsidy,unallocated:x.unallocated,estimated:x.estimated})).sort(),
 });
 return facts(a)===facts(b);
}

export function settlementView(draft:Snapshot|undefined,versions:Settlement[],manager:boolean){
 const latest=versions.filter(v=>v.confirmed).sort((a,b)=>b.version-a.version)[0];
 const confirmed=!!(latest&&draft&&sameSettlement(draft,latest));
 return {latest,confirmed,changed:!!(latest&&draft&&!confirmed),shown:manager?(confirmed?latest:draft):latest};
}
