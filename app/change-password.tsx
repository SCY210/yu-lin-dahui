'use client';
import {useEffect,useState} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import './change-password.css';

export default function ChangePassword({open,onOpenChange,onChanged}:{open:boolean;onOpenChange:(open:boolean)=>void;onChanged:()=>void}){
 const [currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const clear=()=>{setCurrentPassword('');setNewPassword('');setConfirmPassword('');setError('')};
 useEffect(()=>{if(!open){setCurrentPassword('');setNewPassword('');setConfirmPassword('');setError('')}},[open]);
 const changeOpen=(next:boolean)=>{if(busy)return;if(!next)clear();onOpenChange(next)};
 async function submit(ev:React.FormEvent){
  ev.preventDefault();if(busy)return;
  if(newPassword!==confirmPassword){setError('两次新密码不一致');return}
  if(currentPassword===newPassword){setError('新密码不能与当前密码相同');return}
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'changePassword',currentPassword,newPassword,confirmPassword,requestId:crypto.randomUUID()})});
   const result:any=await response.json();if(!response.ok)throw new Error(result.error??'密码修改失败，请重试');
   clear();onChanged();
  }catch(e){setError(e instanceof Error?e.message:'密码修改失败，请重试')}finally{setBusy(false)}
 }
 return <Dialog open={open} historyCloseBlocked={busy} onOpenChange={changeOpen}><DialogContent className="app-dialog change-password-dialog" showCloseButton={!busy} onEscapeKeyDown={ev=>{if(busy)ev.preventDefault()}} onInteractOutside={ev=>{if(busy)ev.preventDefault()}}>
  <DialogHeader><DialogTitle>修改密码</DialogTitle><DialogDescription>修改成功后将退出全部设备，请使用新密码重新登录。</DialogDescription></DialogHeader>
  <form onSubmit={submit}><div className="form-fields">
   <label>当前密码<input type="password" required minLength={1} maxLength={128} value={currentPassword} onChange={ev=>setCurrentPassword(ev.target.value)} autoComplete="current-password" disabled={busy}/></label>
   <label>新密码<input type="password" required minLength={12} maxLength={128} value={newPassword} onChange={ev=>setNewPassword(ev.target.value)} autoComplete="new-password" disabled={busy}/><small>12–128位，可使用容易记住的密码短语。</small></label>
   <label>确认新密码<input type="password" required minLength={12} maxLength={128} value={confirmPassword} onChange={ev=>setConfirmPassword(ev.target.value)} autoComplete="new-password" disabled={busy}/></label>
  </div>{error&&<p className="error" role="alert">{error}</p>}<div className="change-password-actions"><button type="button" className="secondary" onClick={()=>changeOpen(false)} disabled={busy}>取消</button><button type="submit" className="primary" disabled={busy}>{busy?'正在修改…':'确认修改'}</button></div></form>
 </DialogContent></Dialog>;
}
