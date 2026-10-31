'use client';
import {useEffect,useRef} from 'react';
import {Maximize2,X} from 'lucide-react';
import type {Event,Match} from '../lib/domain/types';
import {defaultScoring,matchRule} from '../lib/domain/tournament';
import {cardRules,currentBreak,liveElapsed,liveTally,sidesSwapped,type Side} from '../lib/domain/live-score';
import {clock,useLiveScores,useSecondClock} from '../lib/client/live-score';
import type {SchedulingContext} from './event-scheduling';
import {Avatar} from './avatar';
import TournamentBracket from './tournament-bracket';
import {groupStandings,tournamentFormat} from '../lib/domain/tournament';
import './live-scoreboard.css';

/** Every court of a competition at once, for an iPad by the courts (docs/LIVE_SCORING.md). Each court reads left to
 * right: one side's players with avatars, the score, the other side. It follows each referee's change of ends, so the
 * sides sit where the players stand. Refreshes every two seconds; it uses the app's own theme colours. */
export default function LiveScoreboard({e,ctx,close}:{e:Event;ctx:SchedulingContext;close:()=>void}){
 const remote=useLiveScores(e.id,2000,!ctx.live),now=useSecondClock(),root=useRef<HTMLDivElement>(null);
 const scores=ctx.live?.scores??remote.scores,error=ctx.live?'':remote.error;
 const fixtures=e.tournament?.fixtures??[];
 // Only matches in play: a finished match leaves the board, however its score was entered.
 const matches=ctx.data.matches.filter(m=>m.eventId===e.id&&m.status==='playing'&&fixtures.some(f=>f.matchId===m.id)&&scores[m.id]?.status!=='finished');
 const t=e.tournament,groupPhase=t?.phase==='groups';
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close()};window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key)},[close]);
 const full=()=>{void root.current?.requestFullscreen?.().catch(()=>{})};
 const team=(m:Match,side:Side,winner:boolean,align:'left'|'right')=><div className={'board-team is-'+align+(winner?' is-winner':'')}>
  <div className="board-avatars">{m[side].map(id=><Avatar key={id} p={ctx.data.players.find(p=>p.id===id)} size="board-avatar"/>)}</div>
  <div className="board-names">{m[side].map(id=><span key={id}>{ctx.name(id)}</span>)}</div>
 </div>;
 return <div className="live-board" ref={root} role="dialog" aria-modal="true" aria-label="实时比分">
  <header className="live-board-top"><div><h2>{e.title}</h2><small>{error||'实时比分 · 每 2 秒自动更新'}</small></div><div className="actions"><button type="button" className="secondary" onClick={full}><Maximize2 size={16}/>全屏</button><button type="button" className="secondary" aria-label="关闭实时比分" onClick={close}><X size={18}/></button></div></header>
  {t&&t.fixtures.some(f=>f.stage==='knockout')&&<section className="board-panel"><h3>淘汰赛对阵图</h3><TournamentBracket t={t} data={ctx.data} name={ctx.name} compact/></section>}
  {t&&groupPhase&&<section className="board-panel board-groups">{t.groups.map((_,g)=><div key={g} className="board-group"><h3>{tournamentFormat(t)==='round-robin'?'循环赛':String.fromCharCode(65+g)+' 组'}</h3><ol>{groupStandings(t,ctx.data,g).map((row,i)=><li key={row.id} className={tournamentFormat(t)==='groups'&&i<t.advance?'is-qualifying':''}><span>{i+1}</span><strong>{t.teams.find(x=>x.id===row.id)?.players.map(ctx.name).join(' / ')}</strong><small>{row.wins} 胜 {row.losses} 负</small></li>)}</ol></div>)}</section>}
  {matches.length?<div className="live-board-grid">{matches.map(m=>{
   const rule=matchRule(e.tournament,m.id)??defaultScoring,live=scores[m.id],tally=liveTally(rule,live?.events??[]),[left,right]:Side[]=sidesSwapped(live,tally)?['b','a']:['a','b'],pause=currentBreak(tally,now);
   // Every warning and card of the match, oldest first, with the player when the referee named one.
   const cards=(live?.events??[]).flatMap(x=>x.type==='card'?[x]:[]);
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
    {pause&&<div className="board-break" role="status"><strong>局间休息 {clock(pause.until-now)}</strong><span>选手交换场地</span></div>}
    {cards.length>0&&<ul className="board-cards">{cards.map((c,i)=><li key={i}><i className={'card-chip is-'+c.kind} aria-hidden="true"/><strong>{cardRules[c.kind].label}</strong><span>{c.playerId?ctx.name(c.playerId):m[c.side].map(ctx.name).join(' / ')} · {cardRules[c.kind].effect}</span></li>)}</ul>}
   </article>;
  })}</div>:<p className="live-board-empty">现在没有进行中的比赛。下一场开赛后，比分会出现在这里。</p>}
 </div>;
}
