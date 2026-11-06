'use client';
import {lazy,useEffect,useRef,useState} from 'react';
import {ClipboardPen} from 'lucide-react';
import Deferred from './deferred';
import {pendingOwnScores,pendingScores,scoreEntryRequest,type ScoreReminderData} from '../lib/client/score-reminder';
import './score-reminder.css';
const ScoreDialog=lazy(()=>import('./score-dialog'));
type Context={data:ScoreReminderData&{bookings:{id:string;name:string}[]};name:(id:string)=>string;refresh:()=>Promise<unknown>;busy:boolean};
const externalDialog=()=>!!document.querySelector('[role="dialog"],[role="alertdialog"]');

/** hideBar: the page offers its own score buttons (home live cards and to-dos), so only the form is rendered. */
/** onOpenMatch: the bar's button opens the activity's rounds at the match with its form (docs/JUMP_TO_MATCH.md). */
export default function ScoreReminder({ctx,blocked=false,hideBar=false,onOpenMatch}:{ctx:Context;blocked?:boolean;hideBar?:boolean;onOpenMatch?:(eventId:string,matchId:string)=>void}){
 const [selection,setSelection]=useState<{id:string;mode:'score'}|null>(null);
 // The bar lists own games; a home score button may open any game this account can score.
 // A game someone else just scored stays open so the form can show their score instead of vanishing.
 const pending=pendingOwnScores(ctx.data),match=pendingScores(ctx.data).find(m=>m.id===selection?.id)??ctx.data.matches.find(m=>m.id===selection?.id&&m.status==='complete');
 const current=useRef({ctx,blocked,selection});
 useEffect(()=>{current.current={ctx,blocked,selection:match?selection:null}},[ctx,blocked,selection,match]);
 // The form never opens by itself: a player in a game is not interrupted. It opens from the bar below or a home score
 // button (scoreEntryRequest).
 useEffect(()=>{
  const open=(e:Event)=>{if(current.current.blocked||current.current.ctx.busy||document.hidden||externalDialog())return;const id=(e as CustomEvent<string>).detail;if(pendingScores(current.current.ctx.data).some(m=>m.id===id))setSelection({id,mode:'score'})};
  window.addEventListener(scoreEntryRequest,open);return()=>window.removeEventListener(scoreEntryRequest,open);
 },[]);
 const dismiss=()=>setSelection(null);
 const manualOpen=()=>onOpenMatch?onOpenMatch(pending[0].eventId,pending[0].id):setSelection({id:pending[0].id,mode:'score'});
 if(!pending.length&&!match)return null;
 const chosen=match??pending[0],event=ctx.data.events.find(e=>e.id===chosen.eventId),court=ctx.data.bookings.find(b=>b.id===chosen.courtId);
 return <>
  {!hideBar&&pending.length>0&&<section className="score-reminder-bar" aria-label="我的待录比分"><div><strong><ClipboardPen size={18} aria-hidden="true"/>尚有 {pending.length} 场对局战果未录</strong><small>{event?.title} · {court?.name??'比赛场地'}</small></div><button type="button" className="primary" disabled={blocked||ctx.busy} onClick={manualOpen}>前去录分</button></section>}
  {selection?.mode==='score'&&match&&<Deferred><ScoreDialog key={match.id} m={match} ctx={ctx} close={dismiss} pendingMatches={pending} choose={(id:string)=>setSelection({id,mode:'score'})}/></Deferred>}
 </>;
}
