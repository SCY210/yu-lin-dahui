'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {ClubData} from '../lib/contracts/club';
import type {AuditLogPage} from '../lib/audit-log';
import {auditActorName} from '../lib/client/audit-actor';
import {fmt} from './form-fields';

type AuditView=ClubData['audits'][number];
const isAuditPage=(value:unknown):value is AuditLogPage=>{
 if(!value||typeof value!=='object'||!('accountId' in value)||typeof value.accountId!=='string'||!('from' in value)||typeof value.from!=='number'||!('to' in value)||typeof value.to!=='number'||!('nextCursor' in value)||!(value.nextCursor===null||typeof value.nextCursor==='string')||!('audits' in value)||!Array.isArray(value.audits))return false;
 return value.audits.every(row=>row&&typeof row==='object'&&typeof row.id==='string'&&typeof row.at==='number'&&typeof row.actor==='string'&&typeof row.action==='string'&&typeof row.reason==='string');
};

/** Mounted only when the disclosure opens. Weekly history is fetched in pages, independently of club polling. */
export default function AuditLog({data,labels}:{data:Pick<ClubData,'me'|'accounts'|'players'>;labels:Record<string,string>}){
 const [page,setPage]=useState<AuditLogPage|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const active=useRef<AbortController|null>(null),accountId=data.me.id;
 const load=useCallback(async(cursor?:string)=>{
  active.current?.abort();const controller=new AbortController();active.current=controller;
  try{
   const response=await fetch('/api/audits'+(cursor?'?'+new URLSearchParams({cursor}):''),{cache:'no-store',signal:controller.signal});
   const result=await response.json();if(controller.signal.aborted)return;
   if(!response.ok){if(response.status===401||response.status===403)setPage(null);throw new Error(result&&typeof result==='object'&&'error' in result&&typeof result.error==='string'?result.error:'操作日志读取失败')}
   if(!isAuditPage(result))throw new Error('操作日志读取失败，请刷新重试');
   if(result.accountId!==accountId)throw new Error('登录账号已切换，请刷新后重试');
   const next=result;
   setError('');
   setPage(previous=>{
    const prior=cursor&&previous?.accountId===accountId?previous.audits:[],seen=new Set(prior.map(row=>row.id));
    return {...next,audits:[...prior,...next.audits.filter(row=>!seen.has(row.id))].filter(row=>row.at>=next.from&&row.at<=next.to)};
   });
  }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'操作日志读取失败')}
  finally{if(!controller.signal.aborted)setBusy(false)}
 },[accountId]);
 useEffect(()=>{
  let cancelled=false;
  queueMicrotask(()=>{if(!cancelled)void load()});
  return ()=>{cancelled=true;active.current?.abort()};
 },[load]);
 const request=(cursor?:string)=>{setBusy(true);setError('');void load(cursor)};
 const current=page?.accountId===accountId?page:null;
 return <section className="card"><h3>操作日志 · 最近 7 天</h3><p className="hint">按时间从新到旧排列，每次加载 50 条。</p>
 <button className="ghost" disabled={busy} onClick={()=>request()}>刷新日志</button>
 {error&&<p role="alert">{error}</p>}{busy&&<p role="status">正在读取日志…</p>}
 {!busy&&!error&&current&&!current.audits.length&&<p className="hint">最近 7 天暂无操作日志。</p>}
 {current?.audits.map((a:AuditView)=><details className="audit" key={a.id}>
  <summary>{fmt(a.at)} · <strong className="audit-actor">{auditActorName(a.actor,data)}</strong> · {labels[a.action]??'其他操作'} · {a.reason}</summary>
  <pre>{JSON.stringify(a.changes??{},null,2)}</pre>
 </details>)}
 {current?.nextCursor&&<button className="secondary" disabled={busy} onClick={()=>request(current.nextCursor!)}>加载更早日志</button>}
 </section>;
}
