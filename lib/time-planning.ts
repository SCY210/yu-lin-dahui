export const HALF_HOUR=30*60*1000;
export const halfHourTimes=Array.from({length:48},(_,i)=>`${String(Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`);
export const isHalfHourTime=(time:string)=>/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(time);
export const madridDateTime=(t:number)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(t).replace(' ','T');
export function madridEpoch(v:string){const target=Date.parse(v+'Z');if(!Number.isFinite(target))throw new Error('时间无效');let t=target;for(let i=0;i<3;i++)t-=Date.parse(madridDateTime(t)+'Z')-target;if(madridDateTime(t)!==v)throw new Error('该时间在马德里夏令时切换期间不存在');return t}
export function ceilHalfHour(t:number){if(!Number.isFinite(t))throw new Error('时间无效');return Math.ceil(t/HALF_HOUR)*HALF_HOUR}
export function plannedEpoch(value:string,original:number){return madridDateTime(original)===value?original:madridEpoch(value)}

// New planned intervals stay inside an existing activity. Short legacy intervals
// with no two half-hour boundaries retain their exact original endpoints.
export function plannedInterval(start:number,end:number){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('参加时间无效');
 const roundedStart=ceilHalfHour(start),roundedEnd=Math.floor(end/HALF_HOUR)*HALF_HOUR;
 return roundedEnd>roundedStart?{start:roundedStart,end:roundedEnd}:{start,end};
}

// A date edit is a new planned time. Keep the chosen calendar day and select the
// next available half-hour slot; an unchanged legacy value remains untouched.
export function plannedDateChange(value:string,date:string){
 const time=value.split('T')[1]??'';
 if(!date)return `T${time}`;
 const next=isHalfHourTime(time)?time:halfHourTimes.find(t=>t>=time)??'23:30';
 return `${date}T${next}`;
}

// Creation follows the selected start while preserving the duration and each
// chosen cutoff's distance from it. Invalid intermediate date edits stay editable.
export function shiftActivityTimes(values:Record<string,any>,updates:Record<string,unknown>,lastValidStart?:string){
 const next={...values,...updates};
 if(typeof updates.start!=='string'||updates.start===values.start)return next;
 let previousStart:number,newStart:number;
 try{newStart=madridEpoch(updates.start)}catch{return next}
 try{previousStart=madridEpoch(values.start)}catch{
  try{previousStart=madridEpoch(lastValidStart??'')}catch{return next}
 }
 for(const key of ['end','signupDeadline','cancelDeadline']){
  if(key in updates)continue;
  try{next[key]=madridDateTime(madridEpoch(values[key])+newStart-previousStart)}catch{/* Preserve incomplete input. */}
 }
 return next;
}
