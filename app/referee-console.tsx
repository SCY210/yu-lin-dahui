'use client';
import {useEffect,useRef,useState} from 'react';
import {Pause,Play,ShieldAlert,X} from 'lucide-react';
import type {Event,Match} from '../lib/domain/types';
import {defaultScoring,matchRule,scoringLabel} from '../lib/domain/tournament';
import {cardRules,currentBreak,finalGames,liveElapsed,liveTally,sidesSwapped,type CardKind,type LiveOp,type LiveOpBody,type LiveScore,type Side} from '../lib/domain/live-score';
import {clock,sendLiveOp,useLiveScores,useSecondClock} from '../lib/client/live-score';
import type {SchedulingContext} from './event-scheduling';
import {showError} from './error-dialog';
import './referee-console.css';

const cardKinds:CardKind[]=['warning','yellow','red','black'];
const submitDelay=5;

/** The referee's phone for one court (docs/LIVE_SCORING.md): tap a side's score for a point, double-tap it to take
 * that side's last point back. At the midpoint of a game (11 of 21) a 60-second break starts, the players change ends
 * and the page swaps the sides by itself. When a side has won, the result is submitted automatically after a few
 * seconds, unless the last point is taken back first. */
export default function RefereeConsole({e,m,ctx,close,onNext}:{e:Event;m:Match;ctx:SchedulingContext;close:()=>void;onNext?:(matchId:string)=>void}){
 // The sandbox passes its own scores and transport in ctx.live; otherwise the live score endpoint is polled.
 const rule=matchRule(e.tournament,m.id)??defaultScoring,remote=useLiveScores(e.id,3000,!ctx.live),now=useSecondClock();
 const scores=ctx.live?.scores??remote.scores,put=ctx.live?()=>{}:remote.put,transport=ctx.live?.send??sendLiveOp;
 const live:LiveScore|undefined=scores[m.id],tally=liveTally(rule,live?.events??[]),status=live?.status??'ready';
 const [sheet,setSheet]=useState(false),[cardSide,setCardSide]=useState<Side>('a'),[cardPlayer,setCardPlayer]=useState(''),[cardKind,setCardKind]=useState<CardKind>('warning'),[skipped,setSkipped]=useState(0),[countdown,setCountdown]=useState<number|null>(null);
 // The card just given, shown full screen so the referee can hold the phone up like the real card.
 const [shown,setShown]=useState<{kind:CardKind;side:Side;playerId?:string}|null>(null);
 const queue=useRef(Promise.resolve()),pending=useRef<{side:Side;timer:ReturnType<typeof setTimeout>}|null>(null),submitted=useRef('');
 // Operations go out one at a time in tap order; each reply is the newest state. Errors open the error dialog.
 const run=(op:LiveOpBody)=>{queue.current=queue.current.then(async()=>{try{put(await transport({...op,matchId:m.id} as LiveOp))}catch(err){showError(err instanceof Error?err.message:'操作失败，请重试')}})};
 const pause=currentBreak(tally,now),resting=!!pause&&pause.at!==skipped,winner=tally.winner;
 const tap=(side:Side)=>{
  if(pending.current?.side===side){clearTimeout(pending.current.timer);pending.current=null;run({op:'undo',side});return}
  if(resting)return;
  if(pending.current){clearTimeout(pending.current.timer);run({op:'point',side:pending.current.side})}
  // After the winning point a single tap does nothing; only a double tap (undo) still counts.
  pending.current={side,timer:setTimeout(()=>{pending.current=null;if(!winner)run({op:'point',side})},280)};
 };
 // The result goes in by itself a few seconds after the last point; taking that point back cancels it.
 const key=winner?m.id+':'+JSON.stringify(finalGames(rule,tally)):'';
 useEffect(()=>{
  if(!winner||m.status==='complete'||submitted.current===key){setCountdown(null);return}
  let left=submitDelay;setCountdown(left);
  const timer=setInterval(()=>{left--;setCountdown(left);if(left>0)return;clearInterval(timer);submitted.current=key;const games=finalGames(rule,tally);ctx.send('score',{matchId:m.id,a:games[0].a,b:games[0].b,games,reason:'裁判实时记分'})},1000);
  return ()=>clearInterval(timer);
 // eslint-disable-next-line react-hooks/exhaustive-deps -- the countdown restarts only when the finished result changes
 },[key,m.status]);
 const swapped=sidesSwapped(live,tally),sides:Side[]=swapped?['b','a']:['a','b'];
 const team=(side:Side)=>m[side].map(ctx.name).join(' / ');
 const cards=(side:Side)=>(live?.events??[]).flatMap(x=>x.type==='card'&&x.side===side?[x]:[]);
 const next=ctx.data.matches.find(x=>x.id!==m.id&&x.status==='playing'&&x.courtId===m.courtId);
 const elapsed=live?liveElapsed(live,now):0,court=ctx.data.bookings.find(b=>b.id===m.courtId)?.name??'比赛场地';
 return <div className="referee-console" role="dialog" aria-modal="true" aria-label={'裁判记分 · '+court}>
  <header className="referee-top">
   <button type="button" className="referee-icon" aria-label="关闭裁判记分" onClick={close}><X size={22}/></button>
   <div><strong>{court}</strong><small>{scoringLabel(rule)}</small></div>
   <span className={'referee-clock is-'+status} aria-label="比赛用时">{clock(elapsed)}{status==='paused'&&' · 暂停'}</span>
  </header>
  {winner&&<p className="referee-banner is-final" role="status">{team(winner)} 获胜{tally.disqualified?'（对方黑牌取消资格）':''}{m.status==='complete'?' · 比分已提交':countdown!==null&&countdown>0?' · '+countdown+' 秒后自动提交，连点两下可撤销最后一分':' · 正在提交…'}</p>}
  <div className="referee-court">{sides.map(side=><button type="button" key={side} className={'referee-side is-'+side} disabled={status==='ready'||status==='paused'||m.status==='complete'} onClick={()=>tap(side)} aria-label={team(side)+' 当前 '+tally.current[side]+' 分，点一下加 1 分，连点两下撤销上一分'}>
   <span className="referee-team">{team(side)}</span>
   <span className="referee-games">{tally.games.map((g,i)=><i key={i}>{g[side]}</i>)}<b>{'●'.repeat(tally.wins[side])}</b></span>
   <span className="referee-score"><b>{winner?tally.wins[side]:tally.current[side]}</b></span>
   <span className="referee-cards">{cards(side).map((c,i)=><i key={i} className={'card-chip is-'+c.kind} title={cardRules[c.kind].label}/>)}</span>
  </button>)}</div>
  <p className="referee-help">点比分 +1 · 连点两下撤销该方上一分 · 到 {Math.ceil(rule.points/2)} 分自动休息并交换场地</p>
  <footer className="referee-actions">
   {status==='ready'&&<button type="button" className="primary" onClick={()=>run({op:'start'})}><Play size={18}/>开始比赛</button>}
   {status==='playing'&&<button type="button" className="secondary" onClick={()=>run({op:'pause'})}><Pause size={18}/>暂停</button>}
   {status==='paused'&&<button type="button" className="primary" onClick={()=>run({op:'resume'})}><Play size={18}/>继续比赛</button>}
   <button type="button" className="secondary" disabled={status==='ready'||status==='finished'||m.status==='complete'} onClick={()=>setSheet(true)}><ShieldAlert size={18}/>判罚</button>
   {m.status==='complete'&&next&&onNext&&<button type="button" className="primary" onClick={()=>onNext(next.id)}>本场地下一场：{next.a.map(ctx.name).join(' / ')} vs {next.b.map(ctx.name).join(' / ')}</button>}
  </footer>
  {resting&&pause&&<div className="referee-break" role="alertdialog" aria-label="局间休息">
   <div className="referee-break-card"><strong>局间休息</strong><span className="referee-break-clock">{clock(pause.until-now)}</span><p>请双方选手交换场地，页面已自动交换左右。</p><button type="button" className="primary" onClick={()=>setSkipped(pause.at)}>休息结束，继续比赛</button></div>
  </div>}
  {sheet&&<div className="referee-sheet" role="dialog" aria-label="判罚">
   <h3>判罚</h3>
   <div className="referee-sheet-sides">{(['a','b'] as Side[]).map(side=><button type="button" key={side} aria-pressed={cardSide===side} className={cardSide===side?'primary':'secondary'} onClick={()=>{setCardSide(side);setCardPlayer('')}}>{team(side)}</button>)}</div>
   {m[cardSide].length>1&&<label>球员<select value={cardPlayer} onChange={event=>setCardPlayer(event.target.value)}><option value="">整队</option>{m[cardSide].map(id=><option key={id} value={id}>{ctx.name(id)}</option>)}</select></label>}
   <div className="referee-card-kinds">{cardKinds.map(kind=><label key={kind} className={'referee-card-kind is-'+kind}><input type="radio" name="card" checked={cardKind===kind} onChange={()=>setCardKind(kind)}/><span className={'card-chip is-'+kind} aria-hidden="true"/><span><strong>{cardRules[kind].label} · {cardRules[kind].effect}</strong><small>{cardRules[kind].detail}</small></span></label>)}</div>
   <div className="referee-sheet-actions">
    <button type="button" className="primary" onClick={()=>{run({op:'card',side:cardSide,kind:cardKind,...(cardPlayer?{playerId:cardPlayer}:{})});setSheet(false);setShown({kind:cardKind,side:cardSide,...(cardPlayer?{playerId:cardPlayer}:{})})}}>出示{cardRules[cardKind].label}</button>
    <button type="button" className="ghost" disabled={!(live?.events??[]).some(x=>x.type==='card')} onClick={()=>{run({op:'uncard'});setSheet(false)}}>撤销上一张牌</button>
    <button type="button" className="ghost" onClick={()=>setSheet(false)}>取消</button>
   </div>
  </div>}
  {shown&&<div className={'referee-card-show is-'+shown.kind} role="alertdialog" aria-label={'出示'+cardRules[shown.kind].label} onClick={()=>setShown(null)}>
   <div className="referee-card-face"><span>{cardRules[shown.kind].label}</span></div>
   <div className="referee-card-caption"><strong>{shown.playerId?ctx.name(shown.playerId):team(shown.side)}</strong><span>{cardRules[shown.kind].label} · {cardRules[shown.kind].effect}</span></div>
   <button type="button" className="referee-card-close" onClick={()=>setShown(null)}>收起</button>
  </div>}
 </div>;
}
