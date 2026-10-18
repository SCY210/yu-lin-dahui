import {madridDateTime,madridEpoch} from '../lib/time-planning';

/** One part of a court slot booked by members in turn (docs/FEE_ADVANCES.md): it starts at `start` and runs until the
 * next part, or the end of the slot. The first part always starts with the slot. Form values use Madrid wall times. */
export type CourtPart={start:string;advancedBy:string};
/** One booked court of a new activity. `advancedBy` booked (and pays) the first part; each handover starts the part
 * booked by the next member. */
export type CourtRow={name:string;start:string;end:string;advancedBy:string;handovers?:{at:string;advancedBy:string}[]};
const halfHour=1800000;
export const partEpoch=(v:string)=>{try{return madridEpoch(v)}catch{return NaN}};
export const rowParts=(row:Pick<CourtRow,'start'|'advancedBy'|'handovers'>):CourtPart[]=>[{start:row.start,advancedBy:row.advancedBy},...(row.handovers??[]).map(h=>({start:h.at,advancedBy:h.advancedBy}))];
export const fromParts=(parts:CourtPart[]):Pick<CourtRow,'advancedBy'|'handovers'>=>({advancedBy:parts[0]?.advancedBy??'',handovers:parts.slice(1).map(p=>({at:p.start,advancedBy:p.advancedBy}))});
/** The parts that still fit a slot from `start` to `end`: later parts must start inside it, in time order. */
export function fitParts(start:string,end:string,parts:CourtPart[]):CourtPart[]{
 const from=partEpoch(start),to=partEpoch(end),first=parts[0]??{start,advancedBy:''};
 const later=parts.slice(1).filter((p,i,list)=>{const at=partEpoch(p.start);return at>from&&at<to&&(i===0||at>partEpoch(list[i-1].start))});
 return [{...first,start},...later];
}
/** The half hour nearest the middle of a part, or null when it is shorter than an hour. */
export function partMiddle(start:string,end:string){const a=partEpoch(start),b=partEpoch(end);if(!(b-a>=2*halfHour))return null;return madridDateTime(a+Math.round((b-a)/2/halfHour)*halfHour)}
