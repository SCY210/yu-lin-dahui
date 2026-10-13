import {madridDateTime,madridEpoch} from '../lib/time-planning';
export const fmt=(t:number,opts:any={month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',...opts}).format(t);
export const hm=(t:number)=>fmt(t,{hour:'2-digit',minute:'2-digit'});
export const euro=(c:number)=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'EUR'}).format(c/100);
export const dt=madridDateTime;
export const epoch=madridEpoch;
export const labels:any={draft:'草稿',open:'报名中',locked:'报名锁定',live:'进行中',ended:'已结束',cancelled:'已取消',waitlist:'候补',confirmed:'正式',ready:'可上场',paused:'暂时休息',left:'已离场',published:'已发布',playing:'比赛中',complete:'已完成',forfeit:'弃权'};
export const modes=[['interval','按时段分摊'],['duration','按全程参加时长'],['equal','等额分摊']];
export type Field={key:string;label:string;type?:string;options?:string[][];optional?:boolean;required?:boolean;when?:{key:string;value:string};requiredWhen?:{key:string;value:string};step?:number|'any';min?:number;max?:number};
export type Form={activityStart?:string;title:string;description?:string;action:string;values:any;fields:Field[];convert?:(v:any)=>any};
export const text=(key:string,label:string):Field=>({key,label});
export const timed=(key:string,label:string,optional=false):Field=>({key,label,type:'datetime-local',optional});
export const halfTimed=(key:string,label:string,optional=false):Field=>({key,label,type:'half-hour',optional});
export const number=(key:string,label:string):Field=>({key,label,type:'number'});
export const money=(key:string,label:string):Field=>({key,label,type:'money'});
export const choice=(key:string,label:string,options:string[][]):Field=>({key,label,type:'select',options});
export const why:Field={key:'reason',label:'原因 / 备注'};

/** Resolve visibility and conditional required fields without changing other forms. */
export function visibleFormFields(fields:Field[],values:Record<string,unknown>):Field[]{
 return fields.filter(f=>f.key!=='reason'&&(!f.when||values[f.when.key]===f.when.value)).map(f=>f.requiredWhen&&values[f.requiredWhen.key]===f.requiredWhen.value?{...f,optional:false,required:true}:f);
}
