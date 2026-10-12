import {useState} from 'react';
import {Forms} from '../../app/ui';
import {activityNoticeField,type Form} from '../../app/form-fields';
import {activityNoticeVersion} from '../../lib/activity-notice';
export {ActivityNoticeConfirmation} from '../../app/activity-notice';

export default function Preview({kind='self',onAction}:{kind?:'self'|'proxy'|'shop';onAction:(action:string,payload:unknown)=>Promise<void>}){
 const makeForm=():Form=>kind==='shop'?{title:'商品',action:'treasureProduct',values:{listed:false},fields:[{key:'listed',label:'上架商品',type:'checkbox'}]}:{title:'接龙',action:kind==='proxy'?'friendSignup':'courtRegister',values:{playerId:'self',bookingId:'one',noticeAccepted:false,noticeVersion:activityNoticeVersion},fields:[{key:'playerId',label:'球友',type:'select',options:[['self','本人'],['other','另一位球友']]},{key:'bookingId',label:'场地',type:'select',options:[['one','一号场'],['two','二号场']]},activityNoticeField('self')]};
 const [form,setForm]=useState<Form|null>(makeForm);
 return <><button onClick={()=>setForm(makeForm())}>重新打开</button><Forms form={form} setForm={setForm} busy={false} action={onAction} danger={null} setDanger={()=>{}}/></>;
}
