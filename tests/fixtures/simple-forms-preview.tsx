import {useState} from 'react';
import {newEventForm} from '../../app/event-create-form';
import {Forms} from '../../app/ui';
import ScoreDialog from '../../app/score-dialog';
import type {Form} from '../../app/form-fields';
export default function Preview({kind,onAction}:{kind:'edit'|'danger'|'score'|'practice';onAction:(action:string,payload:unknown)=>Promise<void>}){
 const [now]=useState(Date.now);
 const [form,setForm]=useState<Form|null>(kind==='practice'?newEventForm(now):kind==='edit'?{title:'调整场地费用',action:'bookingEdit',values:{cents:690,reason:''},fields:[{key:'cents',label:'价格',type:'number'},{key:'reason',label:'原因 / 备注'}]}:null);
 const [danger,setDanger]=useState(kind==='danger'?{title:'确认删除活动',description:'删除后可以恢复',action:'deleteEvent',payload:{eventId:'fixture-event'},reason:''}:null);
 if(kind==='score'){
  const m={id:'fixture-match',eventId:'fixture-event',roundId:'fixture-round',courtId:'fixture-court',a:['self'],b:['other'],start:now-60000,end:now,status:'complete',games:[{a:21,b:19}]};
  const ctx={data:{me:{playerId:'self'},rounds:[{id:m.roundId,live:true}],events:[{id:m.eventId,title:'单打'}],bookings:[],seasons:[],settings:{rules:{ceiling:30}}},busy:false,name:(id:string)=>id,action:onAction};
  return <ScoreDialog m={m} ctx={ctx} close={()=>{}}/>;
 }
 return <Forms form={form} setForm={setForm} danger={danger} setDanger={setDanger} busy={false} action={onAction}/>;
}
