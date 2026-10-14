import type {State} from './domain/types';
import {month} from './domain/types';
import {awardVotingClosesAt} from './domain/activity-voting';
import {inactivityDeadline,realmLedger} from './domain/realm-rating';
import {replayRating} from './domain/ranking';
import {nextQuarterStart} from './ranking-quarter';

/** Most of a club view (修为 ledger, ranking boards, history statistics) is computed from the full history and
 * is the same for every viewer. Within one Worker isolate it is computed once per stored revision and reused by
 * every member's request until the next moment those results could change on the clock, or `maxAge` at most.
 * Only the read route opts in, keyed by the revision it loaded from storage; viewer-specific parts (draft
 * visibility, permissions, fees) are always computed per request. A cold isolate simply computes again. */
const maxAge=15000,limit=8;
const entries=new Map<string,{from:number;expires:number;value:unknown}>();

/** The earliest future time at which a history-only result could change without a write. */
export function sharedViewValidUntil(s:Pick<State,'events'|'matches'|'attendance'>,now:number){
 let expires=now+maxAge;
 const boundary=(at:number|null|undefined)=>{if(typeof at==='number'&&Number.isFinite(at)&&at>now&&at<expires)expires=at};
 const current=month(now),[year,mon]=current.split('-').map(Number);
 boundary(nextQuarterStart(current));
 boundary(Date.UTC(mon===12?year+1:year,mon===12?0:mon,1)-2*3600000);
 for(const e of s.events){boundary(e.start);boundary(e.end);boundary(e.signupDeadline);boundary(e.cancelDeadline);boundary(awardVotingClosesAt(e))}
 for(const m of s.matches){boundary(m.start);boundary(m.end);if(m.end!==null&&Number.isFinite(m.end))boundary(inactivityDeadline(m.end))}
 for(const a of s.attendance){boundary(a.start);boundary(a.end)}
 return expires;
}

export function sharedClubValue<T>(key:string,now:number,validUntil:()=>number,compute:()=>T):T{
 const hit=entries.get(key);
 if(hit&&hit.from<=now&&now<hit.expires)return hit.value as T;
 const value=compute();
 entries.delete(key);entries.set(key,{from:now,expires:validUntil(),value});
 while(entries.size>limit)entries.delete(entries.keys().next().value!);
 return value;
}

/** The 修为 ledger of an unchanged stored revision (the maintenance coin reconciliation). */
export function sharedRealmLedger(s:State,now:number){return sharedClubValue('coin-ledger|'+s.revision,now,()=>sharedViewValidUntil(s,now),()=>realmLedger(s,now))}

/** Same effect as mergeStrengthRating once the migration marker is set (it returns null): the clock-driven 修为
 * refresh of every player and the rating change list, computed once per revision and validity window. */
export function refreshStrength(state:State,now:number){
 const result=sharedClubValue('strength|'+state.revision,now,()=>sharedViewValidUntil(state,now),()=>{replayRating(state,now);return {players:new Map(state.players.map(p=>[p.id,{rating:p.rating,ratedGames:p.ratedGames}])),changes:state.ratingChanges.map(change=>({...change}))}});
 for(const p of state.players){const r=result.players.get(p.id);if(r){p.rating=r.rating;p.ratedGames=r.ratedGames}}
 state.ratingChanges=result.changes.map(change=>({...change}));
 return null;
}

/** Test hook: forget every shared result. */
export function clearSharedClubValues(){entries.clear()}
