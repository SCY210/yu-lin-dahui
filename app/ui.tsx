'use client';
import VenueField from './venue-field';
import HalfHourDateTime from './half-hour-date-time';
import PriceStepper from './price-stepper';
import {madridDateTime,madridEpoch,shiftActivityTimes} from '../lib/time-planning';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Checkbox} from '@/components/ui/checkbox';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
export const fmt=(t:number,opts:any={month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',...opts}).format(t);
export const hm=(t:number)=>fmt(t,{hour:'2-digit',minute:'2-digit'});
export const euro=(c:number)=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'EUR'}).format(c/100);
export const dt=madridDateTime;
export const epoch=madridEpoch;
export const labels:any={draft:'草稿',open:'报名中',locked:'报名锁定',live:'进行中',ended:'已结束',cancelled:'已取消',waitlist:'候补',confirmed:'正式',ready:'可上场',paused:'暂时休息',left:'已离场',published:'已发布',playing:'比赛中',complete:'已完成',forfeit:'弃权'};
export const modes=[['interval','按时段分摊'],['duration','按全程参加时长'],['equal','等额分摊']];
export type Field={key:string;label:string;type?:string;options?:string[][];optional?:boolean;step?:number|'any';min?:number;max?:number};
export type Form={activityStart?:string;title:string;description?:string;action:string;values:any;fields:Field[];convert?:(v:any)=>any};
export const text=(key:string,label:string):Field=>({key,label});
export const timed=(key:string,label:string,optional=false):Field=>({key,label,type:'datetime-local',optional});
export const halfTimed=(key:string,label:string,optional=false):Field=>({key,label,type:'half-hour',optional});
export const number=(key:string,label:string):Field=>({key,label,type:'number'});
export const money=(key:string,label:string):Field=>({key,label,type:'money'});
export const choice=(key:string,label:string,options:string[][]):Field=>({key,label,type:'select',options});
export const why:Field={key:'reason',label:'原因 / 备注'};
export function Pick({value,onChange,options}:any){return <Select value={value==null?'':String(value)} onValueChange={v=>{if(v&&options?.some(([id]:string[])=>id===v))onChange(v)}}><SelectTrigger className="pick"><SelectValue/></SelectTrigger><SelectContent position="popper" align="start" sideOffset={6} className="app-select-menu">{options.map(([v,l]:string[])=> <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>}
export function Forms({form,setForm,busy,action,danger,setDanger}:any){
 // Fields can emit multiple updates during one render (including native control
 // synchronization). Merge into the latest state instead of restoring old values.
 const updateValues=(values:Record<string,unknown>)=>setForm((current:Form|null)=>{
  if(!current)return current;
  if(current.action!=='event')return {...current,values:{...current.values,...values}};
  let activityStart=current.activityStart??current.values.start;
  const next=shiftActivityTimes(current.values,values,activityStart);
  try{madridEpoch(next.start);activityStart=next.start}catch{/* Keep the last valid start while the date is cleared. */}
  return {...current,values:next,activityStart};
 });
 return <><Dialog open={!!form} historyCloseBlocked={busy} onOpenChange={v=>{if(!v&&!busy)setForm(null)}}>
 <DialogContent className="app-dialog"><DialogHeader><DialogTitle>{form?.title}</DialogTitle><DialogDescription>{form?.description??'保存到群组共享记录。时间统一为马德里时间。'}</DialogDescription></DialogHeader>
 {form&&<form onSubmit={async ev=>{ev.preventDefault();try{await action(form.action,form.convert?form.convert(form.values):form.values)}catch{}}}>
 <div className="form-fields">{form.fields.map((f:Field)=><label key={f.key}>
 {f.type==='checkbox'?<span className="check-label"><Checkbox checked={form.values[f.key]} onCheckedChange={v=>updateValues({[f.key]:v===true})}/>{f.label}</span>:<><span>{f.label}</span>
 {f.type==='price-stepper'?<PriceStepper value={form.values[f.key]} label={f.label} step={typeof f.step==='number'?f.step:undefined} min={f.min} max={f.max} onChange={value=>updateValues({[f.key]:value})}/>:f.type==='half-hour'?<HalfHourDateTime value={form.values[f.key]??''} label={f.label} optional={f.optional} onChange={value=>updateValues({[f.key]:value})}/>:f.type==='venue'?<VenueField value={form.values[f.key]??''} address={form.values.address??''} onChange={(venue,address)=>updateValues({[f.key]:venue,address})}/>:f.type==='select'?<select className="pick native-form-select" value={form.values[f.key]??''} required={!f.optional} onChange={ev=>updateValues({[f.key]:ev.target.value})}>{!form.values[f.key]&&<option value="" disabled>请选择{f.label}</option>}{f.options?.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>:<input type={f.type==='money'?'number':f.type??'text'} required={!f.optional&&!['note','address'].includes(f.key)} step={f.type==='money'?'0.01':f.type==='number'?(f.step??1):undefined} min={f.min} max={f.max} value={f.type==='money'?(form.values[f.key]===''||form.values[f.key]==null?'':form.values[f.key]/100):form.values[f.key]??''} onChange={ev=>{const v=ev.target.value;updateValues({[f.key]:f.type==='money'?(v===''?'':Math.round(Number(v)*100)):f.type==='number'?(v===''?'':Number(v)):v})}}/>}
 </>}</label>)}</div><button className="primary full" type="submit" disabled={busy||form.fields.some((f:Field)=>f.type==='venue'&&!form.values[f.key])}>{busy?'正在保存…':'确认保存'}</button></form>}
 </DialogContent></Dialog><AlertDialog open={!!danger} onOpenChange={v=>{if(!v)setDanger(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{danger?.title}</AlertDialogTitle><AlertDialogDescription>{danger?.description}</AlertDialogDescription></AlertDialogHeader><label>操作原因<input value={danger?.reason??''} onChange={ev=>{const reason=ev.target.value;setDanger((current:any)=>current?{...current,reason}:current)}}/></label><AlertDialogFooter><AlertDialogCancel>返回</AlertDialogCancel><AlertDialogAction disabled={busy||!danger?.reason.trim()} onClick={()=>{void action(danger.action,{...danger.payload,reason:danger.reason}).catch(()=>{});setDanger(null)}}>{danger?.action==='deleteEvent'?'确认删除':danger?.action==='restoreEvent'?'确认恢复':'确认'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
