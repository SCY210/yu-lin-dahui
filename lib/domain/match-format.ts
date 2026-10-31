import type {Event,Match} from './types';
export type MatchFormat='singles'|'doubles'|'practice';
/** Legacy activities were created by the doubles scheduler. */
export const eventFormat=(e:Pick<Event,'matchFormat'>):MatchFormat=>e.matchFormat??'doubles';
export const isPractice=(e:Pick<Event,'matchFormat'>)=>eventFormat(e)==='practice';
export const teamSize=(e:Pick<Event,'matchFormat'>)=>isPractice(e)?0:eventFormat(e)==='singles'?1:2;
export const courtPlayers=(e:Pick<Event,'matchFormat'>)=>teamSize(e)*2;
export const formatLabel=(format:MatchFormat)=>format==='practice'?'练球':format==='singles'?'单打':'双打';
/** The automatic title: the date and the format, or for a competition its category and 比赛 (10月31日 · 混双比赛). */
export function automaticEventTitle(start:number,format:MatchFormat,competition?:string){
 const parts=new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',month:'numeric',day:'numeric'}).formatToParts(start);
 const date=parts.find(p=>p.type==='month')!.value+'月'+parts.find(p=>p.type==='day')!.value+'日';
 return date+' · '+(competition?competition+'比赛':formatLabel(format));
}
export const validTeams=(m:Pick<Match,'a'|'b'>)=>[1,2].includes(m.a.length)&&m.a.length===m.b.length&&new Set([...m.a,...m.b]).size===m.a.length+m.b.length;
