'use client';
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export default function TrialCleanup({data,refresh}:any){
 const [status,setStatus]=useState<any>(null),[operation,setOperation]=useState<'remove'|'restore'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;if(data.me.isOwner)fetch('/api/trial-cleanup',{cache:'no-store'}).then(async r=>{if(r.ok&&active)setStatus(await r.json())}).catch(()=>{});return()=>{active=false}},[data.me.isOwner,data.revision]);
 if(!data.me.isOwner||!status||(!status.canRemove&&!status.canRestore))return null;
 async function submit(){if(busy||!operation)return;setBusy(true);setError('');try{const r=await fetch('/api/trial-cleanup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:operation,requestId:crypto.randomUUID(),revision:data.revision})}),d:any=await r.json();if(!r.ok)throw Error(d.error);toast.success(operation==='remove'?'三个试用球友已移除':'试用账号和档案已恢复');setOperation(null);await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="card"><h3>试用账号清理</h3><p>试用球友01、02、03</p><p className="hint">移除后不再显示在球友列表，试用账号无法登录。档案和试用投票可恢复，原报名不会自动恢复。</p><button className="secondary" onClick={()=>{setError('');setOperation(status.canRemove?'remove':'restore')}}>{status.canRemove?'移除三个试用球友':'恢复三个试用球友'}</button>
 <Dialog open={!!operation} historyCloseBlocked={busy} onOpenChange={v=>{if(!v&&!busy)setOperation(null)}}><DialogContent className="app-dialog" showCloseButton={!busy}><DialogHeader><DialogTitle>{operation==='remove'?'移除三个试用球友':'恢复三个试用球友'}</DialogTitle><DialogDescription>{operation==='remove'?'只处理试用球友01、02、03和他们的试用报名，试用投票一并存档。正式球友的比赛与费用保留，可在此恢复档案和投票。':'恢复账号和档案，需要重新登录；原报名不会自动恢复。'}</DialogDescription></DialogHeader>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy} onClick={submit}>{busy?'正在处理…':operation==='remove'?'确认移除':'确认恢复'}</button></DialogContent></Dialog></div>;
}
