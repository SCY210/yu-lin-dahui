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
const n=(i:number)=>({'--i':i}) as CSSProperties;
/** How long the full-screen announcement plays before it gives way (or closes itself). */
const spectacleMs=4600;

/** Crossed swords inside a turning ring of runes: the duel's emblem, full-screen and in the four's popup. */
function Swords({className}:{className:string}){
 return <svg className={className} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id="duel-blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffdf4"/><stop offset=".55" stopColor="#c9d4e6"/><stop offset="1" stopColor="#7f8ba3"/></linearGradient>
   <linearGradient id="duel-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b0"/><stop offset=".5" stopColor="#e2a93b"/><stop offset="1" stopColor="#9a5b12"/></linearGradient>
  </defs>
  <g className="duel-ring"><circle cx="100" cy="100" r="88" fill="none" stroke="url(#duel-gold)" strokeWidth="1.5" strokeDasharray="2 6"/><circle cx="100" cy="100" r="78" fill="none" stroke="url(#duel-gold)" strokeWidth=".8"/>
   {['天','机','战','帖','斗','法','论','道'].map((c,i)=><text key={c} x="100" y="20" textAnchor="middle" transform={`rotate(${i*45} 100 100)`}>{c}</text>)}</g>
  {[-1,1].map(side=><g key={side} className={'duel-sword duel-sword-'+(side<0?'left':'right')}><g transform={`rotate(${side*42} 100 100)`}>
   <polygon points="96,30 100,18 104,30 104,118 96,118" fill="url(#duel-blade)"/><line x1="100" y1="24" x2="100" y2="116" stroke="#ffffff" strokeOpacity=".7" strokeWidth=".8"/>
   <rect x="84" y="118" width="32" height="6" rx="3" fill="url(#duel-gold)"/><rect x="97" y="124" width="6" height="26" rx="2" fill="#5b2c12"/><circle cx="100" cy="153" r="5" fill="url(#duel-gold)"/>
  </g></g>)}
 </svg>;
}

/** The full-screen announcement when a 天机战帖 game starts (docs/DUELS.md): swords clash in a turning ring of runes,
 * lightning and embers, then the two teams. Tap to close; it also closes itself. The resting style of each element is
 * its final frame, so with reduced motion it shows still. */
function Spectacle({start,onDone}:{start:DuelStart&{names:Map<string,string>};onDone:()=>void}){
 const [leaving,setLeaving]=useState(false);
 useEffect(()=>{const fade=setTimeout(()=>setLeaving(true),spectacleMs-500),done=setTimeout(onDone,spectacleMs);return()=>{clearTimeout(fade);clearTimeout(done)}},[onDone]);
 const {duel,court}=start,team=(ids:readonly string[])=>ids.map(id=>start.names.get(id)??'道友').join(' / ');
 return <div className={'duel-spectacle'+(leaving?' is-leaving':'')} role="dialog" aria-modal="true" aria-label={'天机战帖开战：'+team(duel.a)+' 对 '+team(duel.b)} onClick={onDone}>
  <div className="ds-sky"/>
  <div className="ds-embers" aria-hidden="true">{Array.from({length:18},(_,i)=><span key={i} style={n(i)}/>)}</div>
  <svg className="ds-bolts" viewBox="0 0 400 400" aria-hidden="true" focusable="false"><polyline points="40,20 120,140 90,160 190,300"/><polyline points="360,30 270,150 300,170 210,310"/><polyline points="200,0 190,90 215,105 196,190"/></svg>
  <div className="ds-flash" aria-hidden="true"/>
  <Swords className="ds-swords"/>
  <div className="ds-text">
   <p className="ds-kicker">天机阁传音 · {start.title}</p>
   <h2 className="ds-title">天机战帖</h2>
   <p className="ds-teams"><span>{team(duel.a)}</span><b>对</b><span>{team(duel.b)}</span></p>
   <p className="ds-meta">{court} 斗法开场 · 每人 {duel.stake} 积分</p>
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
  <DialogHeader><div className="duel-call-scene"><Swords className="duel-call-swords"/><span className="duel-call-seal">战</span></div>
   <DialogTitle>天机战帖 · 斗法开场</DialogTitle>
   <DialogDescription>{team(mine)} 已在 {current.court} 候战，道友速速登场！</DialogDescription></DialogHeader>
  <p className="duel-call-teams">{team(current.duel.a)} <b>对</b> {team(current.duel.b)} · 每人 {current.duel.stake} 积分</p>
  <div className="duel-call-actions"><button type="button" className="primary full" onClick={()=>{finish();onOpenMatch(current.eventId,current.match.id)}}>前往战场</button><button type="button" className="ghost full" onClick={finish}>容我片刻再来</button></div>
 </DialogContent></Dialog>;
}
