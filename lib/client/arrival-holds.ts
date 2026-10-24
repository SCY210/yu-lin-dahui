import type {Event} from '../domain/types';

/** A player held out of scheduling until they confirm they have arrived: reported late (`pointsLate`, resumed with
 * `pointsPresence` arrived) or marked as a no-show (`noShow`, resumed with `noShowArrived`). */
export type ArrivalHold={eventId:string;playerId:string;kind:'late'|'noShow'};
type HoldEvent=Pick<Event,'id'|'status'|'start'|'end'|'deletedAt'|'tournament'|'matchFormat'|'pointsSession'|'noShowHold'>;

/** Holds of one running activity, oldest report first. */
export function arrivalHolds(e:HoldEvent,now:number):ArrivalHold[]{
 if(e.deletedAt!==undefined||e.tournament||e.matchFormat==='practice'||['draft','ended','cancelled'].includes(e.status)||now<e.start||now>=e.end)return [];
 const late=(e.pointsSession?.attendance??[]).filter(row=>row.late&&!row.available).sort((a,b)=>a.at-b.at).map(row=>({eventId:e.id,playerId:row.playerId,kind:'late' as const}));
 const absent=(e.noShowHold??[]).filter(id=>!late.some(h=>h.playerId===id)).map(playerId=>({eventId:e.id,playerId,kind:'noShow' as const}));
 return [...late,...absent];
}
/** Holds this member can lift on the home page: their own and those of friends they registered. */
export function myArrivalHolds(events:HoldEvent[],players:{id:string;ownerId:string}[],me:{id:string;playerId:string},now:number){
 const own=(id:string)=>id===me.playerId||players.find(p=>p.id===id)?.ownerId===me.id;
 return events.flatMap(e=>arrivalHolds(e,now)).filter(h=>own(h.playerId));
}
/** The command that lifts a hold. */
export function arrivalCommand(h:ArrivalHold){
 return h.kind==='late'?{action:'pointsPresence',payload:{eventId:h.eventId,playerId:h.playerId,status:'arrived'}}:{action:'noShowArrived',payload:{eventId:h.eventId,playerId:h.playerId}};
}
