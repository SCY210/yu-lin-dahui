'use client';
import {useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {notifySessionChange} from '../lib/client/session-sync';
import './change-username.css';

type Props={open:boolean;onOpenChange:(open:boolean)=>void;onChanged:(result:{signedOut:boolean;username:string})=>void|Promise<void>;currentUsername:string;isOwner:boolean;passwordEnabled:boolean;accountId?:string;accountName?:string};

export default function ChangeUsername({open,onOpenChange,onChanged,currentUsername,isOwner,passwordEnabled,accountId,accountName}:Props){
 const [newUsername,setNewUsername]=useState(''),[currentPassword,setCurrentPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const inFlight=useRef(false),requestId=useRef('');
 useEffect(()=>{setNewUsername('');setCurrentPassword('');setError('');requestId.current=open?crypto.randomUUID():''},[open,accountId]);
 const changeOpen=(next:boolean)=>{if(inFlight.current)return;if(!next){setNewUsername('');setCurrentPassword('');setError('')}onOpenChange(next)};
 async function submit(ev:React.FormEvent){
  ev.preventDefault();if(inFlight.current)return;
  const username=newUsername.trim();
  if(!/^[A-Za-z0-9]{2,32}$/.test(username)){setError('新账号须为2–32位英文字母或数字');return}
  if(username.toLowerCase()===currentUsername.toLowerCase()){setError('新账号不能与当前账号相同，英文不区分大小写');return}
  inFlight.current=true;setBusy(true);setError('');
  try{
   const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'changeUsername',newUsername:username,requestId:requestId.current,...(passwordEnabled?{currentPassword}:{}),...(accountId?{accountId}:{})})});
   const result:any=await response.json();if(!response.ok)throw new Error(result.error??'账号修改失败，请重试');
   setNewUsername('');setCurrentPassword('');if(result.signedOut)notifySessionChange();await onChanged({signedOut:result.signedOut,username:result.username});
  }catch(e){setError(e instanceof Error?e.message:'账号修改失败，请重试')}finally{inFlight.current=false;setBusy(false)}
 }
 return <Dialog open={open} historyCloseBlocked={busy} onOpenChange={changeOpen}><DialogContent className="app-dialog change-username-dialog" showCloseButton={!busy} onEscapeKeyDown={ev=>{if(inFlight.current)ev.preventDefault()}} onInteractOutside={ev=>{if(inFlight.current)ev.preventDefault()}}>
  <DialogHeader><DialogTitle>{accountId?'修改球友登录账号':'修改登录账号'}</DialogTitle><DialogDescription>{accountId?'群主代改不占用或重置球友自主修改账号的机会。该球友需使用新账号重新登录，密码不变。':isOwner?'群主可随时修改自己的登录账号。修改成功后请使用新账号和原密码重新登录。':'每个成员仅有一次自主修改登录账号的机会。修改成功后请使用新账号和原密码重新登录。'}</DialogDescription></DialogHeader>
  <form onSubmit={submit}><div className="form-fields">
   <div className="username-current"><span>{accountName?accountName+'的当前账号':'当前登录账号'}</span><strong>{currentUsername}</strong></div>
   <label>新登录账号<input type="text" required minLength={2} maxLength={32} pattern="[A-Za-z0-9]{2,32}" title="2–32位英文字母或数字" value={newUsername} onChange={ev=>setNewUsername(ev.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy}/><small>2–32位英文字母或数字，英文不区分大小写。登录账号与球友名字分别设置。</small></label>
   {passwordEnabled&&<label>{accountId?'你的当前密码':'当前密码'}<input type="password" required minLength={1} maxLength={128} value={currentPassword} onChange={ev=>setCurrentPassword(ev.target.value)} autoComplete="current-password" disabled={busy}/>{accountId&&<small>验证群主本人的密码。</small>}</label>}
  </div>{error&&<p className="error" role="alert">{error}</p>}<div className="change-username-actions"><button type="button" className="secondary" onClick={()=>changeOpen(false)} disabled={busy}>取消</button><button type="submit" className="primary" disabled={busy}>{busy?'正在修改…':'确认修改账号'}</button></div></form>
 </DialogContent></Dialog>;
}
