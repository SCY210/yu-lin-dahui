import {eventStatusAt} from './event-lifecycle';
import type {Match,State} from './types';

const unplayed=(m:Match)=>['published','draft'].includes(m.status)&&m.start===null&&!m.games.length&&m.scoreA===null&&m.scoreB===null;
/** Once an activity has ended (or was closed early), the published planned games that never started and have no score
 * are deleted, with any round left empty (docs/MATCH_GROUPING.md). Games that started stay so their score can still be
 * entered, and overtime rounds added after the end (lib/domain/points-plan.ts) start later on purpose. Live play has
 * no published games. Runs on every maintenance read, so it is one pass over the matches and changes nothing twice.
 * Returns the deleted match IDs. */
export function deleteUnplayedPlanned(s:State,now:number):string[]{
 const ended=new Set(s.events.filter(e=>e.deletedAt===undefined&&!e.tournament&&eventStatusAt(e,now)==='ended').map(e=>e.id));
 if(!ended.size)return [];
 const rounds=new Map(s.rounds.map(r=>[r.id,r]));
 const doomed=s.matches.filter(m=>{
  if(!ended.has(m.eventId)||!unplayed(m))return false;
  const r=rounds.get(m.roundId);
  return !!r&&!r.live&&!r.overtime&&r.status==='published';
 });
 if(!doomed.length)return [];
 const gone=new Set(doomed.map(m=>m.id)),touched=new Set(doomed.map(m=>m.roundId));
 s.matches=s.matches.filter(m=>!gone.has(m.id));
 const left=new Set(s.matches.filter(m=>touched.has(m.roundId)).map(m=>m.roundId));
 s.rounds=s.rounds.filter(r=>!touched.has(r.id)||left.has(r.id));
 return [...gone];
}
