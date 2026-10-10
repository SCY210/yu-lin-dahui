'use client';
import {lazy,useCallback,useEffect,useRef,useState} from 'react';
import {ClipboardPen} from 'lucide-react';
import Deferred from './deferred';
import {createScorePromptGate,pendingOwnScores,scoreEntryRequest,type ScoreReminderData} from '../lib/client/score-reminder';
import './score-reminder.css';
const ScoreDialog=lazy(()=>import('./score-dialog'));
type Context={data:ScoreReminderData&{bookings:{id:string;name:string}[]};name:(id:string)=>string;refresh:()=>Promise<unknown>;busy:boolean};
const externalDialog=()=>!!document.querySelector('[role="dialog"],[role="alertdialog"]');

/** hideBar: the page offers its own score buttons (home live cards and to-dos), so only the form is rendered. */
export default function ScoreReminder({ctx,blocked=false,hideBar=false}:{ctx:Context;blocked?:boolean;hideBar?:boolean}){
 const [selection,setSelection]=useState<{id:string;mode:'score'}|null>(null);
 const pending=pendingOwnScores(ctx.data),match=pending.find(m=>m.id===selection?.id);
 const current=useRef({ctx,blocked,selection});
 useEffect(()=>{current.current={ctx,blocked,selection:match?selection:null}},[ctx,blocked,selection,match]);
 const gate=useRef(createScorePromptGate(ctx.data.me.id)),active=useRef(false);
 const tryPrompt=useCallback(()=>{
  if(!active.current)return;const {ctx,blocked,selection}=current.current;
  const id=gate.current.next(ctx.data.me.id,pendingOwnScores(ctx.data).map(m=>m.id),blocked||ctx.busy||!!selection||document.hidden||externalDialog());
  if(id)setSelection({id,mode:'score'});
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
 useEffect(()=>{
  const open=(e:Event)=>{const id=(e as CustomEvent<string>).detail;if(pendingOwnScores(current.current.ctx.data).some(m=>m.id===id)){gate.current.suppress();setSelection({id,mode:'score'})}};
  window.addEventListener(scoreEntryRequest,open);return()=>window.removeEventListener(scoreEntryRequest,open);
 },[]);
 const dismiss=()=>{gate.current.suppress();setSelection(null)};
 const manualOpen=()=>{gate.current.suppress();setSelection({id:pending[0].id,mode:'score'})};
 if(!pending.length)return null;
 const chosen=match??pending[0],event=ctx.data.events.find(e=>e.id===chosen.eventId),court=ctx.data.bookings.find(b=>b.id===chosen.courtId);
 return <>
  {!hideBar&&<section className="score-reminder-bar" aria-label="我的待录比分"><div><strong><ClipboardPen size={18} aria-hidden="true"/>你有 {pending.length} 场对局待录比分</strong><small>{event?.title} · {court?.name??'比赛场地'}</small></div><button type="button" className="primary" disabled={blocked||ctx.busy} onClick={manualOpen}>去录分</button></section>}
  {selection?.mode==='score'&&match&&<Deferred><ScoreDialog key={match.id} m={match} ctx={ctx} close={dismiss} pendingMatches={pending} choose={(id:string)=>setSelection({id,mode:'score'})}/></Deferred>}
 </>;
}
