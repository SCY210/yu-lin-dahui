'use client';
import {useEffect,useRef} from 'react';
import {Maximize2,X} from 'lucide-react';
import type {Event,Match} from '../lib/domain/types';
import {defaultScoring,matchRule} from '../lib/domain/tournament';
import {liveElapsed,liveTally,type Side} from '../lib/domain/live-score';
import {clock,useLiveScores,useSecondClock} from '../lib/client/live-score';
import type {SchedulingContext} from './event-scheduling';
import {Avatar} from './avatar';
import './live-scoreboard.css';

/** Every court of a competition at once, for an iPad by the courts (docs/LIVE_SCORING.md). Each court reads left to
 * right: one side's players with avatars, the score, the other side. It follows each referee's change of ends, so the
 * sides sit where the players stand. Refreshes every two seconds; it uses the app's own theme colours. */
export default function LiveScoreboard({e,ctx,close}:{e:Event;ctx:SchedulingContext;close:()=>void}){
 const remote=useLiveScores(e.id,2000,!ctx.live),now=useSecondClock(),root=useRef<HTMLDivElement>(null);
 const scores=ctx.live?.scores??remote.scores,error=ctx.live?'':remote.error;
 const fixtures=e.tournament?.fixtures??[];
 const matches=ctx.data.matches.filter(m=>m.eventId===e.id&&fixtures.some(f=>f.matchId===m.id)&&(m.status==='playing'||scores[m.id]&&scores[m.id].status!=='finished'||scores[m.id]&&now-scores[m.id].updatedAt<10*60000));
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close()};window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key)},[close]);
 const full=()=>{void root.current?.requestFullscreen?.().catch(()=>{})};
 const team=(m:Match,side:Side,winner:boolean,align:'left'|'right')=><div className={'board-team is-'+align+(winner?' is-winner':'')}>
  <div className="board-avatars">{m[side].map(id=><Avatar key={id} p={ctx.data.players.find(p=>p.id===id)} size="board-avatar"/>)}</div>
  <div className="board-names">{m[side].map(id=><span key={id}>{ctx.name(id)}</span>)}</div>
 </div>;
 return <div className="live-board" ref={root} role="dialog" aria-modal="true" aria-label="实时比分">
  <header className="live-board-top"><div><h2>{e.title}</h2><small>{error||'实时比分 · 每 2 秒自动更新'}</small></div><div className="actions"><button type="button" className="secondary" onClick={full}><Maximize2 size={16}/>全屏</button><button type="button" className="secondary" aria-label="关闭实时比分" onClick={close}><X size={18}/></button></div></header>
  {matches.length?<div className="live-board-grid">{matches.map(m=>{
   const rule=matchRule(e.tournament,m.id)??defaultScoring,live=scores[m.id],tally=liveTally(rule,live?.events??[]),[left,right]:Side[]=live?.swapped?['b','a']:['a','b'];
   const court=ctx.data.bookings.find(b=>b.id===m.courtId)?.name??'场地',f=fixtures.find(f=>f.matchId===m.id)!;
   const state=!live||live.status==='ready'?'等待开始':live.status==='paused'?'暂停':live.status==='finished'?'已结束':'进行中';
   const shown=(side:Side)=>tally.winner?tally.wins[side]:tally.current[side];
   return <article key={m.id} className={'board-court is-'+(live?.status??'ready')}>
    <div className="board-court-head"><strong>{court}</strong><span>{f.stage==='group'?'小组赛':'淘汰赛第 '+f.round+' 轮'}</span><span className="board-state">{state}{live?.startedAt?' · '+clock(liveElapsed(live,now)):''}</span></div>
    <div className="board-court-body">
     {team(m,left,tally.winner===left,'left')}
     <div className="board-score" aria-label={'比分 '+shown(left)+' 比 '+shown(right)}>
      <div className="board-digits"><b className={tally.winner===left?'is-winner':''}>{shown(left)}</b><i>:</i><b className={tally.winner===right?'is-winner':''}>{shown(right)}</b></div>
      {tally.games.length>0&&<div className="board-games">{tally.games.map((g,i)=><span key={i}>{g[left]}-{g[right]}</span>)}</div>}
      {tally.winner&&<small className="board-final">比赛结束 · 局分</small>}
     </div>
     {team(m,right,tally.winner===right,'right')}
    </div>
   </article>;
  })}</div>:<p className="live-board-empty">现在没有进行中的比赛。裁判开始记分后，比分会出现在这里。</p>}
 </div>;
}
