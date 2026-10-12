import {isClubOwner} from './ownership';
import type {Account,Event,State} from './types';

export function canRecoverEvent(s:State,a:Pick<Account,'id'>,e:Pick<Event,'creatorId'>){
 return isClubOwner(s,a)||e.creatorId===a.id;
}

/** Keep deleted workspaces out of administrative exports and audit views too.
 * Persisted records and the historical scoring ledger are never changed. */
export function privateEventState(s:State,a:Account):State{
 if(!isClubOwner(s,a)){
  const receipts=s.accountNoticeReceipts??[],ownReceipts=receipts.filter(r=>r.accountId===a.id);
  if(ownReceipts.length!==receipts.length)s={...s,accountNoticeReceipts:ownReceipts};
  const treasureLedger=s.treasureLedger.filter(r=>r.playerId===a.playerId),treasureOrders=s.treasureOrders.filter(o=>o.playerId===a.playerId),treasureProducts=s.treasureProducts.filter(p=>p.active),audits=s.audits.filter(row=>{
   if(!row.action.startsWith('treasure'))return true;
   const changes=row.changes;return !!changes&&typeof changes==='object'&&'playerId' in changes&&changes.playerId===a.playerId;
  });
  if(treasureLedger.length!==s.treasureLedger.length||treasureOrders.length!==s.treasureOrders.length||treasureProducts.length!==s.treasureProducts.length||audits.length!==s.audits.length)
   s={...s,treasureLedger,treasureOrders,treasureProducts,audits};
 }
 const hidden=s.events.filter(e=>e.deletedAt!==undefined&&!canRecoverEvent(s,a,e));
 if(!hidden.length)return s;
 const copy=structuredClone(s),eventIds=new Set(hidden.map(e=>e.id)),references=new Set(eventIds);
 for(const key of ['bookings','registrations','attendance','rounds','matches','costs','settlements','payments','awardVotes'] as const){
  for(const row of copy[key])if(eventIds.has(row.eventId))references.add(row.id);
  (copy[key] as unknown[])=copy[key].filter(row=>!eventIds.has(row.eventId));
 }
 copy.events=copy.events.filter(e=>!eventIds.has(e.id));
 copy.photos=copy.photos.filter(p=>!p.eventId||!eventIds.has(p.eventId));
 copy.challenges=copy.challenges.filter(c=>!references.has(c.sourceMatchId)&&(!c.matchId||!references.has(c.matchId)));
 copy.ratingChanges=copy.ratingChanges.filter(r=>!references.has(r.matchId));
 const titles=hidden.map(e=>e.title).filter(Boolean);
 function containsPrivate(value:unknown):boolean{
  if(typeof value==='string')return references.has(value)||titles.some(title=>value.includes(title));
  if(Array.isArray(value))return value.some(containsPrivate);
  return !!value&&typeof value==='object'&&Object.values(value).some(containsPrivate);
 }
 copy.audits=copy.audits.filter(a=>!containsPrivate(a));
 return copy;
}
