'use client';
import {useState} from 'react';
import {toast} from 'sonner';
import {UserPlus,KeyRound,Pencil} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import FeatureGuide from './feature-guide';
import ChangeUsername from './change-username';
import {Pick} from './ui';
export default function AccountManager({data,refresh,onEditName,onSelfUsernameChanged}:any){
 const [form,setForm]=useState<any>(null),[usernameTarget,setUsernameTarget]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const name=(id:string)=>data.players.find((p:any)=>p.id===id)?.name??'球友';
 const login=(id:string)=>(data.loginAccounts??[]).find((c:any)=>c.accountId===id);
 const available=data.players.filter((p:any)=>!data.accounts.some((a:any)=>a.playerId===p.id));
 function open(account?:any,reset=false){setError('');setForm({accountId:account?.id,reset,name:account?name(account.playerId):'',username:account?login(account.id)?.username??'':'',playerId:'new',password:'',confirmation:'',requestId:crypto.randomUUID()})}
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;if(form.password!==form.confirmation){setError('两次密码不一致');return}if(!form.reset&&!/^[A-Za-z0-9]{2,32}$/.test(form.username.trim())){setError('新账号须为2–32位英文字母或数字');return}setBusy(true);setError('');
  try{
   const payload=form.reset?{action:'resetPassword',accountId:form.accountId,password:form.password,requestId:form.requestId}:{action:'createAccount',accountId:form.accountId,name:form.name,username:form.username,password:form.password,requestId:form.requestId,...(form.playerId!=='new'?{playerId:form.playerId}:{})};
   const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),d:any=await r.json();if(!r.ok)throw new Error(d.error);
   const selfReset=form.reset&&form.accountId===data.me.id;
   setForm(null);toast.success(selfReset?'密码已重置，请重新登录':form.reset?'密码已重置，原登录会话已退出':'账号已创建，请将账号和初始密码交给本人');
   if(selfReset&&data.auth.method==='password'){location.reload();return}await refresh();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="card account-manager">
 <div className="section-title"><div><h3>球友账号</h3><p className="hint">由管理员开通，无需邮箱。每个账号对应一个球友档案。</p></div><div className="actions"><FeatureGuide rules={data.settings.rules} topic="accounts" label="账号管理说明"/><button className="primary" onClick={()=>open()}><UserPlus size={17}/>创建账号</button></div></div>
 {data.accounts.map((a:any)=>{const c=login(a.id);return <div className="account-line" key={a.id}><div className="grow"><strong>{name(a.playerId)}</strong><p>{c?<><span className="account-key">{c.username}</span> · {a.isOwner?'群主 · 最高权限':a.role==='admin'?'管理员':'成员'}</>:'尚未开通账号密码登录'}</p></div><div className="actions">{data.me.isOwner&&<><button className="secondary" onClick={()=>onEditName(a)}><Pencil size={15}/>修改名字</button>{c&&<button className="secondary" onClick={()=>setUsernameTarget(a)}><Pencil size={15}/>修改账号</button>}</>}{a.canModify===false?<span className="badge">群主账号受保护</span>:<button className="secondary" onClick={()=>open(a,!!c)}><KeyRound size={15}/>{c?'重置密码':'开通登录'}</button>}</div></div>})}
 <Dialog open={!!form} historyCloseBlocked={busy} onOpenChange={v=>{if(!v&&!busy)setForm(null)}}><DialogContent className="app-dialog account-edit-dialog" showCloseButton={!busy} onEscapeKeyDown={ev=>{if(busy)ev.preventDefault()}} onInteractOutside={ev=>{if(busy)ev.preventDefault()}}><DialogHeader><DialogTitle>{form?.reset?'重置账号密码':form?.accountId?'开通原账号登录':'创建球友账号'}</DialogTitle><DialogDescription>{form?.reset?'新密码生效后，该账号原有登录会话会退出。头像、权限和比赛记录保留。':'填写账号和初始密码，保存后手动交给本人。新账号默认为普通成员。'}</DialogDescription></DialogHeader>
 {form&&<form onSubmit={submit}><div className="form-fields">
 {!form.reset&&!form.accountId&&<label>球友档案<Pick value={form.playerId} options={[['new','创建新球友档案'],...available.map((p:any)=>[p.id,p.name+' · 保留历史记录'])]} onChange={(id:string)=>{if(!busy)setForm({...form,playerId:id,name:id==='new'?'':name(id)})}}/></label>}
 {!form.reset&&<label>昵称<input required readOnly={!!form.accountId||form.playerId!=='new'} maxLength={150} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} disabled={busy}/></label>}
 <label>登录账号<input required readOnly={form.reset} minLength={form.reset?1:2} maxLength={form.reset?254:32} pattern={form.reset?undefined:'[A-Za-z0-9]{2,32}'} title={form.reset?undefined:'2–32位英文字母或数字'} autoComplete="off" autoCapitalize="none" spellCheck={false} value={form.username} onChange={e=>setForm({...form,username:e.target.value})} disabled={busy}/>{!form.reset&&<small>2–32位英文字母或数字，英文不区分大小写。</small>}</label>
 <label>{form.reset?'新密码':'初始密码'}<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} disabled={busy}/><small>至少12位。请为每位球友设置不同的密码。</small></label>
 <label>确认密码<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={form.confirmation} onChange={e=>setForm({...form,confirmation:e.target.value})} disabled={busy}/></label>
 </div>{error&&<p className="error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'正在保存…':form.reset?'确认重置密码':'保存账号'}</button></form>}
 </DialogContent></Dialog>
 <ChangeUsername open={!!usernameTarget} onOpenChange={v=>{if(!v)setUsernameTarget(null)}} currentUsername={usernameTarget?login(usernameTarget.id)?.username??'':''} isOwner={!!data.me.isOwner} passwordEnabled={!!data.auth?.passwordEnabled} accountId={usernameTarget&&usernameTarget.id!==data.me.id?usernameTarget.id:undefined} accountName={usernameTarget&&usernameTarget.id!==data.me.id?name(usernameTarget.playerId):undefined} onChanged={async result=>{setUsernameTarget(null);if(result.signedOut){toast.success('账号已修改，请使用新账号重新登录');onSelfUsernameChanged();return}toast.success('球友账号已修改，密码保持不变');await refresh()}}/>
 </section>;
}
