import type {Event,State} from './types';

/** A voluntary, event-scoped matching choice, independent of attendance and penalties. */
export const matchingStopped=(e:Pick<Event,'matchingStopped'>,playerId:string)=>!!e.matchingStopped?.includes(playerId);

/** Keep published lineups intact for review, but never start them with an opted-out player. */
export function stoppedPendingMatches(s:Pick<State,'matches'>,e:Event){
 return s.matches.filter(m=>m.eventId===e.id&&['draft','published'].includes(m.status)&&m.start===null&&[...m.a,...m.b].some(id=>matchingStopped(e,id)));
}
