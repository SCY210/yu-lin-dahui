import {bountyOffer,type BountyOutcome,type BountyRecord,type BountySettings} from '../domain/bounties';
import type {Event,Match,Registration} from '../domain/types';

/** The club view's bounty data (lib/club-view.ts): own records with their result, and the current settings. */
export type ViewBounty=BountyRecord&{outcome?:BountyOutcome|null};
type BountyData={events:(Event&{bounties?:ViewBounty[]})[];registrations:Registration[];matches:Match[];players:{id:string;guest?:boolean;guestEventId?:string}[];accounts?:unknown[];
 settings:{bounty:BountySettings};me:{playerId:string}};

/** Offers this member can still answer, earliest activity first. */
export function pendingBountyOffers(data:BountyData,now:number){
 const s={registrations:data.registrations,matches:data.matches,players:data.players,accounts:data.accounts??[],settings:data.settings} as unknown as Parameters<typeof bountyOffer>[0];
 return data.events.map(e=>bountyOffer(s,e,data.me.playerId,now)).filter(o=>!!o).sort((a,b)=>data.events.find(e=>e.id===a.eventId)!.start-data.events.find(e=>e.id===b.eventId)!.start);
}
/** This member's accepted bounty for an activity, if any. */
export function myBounty(e:{bounties?:ViewBounty[]},playerId:string){return e.bounties?.find(b=>b.playerId===playerId&&b.status==='accepted')}
