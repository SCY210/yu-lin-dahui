'use client';
import {lazy,useCallback,useEffect,useRef,useState} from 'react';
import {ClipboardPen} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import Deferred from './deferred';
import {fmt} from './form-fields';
import {createScorePromptGate,pendingOwnScores,type ScoreReminderData} from '../lib/client/score-reminder';
import './score-reminder.css';
const ScoreDialog=lazy(()=>import('./score-dialog'));
type Context={data:ScoreReminderData&{bookings:{id:string;name:string}[]};name:(id:string)=>string;refresh:()=>Promise<unknown>;busy:boolean};
const externalDialog=()=>!!document.querySelector('[role="dialog"],[role="alertdialog"]');

export default function ScoreReminder({ctx,blocked=false}:{ctx:Context;blocked?:boolean}){
 const [selection,setSelection]=useState<{id:string;mode:'prompt'|'score'}|null>(null);
 const pending=pendingOwnScores(ctx.data),match=pending.find(m=>m.id===selection?.id);
 const current=useRef({ctx,blocked,selection});
 useEffect(()=>{current.current={ctx,blocked,selection:match?selection:null}},[ctx,blocked,selection,match]);
 const gate=useRef(createScorePromptGate(ctx.data.me.id)),active=useRef(false);
 const tryPrompt=useCallback(()=>{
  if(!active.current)return;const {ctx,blocked,selection}=current.current;
  const id=gate.current.next(ctx.data.me.id,pendingOwnScores(ctx.data).map(m=>m.id),blocked||ctx.busy||!!selection||document.hidden||externalDialog());
  if(id)setSelection({id,mode:'prompt'});
 },[]);
 useEffect(()=>{
  active.current=true;const token=gate.current.begin();gate.current.ready(token,current.current.ctx.data.me.id);queueMicrotask(tryPrompt);
  let awayAt:number|null=null,lastWake=0;
  const wake=async()=>{
   if(document.hidden||current.current.selection||Date.now()-lastWake<1500)return;lastWake=Date.now();
   const token=gate.current.begin(),owner=current.current.ctx.data.me.id;
   let fresh:unknown;try{fresh=await current.current.ctx.refresh()}catch{return}
   if(!active.current||!fresh||typeof fresh!=='object'||!('me' in fresh)||(fresh as {me?:{id?:string}}).me?.id!==owner)return;
   gate.current.ready(token,owner);queueMicrotask(tryPrompt);
  };
  const visibility=()=>{if(document.hidden)awayAt=Date.now();else{awayAt=null;void wake()}},blur=()=>{awayAt=Date.now()},focus=()=>{if(awayAt!==null&&Date.now()-awayAt>=1500){awayAt=null;void wake()}},show=(e:PageTransitionEvent)=>{if(e.persisted)void wake()};
  const online=()=>{void wake()};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);window.addEventListener('focus',focus);window.addEventListener('pageshow',show);window.addEventListener('online',online);
  return()=>{active.current=false;document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);window.removeEventListener('pageshow',show);window.removeEventListener('online',online)};
 },[tryPrompt]);
 useEffect(()=>{queueMicrotask(tryPrompt)},[ctx.data,ctx.busy,blocked,tryPrompt]);
 const dismiss=()=>{gate.current.suppress();setSelection(null)};
 const manualOpen=()=>{gate.current.suppress();setSelection({id:pending[0].id,mode:'prompt'})};
 if(!pending.length)return null;
 const chosen=match??pending[0],event=ctx.data.events.find(e=>e.id===chosen.eventId),court=ctx.data.bookings.find(b=>b.id===chosen.courtId);
 return <>
  <section className="score-reminder-bar" aria-label="我的待录比分"><div><strong><ClipboardPen size={18} aria-hidden="true"/>你有 {pending.length} 场对局待录比分</strong><small>{event?.title} · {court?.name??'比赛场地'}</small></div><button type="button" className="primary" disabled={blocked||ctx.busy} onClick={manualOpen}>去录分</button></section>
  {selection?.mode==='prompt'&&match&&<Dialog open onOpenChange={open=>{if(!open)dismiss()}}><DialogContent className="app-dialog score-reminder-dialog"><DialogHeader><DialogTitle>这局打完了吗？</DialogTitle><DialogDescription>你参加的这场对局还没有比分。已打完可直接填写；还在比赛可以稍后再录。</DialogDescription></DialogHeader><p className="score-reminder-meta">{event?.title} · {court?.name??'比赛场地'}<small>{fmt(chosen.start!)} 开赛</small></p><div className="score-reminder-teams">{(['a','b'] as const).map(side=><div key={side} className={chosen[side].includes(ctx.data.me.playerId)?'is-my-team':''}><small>{chosen[side].includes(ctx.data.me.playerId)?'你所在队伍':'对方队伍'}</small><strong>{chosen[side].map(ctx.name).join(' / ')}</strong></div>)}</div>{pending.length>1&&<details><summary>还有 {pending.length-1} 场待录比分</summary><div className="score-reminder-list">{pending.filter(m=>m.id!==chosen.id).map(m=><button key={m.id} type="button" className="ghost" onClick={()=>setSelection({id:m.id,mode:'prompt'})}>{ctx.data.events.find(e=>e.id===m.eventId)?.title} · {fmt(m.start!)}</button>)}</div></details>}<div className="score-reminder-actions"><button type="button" className="primary" onClick={()=>setSelection({id:chosen.id,mode:'score'})}>已打完，录入比分</button><button type="button" className="secondary" onClick={dismiss}>还没打完 / 稍后再录</button></div></DialogContent></Dialog>}
  {selection?.mode==='score'&&match&&<Deferred><ScoreDialog key={match.id} m={match} ctx={ctx} close={dismiss}/></Deferred>}
 </>;
}
