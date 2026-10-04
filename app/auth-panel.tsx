'use client';
import {useState} from 'react';
import {toast} from 'sonner';
export default function AuthPanel({binding=false,onBound}:{binding?:boolean;onBound?:()=>void}){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(binding&&password!==confirmation){setError('两次密码不一致');return}setBusy(true);setError('');try{
  const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:binding?'bind':'login',username,password})}),d:any=await r.json();if(!r.ok)throw new Error(d.error);
  setPassword('');setConfirmation('');
  if(binding){toast.success('账号登录已开通，原权限和记录已保留');onBound?.()}else location.reload();
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className={binding?'auth-bind':'auth-card'}>
 {!binding&&<div className="auth-decoration" aria-hidden="true"><img src="/shuttlecock.png" width={1309} height={1202} alt=""/></div>}
 <h1>{binding?'开通账号登录':'登录羽林大会'}</h1>
 <p className="muted">{binding?'设置自己的账号和密码，保留现有管理员权限、球友档案和比赛记录。':'使用管理员为你创建的账号和密码。'}</p>
 <form onSubmit={submit}><div className="form-fields">
 <label>账号<input required minLength={binding?2:1} maxLength={binding?32:254} value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username"/>{binding&&<small>2–32位中英文、数字、_或-，英文不区分大小写。</small>}</label>
 <label>{binding?'设置密码':'密码'}<input type="password" required minLength={binding?12:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={binding?'new-password':'current-password'}/>{binding&&<small>至少12位，可以使用一段容易记住的密码短语。</small>}</label>
 {binding&&<label>确认密码<input type="password" required minLength={12} maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password"/></label>}
 </div>{error&&<p className="error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'正在处理…':binding?'开通账号登录':'登录'}</button></form>
 {!binding&&<><p className="auth-help">还没有账号或忘记密码？请联系群管理员。</p><a className="ghost legacy-login" href="/api/auth/legacy" target="_top">管理员 / 原账号迁移入口</a></>}
 </div>;
}
