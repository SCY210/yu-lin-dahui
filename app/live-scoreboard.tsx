'use client';
import {useEffect,useRef} from 'react';
import {Maximize2,X} from 'lucide-react';
import type {Event} from '../lib/domain/types';
import {defaultScoring} from '../lib/domain/tournament';
import {liveElapsed,liveTally,type Side} from '../lib/domain/live-score';
import {clock,useLiveScores,useSecondClock} from '../lib/client/live-score';
import type {SchedulingContext} from './event-scheduling';
import './referee-console.css';

/** Every court of a competition at once, for an iPad by the courts (docs/LIVE_SCORING.md). It follows each referee's
 * change of ends, so names and scores sit on the side where the players stand. Refreshes every two seconds. */
export default function LiveScoreboard({e,ctx,close}:{e:Event;ctx:SchedulingContext;close:()=>void}){
 const rule=e.tournament?.scoring??defaultScoring,{scores,error}=useLiveScores(e.id,2000),now=useSecondClock(),root=useRef<HTMLDivElement>(null);
 const fixtures=e.tournament?.fixtures??[];
 const matches=ctx.data.matches.filter(m=>m.eventId===e.id&&fixtures.some(f=>f.matchId===m.id)&&(m.status==='playing'||scores[m.id]&&scores[m.id].status!=='finished'||scores[m.id]&&now-scores[m.id].updatedAt<10*60000));
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close()};window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key)},[close]);
 const full=()=>{void root.current?.requestFullscreen?.().catch(()=>{})};
 return <div className="live-board" ref={root} role="dialog" aria-modal="true" aria-label="实时比分">
  <div className="live-board-top"><div><h2>{e.title} · 实时比分</h2><small>{error||'每 2 秒自动更新'}</small></div><div className="actions"><button type="button" className="secondary" onClick={full}><Maximize2 size={16}/>全屏</button><button type="button" className="secondary" aria-label="关闭实时比分" onClick={close}><X size={18}/></button></div></div>
  {matches.length?<div className="live-board-grid">{matches.map(m=>{
   const live=scores[m.id],tally=liveTally(rule,live?.events??[]),sides:Side[]=live?.swapped?['b','a']:['a','b'];
   const court=ctx.data.bookings.find(b=>b.id===m.courtId)?.name??'场地',f=fixtures.find(f=>f.matchId===m.id)!;
   const state=!live||live.status==='ready'?'等待开始':live.status==='paused'?'暂停 · '+clock(liveElapsed(live,now)):live.status==='finished'?'已结束':clock(liveElapsed(live,now));
   return <article key={m.id} className={'live-court'+(live?.status==='playing'?' is-playing':'')}>
    <div className="live-court-head"><strong>{court}</strong><span>{f.stage==='group'?'小组赛':'淘汰赛第 '+f.round+' 轮'} · {state}</span></div>
    {sides.map(side=><div key={side} className={'live-court-row'+(tally.winner===side?' is-winner':'')}>
     <span className="name">{m[side].map(ctx.name).join(' / ')}</span>
     <span className="games">{tally.games.map((g,i)=><i key={i}>{g[side]}</i>)}</span>
     <span className="score">{tally.winner?tally.wins[side]:tally.current[side]}</span>
    </div>)}
   </article>;
  })}</div>:<p className="live-board-empty">现在没有进行中的比赛。裁判开始记分后，比分会出现在这里。</p>}
 </div>;
}
