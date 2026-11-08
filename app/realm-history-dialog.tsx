'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import type {RealmHistoryEntry,RealmHistoryView} from '../lib/realm-history';
import {fmt} from './form-fields';
import './realm-history.css';

const signed=(n:number)=>(n>0?'+':'')+n;
const entry=(value:unknown):value is RealmHistoryEntry=>!!value&&typeof value==='object'&&'id' in value&&typeof value.id==='string'&&'title' in value&&typeof value.title==='string'&&'before' in value&&typeof value.before==='number'&&'after' in value&&typeof value.after==='number'&&'delta' in value&&typeof value.delta==='number';
const valid=(value:unknown):value is RealmHistoryView=>!!value&&typeof value==='object'&&'playerId' in value&&typeof value.playerId==='string'&&'accountId' in value&&typeof value.accountId==='string'&&'score' in value&&typeof value.score==='number'&&'liveScore' in value&&typeof value.liveScore==='number'&&'settled' in value&&Array.isArray(value.settled)&&value.settled.every(entry)&&'live' in value&&Array.isArray(value.live)&&value.live.every(entry);

export default function RealmHistoryDialog({playerId,accountId,name,onClose}:{playerId:string;accountId:string;name?:string;onClose:()=>void}){
 const [data,setData]=useState<RealmHistoryView|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[live,setLive]=useState(false),[limit,setLimit]=useState(20);
 const active=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{
  active.current?.abort();const controller=new AbortController();active.current=controller;
  try{
   const response=await fetch('/api/realm-history?'+new URLSearchParams({playerId}),{cache:'no-store',signal:controller.signal}),result:unknown=await response.json();
   if(controller.signal.aborted)return;
   if(!response.ok){setData(null);throw new Error(result&&typeof result==='object'&&'error' in result&&typeof result.error==='string'?result.error:'修为明细读取失败')}
   if(!valid(result)||result.playerId!==playerId||result.accountId!==accountId)throw new Error('修为明细已变化，请刷新重试');
   setData(result);setError('');setLimit(20);
  }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'修为明细读取失败')}
  finally{if(!controller.signal.aborted)setBusy(false)}
 },[playerId,accountId]);
 useEffect(()=>{let cancelled=false;queueMicrotask(()=>{if(!cancelled)void load()});return ()=>{cancelled=true;active.current?.abort()}},[load]);
 const current=data?.accountId===accountId&&data.playerId===playerId?data:null,rows=current?(live?current.live:current.settled):[];
 return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="app-dialog realm-history-dialog"><DialogHeader className="text-left"><DialogTitle>{name?name+'的修为明细':'修为明细'}</DialogTitle><DialogDescription>修为是长期分；比赛按小局计算，活动结束后结算，宗主手动调整立即生效。</DialogDescription></DialogHeader>
  <button type="button" className="ghost" disabled={busy} onClick={()=>{setBusy(true);setError('');void load()}}>刷新明细</button>
  {busy&&<p role="status">正在读取修为明细…</p>}{error&&<p role="alert">{error}</p>}
  {current&&<><dl className="realm-history-summary"><div><dt>起始修为</dt><dd>{current.initial}</dd></div><div><dt>已结算修为</dt><dd>{current.score}</dd></div><div><dt>待结算净变化</dt><dd>{signed(current.pendingChange)}</dd></div></dl>
   {current.fixed?<p className="hint">临时来宾使用报名时的固定水平，不累计比赛修为。</p>:<><div className="actions" role="group" aria-label="修为明细范围"><button type="button" className="ghost" aria-pressed={!live} onClick={()=>{setLive(false);setLimit(20)}}>已结算</button><button type="button" className="ghost" aria-pressed={live} onClick={()=>{setLive(true);setLimit(20)}}>含待结算</button></div>
   <p className="hint">{live?'含待结算的完整回放，暂计修为 '+current.liveScore+'；活动结束前可能变化。':'以下变化对应已结算修为。'}从新到旧排列；每条显示变化前后数值。</p>
   <div className="realm-history-list">{rows.slice(0,limit).map(row=><details className="realm-history-entry" key={row.id}><summary><span>{row.title}{row.gameIndex!==undefined?' · 第 '+(row.gameIndex+1)+' 小局':''}{row.won!==undefined?(row.won?' · 胜':' · 负'):''}{row.pending?' · 待结算':''}<small>{fmt(row.at)}</small></span><strong>{signed(row.delta)}<small>{row.before} → {row.after}</small></strong></summary>
    {row.reason&&<p>{row.reason}</p>}{row.k!==undefined&&<p>本队赛前平均修为 {Math.round(row.team??0)}，对方 {Math.round(row.opponent??0)}；预期胜率 {Math.round((row.expected??0)*100)}%，K = {row.k}。</p>}
   </details>)}{!rows.length&&<p className="hint">暂无修为变动记录。</p>}</div>
   {rows.length>limit&&<button type="button" className="secondary" onClick={()=>setLimit(limit+20)}>显示更早明细</button>}</>}
  </>}
 </DialogContent></Dialog>;
}
