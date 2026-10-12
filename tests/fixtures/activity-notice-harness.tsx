import {useState} from 'react';
import {Forms} from '../../app/ui';
import type {Form} from '../../app/form-fields';
import EventCourtSignup from '../../app/event-court-signup';
import {emptyState} from '../../lib/domain/types';
export {ActivityNoticeConfirmation} from '../../app/activity-notice';

export default function Preview({onAction}:{onAction:(action:string,payload:unknown)=>Promise<void>}){
 const [form,setForm]=useState<Form|null>(null),[start]=useState(()=>Math.ceil((Date.now()+86400000)/1800000)*1800000),s=emptyState();
 const me={id:'member',playerId:'self',email:'',role:'member' as const};
 const e={id:'event',creatorId:'organizer',title:'Fictional signup',start,end:start+7200000,venue:'Fictional venue',address:'',signupDeadline:start-7200000,cancelDeadline:start-86400000,capacity:8,status:'open' as const,note:'',courtMode:'interval' as const,ballMode:'interval' as const};
 s.accounts=[me];s.events=[e];s.players=['self','friend'].map(id=>({id,name:id==='self'?'本人':'系统朋友',ownerId:me.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 s.bookings=['one','two'].map((id,i)=>({id,eventId:e.id,name:`${i+1} 号场`,start,end:e.end,pricing:'total' as const,cents:1200,signupCapacity:8}));
 const data={...s,me},ctx={data,busy:false,name:(id:string)=>s.players.find(p=>p.id===id)?.name??id,openProfile(){},open:(title:string,action:string,values:unknown,fields:Form['fields'],convert?:Form['convert'],description?:string)=>setForm({title,action,values,fields,convert,description})};
 const action=async(action:string,payload:unknown)=>{await onAction(action,payload);setForm(null)};
 return <><EventCourtSignup e={e} ctx={ctx} rules={s.settings.rules}/><button type="button" onClick={()=>setForm({title:'商品',action:'treasureProduct',values:{listed:false},fields:[{key:'listed',label:'上架商品',type:'checkbox'}]})}>商品测试</button><Forms form={form} setForm={setForm} busy={false} action={action} danger={null} setDanger={()=>{}}/></>;
}
