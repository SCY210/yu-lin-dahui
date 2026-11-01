import type {Settlement} from './types';

type Snapshot=Pick<Settlement,'eventId'|'bills'|'detail'|'total'|'subsidy'|'unallocated'|'expenseTotal'|'roundingDifference'|'transfers'|'collector'>;
/** Versions and audit notes do not change the financial result. Object/row
 * ordering from persistence must not make a confirmed snapshot look unsaved. */
export function sameSettlement(a:Snapshot,b:Snapshot){
 const facts=(s:Snapshot)=>JSON.stringify({
  eventId:s.eventId,total:s.total,expenseTotal:s.expenseTotal??s.total,roundingDifference:s.roundingDifference??0,subsidy:s.subsidy,unallocated:s.unallocated,
  bills:s.bills.map(x=>({playerId:x.playerId,court:x.court,ball:x.ball,other:x.other,total:x.total,minutes:x.minutes})).sort((a,b)=>a.playerId.localeCompare(b.playerId)),
  // Whether it is paid by transfers, and to which collector, is part of the result; the transfers themselves are
  // compared below.
  transfers:!!s.transfers,collector:s.collector??null,
  detail:s.detail.map(x=>JSON.stringify({name:x.name,start:x.start,end:x.end,cents:x.cents,shares:Object.entries(x.shares).sort(([a],[b])=>a.localeCompare(b)),subsidy:x.subsidy,unallocated:x.unallocated,estimated:x.estimated})).sort(),
 });
 return facts(a)===facts(b)&&sameTransfers(a.transfers,b.transfers);
}
/** Cents of rounding a recalculation may move between people without making a confirmed version look changed. */
export const transferRoundingTolerance=20;
/** The same transfers, up to rounding: every person's net (received minus paid) within a few cents. Filling in or
 * changing an advancer moves at least that item's cost, far more than this. A confirmed version therefore keeps its
 * amounts and paid marks when only the rounding of advances changes (docs/FEE_ADVANCES.md), and the organiser is not
 * asked to confirm every older activity again. */
function sameTransfers(a:Snapshot['transfers'],b:Snapshot['transfers']){
 if(!a||!b)return !a&&!b;
 const net=(rows:NonNullable<Snapshot['transfers']>)=>{const m=new Map<string,number>();for(const t of rows){m.set(t.to,(m.get(t.to)??0)+t.cents);m.set(t.from,(m.get(t.from)??0)-t.cents)}return m};
 const x=net(a),y=net(b);
 return [...new Set([...x.keys(),...y.keys()])].every(id=>Math.abs((x.get(id)??0)-(y.get(id)??0))<=transferRoundingTolerance);
}

export function settlementView(draft:Snapshot|undefined,versions:Settlement[],manager:boolean){
 const latest=versions.filter(v=>v.confirmed).sort((a,b)=>b.version-a.version)[0];
 const confirmed=!!(latest&&draft&&sameSettlement(draft,latest));
 return {latest,confirmed,changed:!!(latest&&draft&&!confirmed),shown:manager?(confirmed?latest:draft):latest};
}
