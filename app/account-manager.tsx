'use client';
import {useState} from 'react';
import {toast} from 'sonner';
import {UserPlus,KeyRound} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Pick} from './ui';
export default function AccountManager({data,refresh}:any){
 const [form,setForm]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const name=(id:string)=>data.players.find((p:any)=>p.id===id)?.name??'球友';
 const login=(id:string)=>(data.loginAccounts??[]).find((c:any)=>c.accountId===id);
 const available=data.players.filter((p:any)=>!data.accounts.some((a:any)=>a.playerId===p.id));
 function open(account?:any,reset=false){setError('');setForm({accountId:account?.id,reset,name:account?name(account.playerId):'',username:account?login(account.id)?.username??'':'',playerId:'new',password:'',confirmation:'',requestId:crypto.randomUUID()})}
 async function submit(e:React.FormEvent){
  e.preventDefault();if(form.password!==form.confirmation){setError('两次密码不一致');return}setBusy(true);setError('');
  try{
   const payload=form.reset?{action:'resetPassword',accountId:form.accountId,password:form.password,requestId:form.requestId}:{action:'createAccount',accountId:form.accountId,name:form.name,username:form.username,password:form.password,requestId:form.requestId,...(form.playerId!=='new'?{playerId:form.playerId}:{})};
   const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),d:any=await r.json();if(!r.ok)throw new Error(d.error);
   const selfReset=form.reset&&form.accountId===data.me.id;
   setForm(null);toast.success(selfReset?'密码已重置，请重新登录':form.reset?'密码已重置，原登录会话已退出':'账号已创建，请将账号和初始密码交给本人');
   if(selfReset&&data.auth.method==='password'){location.reload();return}await refresh();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="card account-manager">
 <div className="section-title"><div><h3>球友账号</h3><p className="hint">由管理员开通，无需邮箱。每个账号对应一个球友档案。</p></div><button className="primary" onClick={()=>open()}><UserPlus size={17}/>创建账号</button></div>
 {data.accounts.map((a:any)=>{const c=login(a.id);return <div className="account-line" key={a.id}><div className="grow"><strong>{name(a.playerId)}</strong><p>{c?<><span className="account-key">{c.username}</span> · {a.role==='admin'?'管理员':'成员'}</>:'尚未开通账号密码登录'}</p></div><button className="secondary" onClick={()=>open(a,!!c)}><KeyRound size={15}/>{c?'重置密码':'开通登录'}</button></div>})}
 <Dialog open={!!form} onOpenChange={v=>{if(!v&&!busy)setForm(null)}}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>{form?.reset?'重置账号密码':form?.accountId?'开通原账号登录':'创建球友账号'}</DialogTitle><DialogDescription>{form?.reset?'新密码生效后，该账号原有登录会话会退出。头像、权限和比赛记录保留。':'填写账号和初始密码，保存后手动交给本人。新账号默认为普通成员。'}</DialogDescription></DialogHeader>
 {form&&<form onSubmit={submit}><div className="form-fields">
 {!form.reset&&!form.accountId&&<label>球友档案<Pick value={form.playerId} options={[['new','创建新球友档案'],...available.map((p:any)=>[p.id,p.name+' · 保留历史记录'])]} onChange={(id:string)=>setForm({...form,playerId:id,name:id==='new'?'':name(id)})}/></label>}
 {!form.reset&&<label>昵称<input required readOnly={!!form.accountId||form.playerId!=='new'} maxLength={150} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>}
 <label>登录账号<input required readOnly={form.reset} minLength={2} maxLength={form.reset?254:32} autoComplete="off" value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/>{!form.reset&&<small>2–32位中英文、数字、_或-；英文不区分大小写。</small>}</label>
 <label>{form.reset?'新密码':'初始密码'}<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><small>至少12位。请为每位球友设置不同的密码。</small></label>
 <label>确认密码<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={form.confirmation} onChange={e=>setForm({...form,confirmation:e.target.value})}/></label>
 </div>{error&&<p className="error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'正在保存…':form.reset?'确认重置密码':'保存账号'}</button></form>}
 </DialogContent></Dialog>
 </section>;
}
