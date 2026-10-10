import type {Event,Match} from './types';
export type MatchFormat='singles'|'doubles'|'practice';
/** Legacy activities were created by the doubles scheduler. */
export const eventFormat=(e:Pick<Event,'matchFormat'>):MatchFormat=>e.matchFormat??'doubles';
export const isPractice=(e:Pick<Event,'matchFormat'>)=>eventFormat(e)==='practice';
export const teamSize=(e:Pick<Event,'matchFormat'>)=>isPractice(e)?0:eventFormat(e)==='singles'?1:2;
export const courtPlayers=(e:Pick<Event,'matchFormat'>)=>teamSize(e)*2;
export const formatLabel=(format:MatchFormat)=>format==='practice'?'练球':format==='singles'?'单打':'双打';
export function automaticEventTitle(start:number,format:MatchFormat){
 const parts=new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',month:'numeric',day:'numeric'}).formatToParts(start);
 const date=parts.find(p=>p.type==='month')!.value+'月'+parts.find(p=>p.type==='day')!.value+'日';
 return date+' · '+formatLabel(format);
}
export const validTeams=(m:Pick<Match,'a'|'b'>)=>[1,2].includes(m.a.length)&&m.a.length===m.b.length&&new Set([...m.a,...m.b]).size===m.a.length+m.b.length;
