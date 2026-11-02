import {bountyEvent,bountyOffer,bountyOfferAt,bountyTitles} from './domain/bounties';
import type {Reminder} from './reminder-contract';
import type {State} from './domain/types';


/** Bounty notices (docs/BOUNTIES.md): once an offer opens, 30 minutes before a points match, each member offered a
 * bounty is told once, in the app and on their devices. Only until the start, so a late tick sends nothing. One id per
 * activity and member: a repeated tick or a second device never adds another. */
export function bountyReminders(s:State,now:number):Reminder[]{
 return s.events.filter(e=>bountyEvent(e)&&bountyOfferAt(e)<=now&&now<e.start).flatMap(e=>s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed').flatMap(r=>{
  const offer=bountyOffer(s,e,r.playerId,now),account=s.accounts.find(a=>a.playerId===r.playerId);
  if(!offer||!account)return [];
  return [{id:`bounty:${e.id}:${r.playerId}`,kind:'bounty' as const,eventId:e.id,title:'羽林大会',tab:'overview' as const,accountIds:[account.id],expires:e.end,createdAt:now,playerId:r.playerId,
   body:bountyTitles[offer.kind]}];
 }));
}
