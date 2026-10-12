import {useState} from 'react';
import {Forms} from '../../app/ui';
import {ActivityNoticeDetails,ActivityNoticeConfirmation} from '../../app/activity-notice';
import {activityNoticeField,choice,halfTimed,text,type Form} from '../../app/form-fields';
import {activityNoticeVersion} from '../../lib/activity-notice';

function signupForm(proxy:boolean):Form{
 return {title:proxy?'代朋友接龙':'接龙 · 一号场',description:'本地虚构预览，不访问线上账号或活动。',action:proxy?'friendSignup':'courtRegister',values:{eventId:'preview-event',bookingId:'preview-court',playerId:proxy?'preview-friend':'preview-self',arrival:'2026-10-19T15:00',departure:'2026-10-19T17:00',note:'',noticeAccepted:false,noticeVersion:activityNoticeVersion},fields:[choice('playerId','参加球友',[['preview-self','预览球友本人'],['preview-friend','预览同行朋友']]),halfTimed('arrival','参加开始'),halfTimed('departure','参加结束'),text('note','备注'),activityNoticeField('preview-self')]};
}

/** Local synthetic browser fixture. No production API or persistent writes. */
export default function ActivityNoticePreview(){
 const [form,setForm]=useState<Form|null>(signupForm(false));
 const [saved,setSaved]=useState('');
 const action=async(actionName:string,payload:Record<string,unknown>)=>{setSaved(payload.noticeAccepted===true&&payload.noticeVersion===activityNoticeVersion?'虚构接龙已确认 · '+actionName:'尚未确认');setForm(null)};
 return <main className="shell"><p className="hint">活动须知 · 本地虚构预览</p><h1>活动接龙</h1><div className="actions"><button className="primary" onClick={()=>setForm(signupForm(false))}>本人接龙</button><button className="secondary" onClick={()=>setForm(signupForm(true))}>代朋友接龙</button></div>{saved&&<p role="status">{saved}</p>}<ActivityNoticeDetails/><ActivityNoticeConfirmation eventId="preview-event" bookingId="preview-court" records={[{id:'preview-receipt',eventId:'preview-event',bookingId:'preview-court',version:activityNoticeVersion,at:1791810000000,kind:'self',actorName:'预览球友本人',actorIsMe:true}]}/><Forms form={form} setForm={setForm} danger={null} setDanger={()=>{}} busy={false} action={action}/></main>;
}
