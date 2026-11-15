'use client';
import {useEffect,useState,type CSSProperties} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {startedDuels,type DuelStart} from '../lib/client/duels';
import type {Booking,Event,Match,Registration} from '../lib/domain/types';
import './duel-alert.css';

const seenKey=(id:string)=>'yulin-duel-seen:'+id;
/** Whether this browser already showed this duel's start. Storage can be missing (private windows): the session state
 * below still shows each one once per visit. */
function seenBefore(id:string){try{return localStorage.getItem(seenKey(id))==='1'}catch{return false}}
function remember(id:string){try{localStorage.setItem(seenKey(id),'1')}catch{/* per-visit state still applies */}}
/** How long the full-screen announcement plays before it gives way (or closes itself). */
const spectacleMs=5000;
const splashes=[[22,38,9],[178,46,7],[30,168,6],[170,160,10],[46,22,4],[160,186,5],[12,104,5],[190,110,4]];

/** Ink-wash mountains on rice paper: the backdrop of the scroll, full-screen and in the four's popup. */
function Mountains({className}:{className:string}){
 return <svg className={className} viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path className="dz-hill dz-hill-far" d="M0 120 L0 70 Q40 40 80 62 T170 48 Q210 30 250 56 T340 44 Q380 36 400 58 L400 120Z"/>
  <path className="dz-hill dz-hill-near" d="M0 120 L0 92 Q60 64 110 86 T220 78 Q270 60 320 84 T400 80 L400 120Z"/>
 </svg>;
}
/** The great 战, written stroke by stroke in ink, then splashed: the heart of the scroll. */
function Zhan({className}:{className:string}){
 return <svg className={className} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
  <g className="dz-splash">{splashes.map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r} style={{'--i':i} as CSSProperties}/>)}</g>
  <text className="dz-zhan" x="100" y="160" textAnchor="middle">战</text>
 </svg>;
}

/** The full-screen announcement when a 天机战帖 game starts (docs/DUELS.md): a sword-light cuts the screen, a challenge
 * scroll unrolls over ink mountains, a great 战 is written in ink, the two teams bleed in and a vermilion seal stamps
 * down. Ink, rice paper and vermilion, apart from the bounty scenes' night and gold. Tap to close; it also closes
 * itself. The resting style of each element is its final frame, so with reduced motion it shows still. */
function Spectacle({start,onDone}:{start:DuelStart&{names:Map<string,string>};onDone:()=>void}){
 const [leaving,setLeaving]=useState(false);
 useEffect(()=>{const fade=setTimeout(()=>setLeaving(true),spectacleMs-600),done=setTimeout(onDone,spectacleMs);return()=>{clearTimeout(fade);clearTimeout(done)}},[onDone]);
 const {duel,court}=start,team=(ids:readonly string[])=>ids.map(id=>start.names.get(id)??'道友').join(' / ');
 return <div className={'duel-spectacle'+(leaving?' is-leaving':'')} role="dialog" aria-modal="true" aria-label={'天机战帖开战：'+team(duel.a)+' 对 '+team(duel.b)} onClick={onDone}>
  <div className="dz-paper"/>
  <Mountains className="dz-mountains"/>
  <div className="dz-slash" aria-hidden="true"/>
  <div className="dz-scroll">
   <i className="dz-rod" aria-hidden="true"/>
   <div className="dz-sheet">
    <p className="dz-kicker">天机阁 · {start.title}</p>
    <Zhan className="dz-brush"/>
    <h2 className="dz-title">天机战帖</h2>
    <p className="dz-teams"><span>{team(duel.a)}</span><b>对</b><span>{team(duel.b)}</span></p>
    <p className="dz-meta">{court} · 每人 {duel.stake} 积分 · 斗法开场</p>
    <span className="dz-seal" aria-hidden="true"><b>天</b><b>机</b></span>
   </div>
   <i className="dz-rod" aria-hidden="true"/>
  </div>
 </div>;
}

type Data={events:Event[];matches:Match[];registrations:Registration[];bookings:Booking[];me:{playerId:string};players:{id:string;name:string}[]};
/** When a 天机战帖 game starts: everyone signed up for the activity sees the full-screen announcement once; the four then
 * get a popup calling them to the court (docs/DUELS.md). Waits while another popup is open. */
export default function DuelAlert({data,blocked,onOpenMatch}:{data:Data;blocked:boolean;onOpenMatch:(eventId:string,matchId:string)=>void}){
 const [now,setNow]=useState(()=>Date.now()),[done,setDone]=useState<string[]>([]),[phase,setPhase]=useState<{id:string;step:'show'|'call'}|null>(null);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),5000);return()=>clearInterval(t)},[]);
 const names=new Map(data.players.map(p=>[p.id,p.name]));
 const list=startedDuels(data,now).map(x=>({...x,names}));
 const current=phase?list.find(x=>x.duel.id===phase.id):list.find(x=>!done.includes(x.duel.id)&&!seenBefore(x.duel.id));
 if(!current||(blocked&&!phase))return null;
 const finish=()=>{remember(current.duel.id);setDone(d=>[...d,current.duel.id]);setPhase(null)};
 const step=phase?.step??'show';
 if(step==='show')return <Spectacle key={current.duel.id} start={current} onDone={()=>current.player?setPhase({id:current.duel.id,step:'call'}):finish()}/>;
 const mine=current.duel.a.includes(data.me.playerId)?current.duel.b:current.duel.a,team=(ids:readonly string[])=>ids.map(id=>names.get(id)??'道友').join(' / ');
 return <Dialog open onOpenChange={open=>{if(!open)finish()}}><DialogContent className="app-dialog duel-call">
  <DialogHeader><div className="duel-call-scene"><Mountains className="duel-call-hills"/><Zhan className="duel-call-brush"/><span className="dz-seal duel-call-seal" aria-hidden="true"><b>天</b><b>机</b></span></div>
   <DialogTitle>天机战帖 · 斗法开场</DialogTitle>
   <DialogDescription>{team(mine)} 已在 {current.court} 候战，道友速速登场！</DialogDescription></DialogHeader>
  <p className="duel-call-teams">{team(current.duel.a)} <b>对</b> {team(current.duel.b)} · 每人 {current.duel.stake} 积分</p>
  <div className="duel-call-actions"><button type="button" className="primary full" onClick={()=>{finish();onOpenMatch(current.eventId,current.match.id)}}>前往战场</button><button type="button" className="ghost full" onClick={finish}>容我片刻再来</button></div>
 </DialogContent></Dialog>;
}
