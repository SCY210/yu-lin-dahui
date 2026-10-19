import {madridEpoch} from '../lib/time-planning';

/** One part of a court slot booked by members in turn (docs/FEE_ADVANCES.md): it starts at `start` and runs until the
 * next part, or the end of the slot. The first part always starts with the slot. Form values use Madrid wall times. */
export type CourtPart={start:string;advancedBy:string};
/** One booked court of a new activity. `advancedBy` booked (and pays) the first part; each handover starts the part
 * booked by the next member. */
export type CourtRow={name:string;start:string;end:string;advancedBy:string;handovers?:{at:string;advancedBy:string}[]};
export const partEpoch=(v:string)=>{try{return madridEpoch(v)}catch{return NaN}};
export const rowParts=(row:Pick<CourtRow,'start'|'advancedBy'|'handovers'>):CourtPart[]=>[{start:row.start,advancedBy:row.advancedBy},...(row.handovers??[]).map(h=>({start:h.at,advancedBy:h.advancedBy}))];
export const fromParts=(parts:CourtPart[]):Pick<CourtRow,'advancedBy'|'handovers'>=>({advancedBy:parts[0]?.advancedBy??'',handovers:parts.slice(1).map(p=>({at:p.start,advancedBy:p.advancedBy}))});
/** The parts that still fit a slot from `start` to `end`: later parts must start inside it, in time order. */
export function fitParts(start:string,end:string,parts:CourtPart[]):CourtPart[]{
 const from=partEpoch(start),to=partEpoch(end),first=parts[0]??{start,advancedBy:''};
 const later=parts.slice(1).filter((p,i,list)=>{const at=partEpoch(p.start);return at>from&&at<to&&(i===0||at>partEpoch(list[i-1].start))});
 return [{...first,start},...later];
}

/** Each part of a court booked in turn lasts at least one hour. Members usually book up to two hours, so a new split
 * prefers two-hour parts, but a longer part is allowed for the exceptions. Part boundaries sit on whole hours from the
 * court's start; only the last part can end on a half hour. Positions below are hours after the start: `bounds` lists
 * where parts 2, 3, … begin. */
export const minPartHours=1,usualPartHours=2;
/** Whether a split court's parts each last at least an hour; one booker for the whole court is always allowed. */
export function partsFit(start:string,end:string,parts:CourtPart[]){const from=partEpoch(start),list=fitParts(start,end,parts);return list.length<2||validBounds((partEpoch(end)-from)/3600000,list.slice(1).map(p=>(partEpoch(p.start)-from)/3600000))}
/** Every part of the court lasts at least an hour. */
export function validBounds(total:number,bounds:number[]){return [0,...bounds,total].every((b,i,all)=>i===0||b-all[i-1]>=minPartHours-1e-9)}
/** The numbers of parts (2 or more) a court of `total` hours can be split into. */
export function partCounts(total:number){const counts:number[]=[];for(let n=2;n*minPartHours<=total+1e-9;n++)counts.push(n);return counts}
/** Starting split into `n` parts: two-hour parts where the hours allow it (one hour each, the earliest growing to two
 * until the last one fits), otherwise whole hours shared as evenly as possible. */
export function evenBounds(total:number,n:number){
 const hours=Array.from({length:n-1},()=>minPartHours);
 if(n*usualPartHours>=total-1e-9)for(let i=0;i<hours.length&&total-hours.reduce((a,b)=>a+b,0)>usualPartHours+1e-9;i++)hours[i]=usualPartHours;
 else hours.fill(Math.max(minPartHours,Math.floor(total/n+1e-9)));
 return hours.map((_,i)=>hours.slice(0,i+1).reduce((a,b)=>a+b,0));
}
/** Moves boundary `k` to the whole hour nearest `value`, as far as both neighbouring parts still last an hour. */
export function moveBound(total:number,bounds:number[],k:number,value:number){
 const before=k?bounds[k-1]:0,after=k<bounds.length-1?bounds[k+1]:total;
 const low=Math.ceil(before+minPartHours-1e-9),high=Math.floor(after-minPartHours+1e-9);
 if(low>high)return bounds;
 return bounds.map((b,i)=>i===k?Math.min(high,Math.max(low,Math.round(value))):b);
}
