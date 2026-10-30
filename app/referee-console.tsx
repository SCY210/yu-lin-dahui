'use client';
import {useRef,useState} from 'react';
import {ArrowLeftRight,Pause,Play,ShieldAlert,X} from 'lucide-react';
import type {Event,Match} from '../lib/domain/types';
import {defaultScoring,scoringLabel} from '../lib/domain/tournament';
import {cardRules,finalGames,liveElapsed,liveTally,type CardKind,type LiveOp,type LiveOpBody,type LiveScore,type Side} from '../lib/domain/live-score';
import {clock,sendLiveOp,useLiveScores,useSecondClock} from '../lib/client/live-score';
import type {SchedulingContext} from './event-scheduling';
import './referee-console.css';

const cardKinds:CardKind[]=['warning','yellow','red','black'];

/** The referee's phone for one court (docs/LIVE_SCORING.md): tap a side's score for a point, double-tap it to take
 * that side's last point back. Start, pause, change ends and cards sit below; once a side has won, the result is
 * submitted as the match score. */
export default function RefereeConsole({e,m,ctx,close}:{e:Event;m:Match;ctx:SchedulingContext;close:()=>void}){
 const rule=e.tournament?.scoring??defaultScoring,{scores,error:pollError,put}=useLiveScores(e.id,3000),now=useSecondClock();
 const live:LiveScore|undefined=scores[m.id],tally=liveTally(rule,live?.events??[]),status=live?.status??'ready';
 const [error,setError]=useState(''),[sheet,setSheet]=useState(false),[cardSide,setCardSide]=useState<Side>('a'),[cardPlayer,setCardPlayer]=useState(''),[cardKind,setCardKind]=useState<CardKind>('warning');
 const queue=useRef(Promise.resolve()),pending=useRef<{side:Side;timer:ReturnType<typeof setTimeout>}|null>(null);
 // Operations go out one at a time in tap order; each reply is the newest state.
 const run=(op:LiveOpBody)=>{queue.current=queue.current.then(async()=>{try{put(await sendLiveOp({...op,matchId:m.id} as LiveOp));setError('')}catch(err){setError(err instanceof Error?err.message:'操作失败，请重试')}})};
 const tap=(side:Side)=>{
  if(pending.current?.side===side){clearTimeout(pending.current.timer);pending.current=null;run({op:'undo',side});return}
  if(pending.current){clearTimeout(pending.current.timer);run({op:'point',side:pending.current.side})}
  pending.current={side,timer:setTimeout(()=>{pending.current=null;run({op:'point',side})},280)};
 };
 const sides:Side[]=live?.swapped?['b','a']:['a','b'];
 const team=(side:Side)=>m[side].map(ctx.name).join(' / ');
 const cards=(side:Side)=>(live?.events??[]).flatMap(x=>x.type==='card'&&x.side===side?[x]:[]);
 const submit=()=>{const games=finalGames(rule,tally);ctx.send('score',{matchId:m.id,a:games[0].a,b:games[0].b,games,reason:'裁判实时记分'});};
 const elapsed=live?liveElapsed(live,now):0,court=ctx.data.bookings.find(b=>b.id===m.courtId)?.name??'比赛场地';
 return <div className="referee-console" role="dialog" aria-modal="true" aria-label={'裁判记分 · '+court}>
  <header className="referee-top">
   <button type="button" className="referee-icon" aria-label="关闭裁判记分" onClick={close}><X size={22}/></button>
   <div><strong>{court}</strong><small>{scoringLabel(rule)}</small></div>
   <span className={'referee-clock is-'+status} aria-label="比赛用时">{clock(elapsed)}{status==='paused'&&' · 暂停'}</span>
  </header>
  {(tally.changeEnds||tally.interval)&&status==='playing'&&<p className="referee-banner" role="status">{tally.changeEnds?'决胜局到 '+Math.ceil(rule.points/2)+' 分：交换场地':'到 11 分：局间 60 秒技术暂停'}</p>}
  {tally.winner&&<p className="referee-banner is-final" role="status">{team(tally.winner)} 获胜{tally.disqualified?'（对方黑牌取消资格）':''}</p>}
  <div className="referee-court">{sides.map(side=><button type="button" key={side} className={'referee-side is-'+side} disabled={status==='ready'||status==='paused'} onClick={()=>tap(side)} aria-label={team(side)+' 当前 '+tally.current[side]+' 分，点一下加 1 分，连点两下撤销上一分'}>
   <span className="referee-team">{team(side)}</span>
   <span className="referee-games">{tally.games.map((g,i)=><i key={i}>{g[side]}</i>)}<b>{'●'.repeat(tally.wins[side])}</b></span>
   <span className="referee-score">{tally.winner?tally.wins[side]:tally.current[side]}</span>
   <span className="referee-cards">{cards(side).map((c,i)=><i key={i} className={'card-chip is-'+c.kind} title={cardRules[c.kind].label}/>)}</span>
  </button>)}</div>
  <p className="referee-help">点比分 +1 · 连点两下撤销该方上一分</p>
  {(error||pollError)&&<p className="referee-error" role="alert">{error||pollError}</p>}
  <footer className="referee-actions">
   {status==='ready'&&<button type="button" className="primary" onClick={()=>run({op:'start'})}><Play size={18}/>开始比赛</button>}
   {status==='playing'&&<button type="button" className="secondary" onClick={()=>run({op:'pause'})}><Pause size={18}/>暂停</button>}
   {status==='paused'&&<button type="button" className="primary" onClick={()=>run({op:'resume'})}><Play size={18}/>继续比赛</button>}
   <button type="button" className="secondary" onClick={()=>run({op:'swap'})}><ArrowLeftRight size={18}/>交换场地</button>
   <button type="button" className="secondary" disabled={status==='ready'||status==='finished'} onClick={()=>setSheet(true)}><ShieldAlert size={18}/>判罚</button>
   {status==='finished'&&m.status!=='complete'&&<button type="button" className="primary" disabled={ctx.busy} onClick={submit}>提交比分</button>}
   {m.status==='complete'&&<span className="referee-done">比分已提交</span>}
  </footer>
  {sheet&&<div className="referee-sheet" role="dialog" aria-label="判罚">
   <h3>判罚</h3>
   <div className="referee-sheet-sides">{(['a','b'] as Side[]).map(side=><button type="button" key={side} aria-pressed={cardSide===side} className={cardSide===side?'primary':'secondary'} onClick={()=>{setCardSide(side);setCardPlayer('')}}>{team(side)}</button>)}</div>
   {m[cardSide].length>1&&<label>球员<select value={cardPlayer} onChange={event=>setCardPlayer(event.target.value)}><option value="">整队</option>{m[cardSide].map(id=><option key={id} value={id}>{ctx.name(id)}</option>)}</select></label>}
   <div className="referee-card-kinds">{cardKinds.map(kind=><label key={kind} className={'referee-card-kind is-'+kind}><input type="radio" name="card" checked={cardKind===kind} onChange={()=>setCardKind(kind)}/><span className={'card-chip is-'+kind} aria-hidden="true"/><span><strong>{cardRules[kind].label} · {cardRules[kind].effect}</strong><small>{cardRules[kind].detail}</small></span></label>)}</div>
   <div className="referee-sheet-actions">
    <button type="button" className="primary" onClick={()=>{run({op:'card',side:cardSide,kind:cardKind,...(cardPlayer?{playerId:cardPlayer}:{})});setSheet(false)}}>出示{cardRules[cardKind].label}</button>
    <button type="button" className="ghost" disabled={!(live?.events??[]).some(x=>x.type==='card')} onClick={()=>{run({op:'uncard'});setSheet(false)}}>撤销上一张牌</button>
    <button type="button" className="ghost" onClick={()=>setSheet(false)}>取消</button>
   </div>
  </div>}
 </div>;
}
