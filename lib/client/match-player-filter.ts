import type {ClubData} from '../contracts/club';
import type {Match,Event} from '../domain/types';

export function matchIncludesPlayer(match:Pick<Match,'a'|'b'>,playerId:string){
 return !playerId||match.a.includes(playerId)||match.b.includes(playerId);
}
/** Include past players and activity guests even after their signup is cancelled. */
export function eventMatchPlayerIds(data:Pick<ClubData,'matches'|'registrations'>,event:Event){
 return [...new Set([
  ...data.registrations.filter(r=>r.eventId===event.id&&r.status!=='cancelled').slice().sort((a,b)=>a.sequence-b.sequence).map(r=>r.playerId),
  ...data.matches.filter(m=>m.eventId===event.id).flatMap(m=>[...m.a,...m.b]),
  ...(event.tournament?.teams.flatMap(team=>team.players)??[]),
 ])];
}
