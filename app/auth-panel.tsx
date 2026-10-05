'use client';
import {useEffect,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {toast} from 'sonner';
import {listenForSessionChanges,notifySessionChange} from '../lib/client/session-sync';
export default function AuthPanel({binding=false,onBound}:{binding?:boolean;onBound?:()=>void}){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const sessionInvalidated=useRef(false);
 useEffect(()=>{
  if(binding)return; // The authenticated parent invalidates and unmounts binding forms.
  const invalidate=()=>{if(sessionInvalidated.current)return;sessionInvalidated.current=true;flushSync(()=>{setUsername('');setPassword('');setConfirmation('');setError('');setBusy(true)});location.replace('/')};
  const sync=listenForSessionChanges(invalidate),restore=(event:PageTransitionEvent)=>{if(event.persisted)invalidate()};
  window.addEventListener('pageshow',restore);
  return()=>{sync.stop();window.removeEventListener('pageshow',restore)};
 },[binding]);
 async function submit(e:React.FormEvent){e.preventDefault();if(busy||sessionInvalidated.current)return;if(binding&&!/^[A-Za-z0-9]{2,32}$/.test(username.trim())){setError('新账号须为2–32位英文字母或数字');return}if(binding&&password!==confirmation){setError('两次密码不一致');return}setBusy(true);setError('');try{
  const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:binding?'bind':'login',username,password})}),d:any=await r.json();if(!r.ok)throw new Error(d.error);
  if(sessionInvalidated.current)return;setPassword('');setConfirmation('');notifySessionChange();
  if(binding){toast.success('账号登录已开通，原权限和记录已保留');onBound?.()}else location.reload();
 }catch(e){if(!sessionInvalidated.current)setError((e as Error).message)}finally{if(!sessionInvalidated.current)setBusy(false)}}
 return <div className={binding?'auth-bind':'auth-card'}>
 {!binding&&<div className="auth-decoration" aria-hidden="true"><img src="/shuttlecock.png" width={1309} height={1202} alt=""/></div>}
 <h1>{binding?'开通账号登录':'登录羽林大会'}</h1>
 <p className="muted">{binding?'设置自己的账号和密码，保留现有管理员权限、球友档案和比赛记录。':'使用管理员为你创建的账号和密码。'}</p>
 <form onSubmit={submit}><div className="form-fields">
 <label>账号<input required minLength={binding?2:1} maxLength={binding?32:254} pattern={binding?'[A-Za-z0-9]{2,32}':undefined} title={binding?'2–32位英文字母或数字':undefined} value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false}/>{binding&&<small>2–32位英文字母或数字，英文不区分大小写。</small>}</label>
 <label>{binding?'设置密码':'密码'}<input type="password" required minLength={binding?12:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={binding?'new-password':'current-password'}/>{binding&&<small>至少12位，可以使用一段容易记住的密码短语。</small>}</label>
 {binding&&<label>确认密码<input type="password" required minLength={12} maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password"/></label>}
 </div>{error&&<p className="error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'正在处理…':binding?'开通账号登录':'登录'}</button></form>
 {!binding&&<><p className="auth-help">还没有账号或忘记密码？请联系群管理员。</p><a className="ghost legacy-login" href="/api/auth/legacy" target="_top">管理员 / 原账号迁移入口</a></>}
 </div>;
}
