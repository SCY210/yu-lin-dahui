'use client';
import type {LiveOp,LiveScore} from '../lib/domain/live-score';
import PointsAttendance from './points-attendance';
import EventTournament from './event-tournament';
import {useState,type ReactNode} from 'react';
import {Check,Shuffle,CalendarDays,Swords,Zap} from 'lucide-react';
import type {ClubData} from '../lib/contracts/club';
import type {Event,Match,Round,State} from '../lib/domain/types';
import {isPlannedLineup,editableMatchLineup,roundBenchIds,roundLineupSnapshot,type RoundLineup} from '../lib/domain/round-lineup';
import type {Field} from './form-fields';
import {dt,epoch,hm,labels,halfTimed,number,choice} from './form-fields';
import {ceilHalfHour} from '../lib/time-planning';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {liveActivityAvailable} from '../lib/domain/live-window';
import {canRecordScore,canScheduleEvent} from '../lib/domain/permissions';
import {isPractice,eventFormat,courtPlayers} from '../lib/domain/match-format';
import {pointsWindow,roundMinutes} from '../lib/domain/points-window';
import {eventCourtCount,pendingSchedulingIds,plannedPlayStarted,recommendedSchedulingMode,schedulingMode,schedulingLabels,type SchedulingMode} from '../lib/domain/scheduling';
import EventLivePlay from './event-live-play';
import {EventLockedPairs} from './event-points-plan';
import MatchCard from './match-card';
import {useMatchFocus} from './match-focus';
import GroupPlayer from './group-player';
import Disclosure from './disclosure';
import './event-scheduling.css';
import MatchPlayerFilter from './match-player-filter';
import {eventMatchPlayerIds,matchIncludesPlayer} from '../lib/client/match-player-filter';
import {currentRoundSelection} from '../lib/client/lineup-sync';
type FormOpen=(title:string,action:string,values:Record<string,unknown>,fields:Field[],convert?:(v:Record<string,unknown>)=>Record<string,unknown>,description?:string)=>void;
export type SchedulingContext={/** The competition sandbox keeps live scores in its own document (lib/competition-simulation.ts). */live?:{scores:Record<string,LiveScore>;send:(op:LiveOp)=>Promise<LiveScore>};matchPlayerId?:string;data:ClubData;name:(id:string)=>string;admin:boolean;busy:boolean;readOnly?:boolean;open:FormOpen;send:(action:string,payload:Record<string,unknown>)=>void;openProfile?:(id:string)=>void;setDanger:(value:{action:string;payload:Record<string,unknown>;title:string;description:string;reason:string})=>void};
/** 排场方式: one token per way with the recommended one sealed 荐, and the compact player filter beside them
 * (docs/COMPACT_MOBILE_LAYOUT.md). Organisers tap the other token to switch; others see which way is in use. */
function SchedulingModeStrip({mode,recommended,locked,unavailable,change,filter}:{mode:SchedulingMode;recommended?:SchedulingMode;locked:boolean;unavailable:(mode:SchedulingMode)=>boolean;change:(next:SchedulingMode)=>void;filter:ReactNode}){
 const options:SchedulingMode[]=mode==='round'?['planned','round','live']:['planned','live'];
 const short:Record<SchedulingMode,string>={planned:'预排',live:'实时',round:'逐轮'};
 const icon=(value:SchedulingMode)=>value==='planned'?<CalendarDays size={15} aria-hidden="true"/>:value==='live'?<Zap size={15} aria-hidden="true"/>:<Shuffle size={15} aria-hidden="true"/>;
 return <section className="scheduling-strip" aria-label="排场方式">
  <div className="scheduling-tokens" role="radiogroup" aria-label="排场方式">
   {options.map(value=>{const current=value===mode;return <button type="button" role="radio" aria-checked={current} key={value} className={'scheduling-token'+(current?' is-current':'')} disabled={!current&&(locked||unavailable(value))} aria-label={schedulingLabels[value]+(recommended===value?'（推荐）':'')} title={schedulingLabels[value]+(recommended===value?'（推荐）':'')} onClick={()=>{if(!current)change(value)}}>{icon(value)}<span>{short[value]}</span>{recommended===value&&<i className="scheduling-token-seal" aria-hidden="true">荐</i>}</button>})}
  </div>
  {filter}
 </section>;
}
const compareRounds=(a:Round,b:Round)=>(a.pointsSlot!==undefined&&b.pointsSlot!==undefined?a.pointsSlot-b.pointsSlot:0)||a.start-b.start||a.id.localeCompare(b.id);
export default function EventScheduling({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const now=useActivityClock(e),active=!['ended','cancelled','draft'].includes(eventStatusAt(e,now)),mode=schedulingMode(ctx.data,e),manager=!ctx.readOnly&&canScheduleEvent(ctx.data.me,e);
 const liveAfterEnd=now>=e.end&&liveActivityAvailable(e,now);
 const [selection,setSelection]=useState({eventId:e.id,playerId:''});
 const ids=eventMatchPlayerIds(ctx.data,e),playerId=selection.eventId===e.id&&ids.includes(selection.playerId)?selection.playerId:'';
 // A link (home score button, reminder) or the game in progress scrolls into view (docs/JUMP_TO_MATCH.md).
 const jump=useMatchFocus(ctx.data,e,!!playerId);
 const filteredContext={...ctx,matchPlayerId:playerId};
 const filter=<MatchPlayerFilter ids={ids} value={playerId} myId={ctx.data.me.playerId} name={ctx.name} onChange={id=>setSelection({eventId:e.id,playerId:id})}/>;
 const compactFilter=<MatchPlayerFilter compact ids={ids} value={playerId} myId={ctx.data.me.playerId} name={ctx.name} onChange={id=>setSelection({eventId:e.id,playerId:id})}/>;
 const cancelled=ctx.data.rounds.filter(r=>r.eventId===e.id&&r.status==='cancelled'&&(!playerId||ctx.data.matches.some(m=>m.roundId===r.id&&matchIncludesPlayer(m,playerId))));
 if(isPractice(e))return null;
 if(e.tournament)return <>{filter}<EventTournament key={e.id} e={e} ctx={filteredContext}/></>;
 const change=(next:SchedulingMode)=>ctx.open('切换排场方式','schedulingMode',{eventId:e.id,mode:next,expectedMode:mode,expectedPendingIds:pendingSchedulingIds(ctx.data,e.id)},[],undefined,
  '切换为「'+schedulingLabels[next]+'」。已完成比分和正在打的对局保持不变；尚未开打的旧安排会撤销，再按新方式安排。');
 // Organisers who can still choose see the recommended way sealed 荐 on its token.
 // This activity's own numbers: confirmed players against its distinct courts (same name and venue count once).
 const advice=manager&&active?recommendedSchedulingMode(eventCourtCount(ctx.data,e)):undefined;
 return <div className={'event-scheduling'+(eventStatusAt(e,now)==='ended'?' is-ended':'')}><PointsAttendance e={e} ctx={ctx}/><SchedulingModeStrip mode={mode} recommended={advice?.mode} locked={ctx.busy||!manager||(!active&&!liveAfterEnd)} unavailable={value=>value==='round'||(!active&&value!=='live')} change={change} filter={compactFilter}/>
  {mode==='live'?<EventLivePlay key={e.id+':'+playerId} e={e} ctx={filteredContext}/>:<EventRounds key={e.id+':'+playerId} e={e} ctx={filteredContext} mode={mode} now={now} focusRoundId={jump.roundId}/>}
  {cancelled.length>0&&<Disclosure key={playerId} label={'已撤销轮次 · '+cancelled.length}>{cancelled.slice().sort(compareRounds).map(r=><section key={r.id}><h3>{hm(r.start)} · 已撤销</h3><div className="courts-grid">{ctx.data.matches.filter(m=>m.roundId===r.id&&matchIncludesPlayer(m,playerId)).map(m=><MatchCard key={m.id} m={m} ctx={{...ctx,readOnly:true}}/>)}</div></section>)}</Disclosure>}
  {/* 锁组 sits at the bottom: rarely changed once set (docs/LOCKED_PAIRS.md). 上场意愿 is only in live play (app/event-live-play.tsx). */}
  <EventLockedPairs e={e} ctx={ctx} now={now}/>
 </div>;
}
export function EventRounds({e,ctx,mode,now,focusRoundId}:{e:Event;ctx:SchedulingContext;mode:'planned'|'round';now:number;focusRoundId?:string}){
 const {data,send,busy,open,setDanger}=ctx,[selected,setSelected]=useState<{roundId:string;playerId:string;lineup:RoundLineup}|null>(null);
 /** The round shown from the tab strip of rounds not in progress; empty means the next round. */
 const [roundTab,setRoundTab]=useState('');
 const currentSelected=currentRoundSelection(selected,data,mode==='planned');
 const playerId=ctx.matchPlayerId??'';
 const manager=!ctx.readOnly&&canScheduleEvent(data.me,e),active=!['ended','cancelled','draft'].includes(eventStatusAt(e,now)),editable=manager&&active;
 const confirmed=data.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed').length;
 const rounds=data.rounds.filter(r=>r.eventId===e.id&&r.status!=='cancelled').slice().sort(compareRounds),pending=rounds.filter(r=>['draft','published'].includes(r.status)),next=pending[0];
 const playing=data.matches.some(m=>m.eventId===e.id&&m.status==='playing'),fixed=e.pointsChoice?.selectedMode==='fixed';
 const hasStarted=data.matches.some(m=>m.eventId===e.id&&['playing','complete','forfeit'].includes(m.status));
 const remaining=Math.floor((e.end-Math.max(e.start,now))/60000),canGenerate=editable&&!busy&&!playing&&!pending.length&&remaining>=5;
 const appendAt=Math.max(e.start,now,...rounds.map(r=>r.start+r.duration*60000));
 // Once the activity's time is full, or after its end, 临时加一轮 keeps going as overtime (lib/domain/points-plan.ts).
 const overtime=Math.floor((e.end-appendAt)/60000)<5,afterEnd=manager&&now>=e.end&&liveActivityAvailable(e,now);
 const canAppend=(editable||afterEnd)&&!busy&&rounds.some(r=>r.pointsSlot!==undefined);
 const appendRound=<button type="button" className="secondary" disabled={!canAppend} onClick={()=>send('pointsNext',{eventId:e.id,expectedRoundIds:rounds.map(r=>r.id).sort()})}><Shuffle size={17}/>{overtime?'临时加一轮 · 加时':'临时加一轮'}</button>;
 const generate=()=>open('生成下一轮','generate',{eventId:e.id,at:Math.max(e.start,now),duration:Math.min(roundMinutes(e),remaining,90),seed:Math.floor(Math.random()*1000000)+1},[{...number('duration','每轮预计时长 · 分钟'),min:5,max:Math.min(90,remaining)}],undefined,'生成后可交换球友、调整场地，再确认发布。');
 const arrange=()=>{const window=pointsWindow(e),at=ceilHalfHour(Math.max(e.start,now)),max=Math.min(720,Math.floor((e.end-at)/60000));open('预排剩余赛程','planPoints',{eventId:e.id,at:dt(at),pointsMinutes:Math.max(5,Math.min(max,Math.round((window.end-at)/60000))),roundMinutes:window.roundMinutes,pairing:eventFormat(e)==='singles'?'rotate':e.pointsChoice?.selectedMode??'rotate',seed:Math.floor(Math.random()*1000000)+1},[
  halfTimed('at','赛程开始'),{...number('pointsMinutes','赛程时长 · 分钟'),min:5,max},{...number('roundMinutes','每轮预计时长 · 分钟'),min:5,max:60},...(eventFormat(e)==='singles'||hasStarted?[]:[choice('pairing','搭档方式',[['rotate','每轮换搭档'],['fixed','固定搭档']])])
 ],v=>({...v,at:epoch(String(v.at))}),'按接龙参加时段和可用场地预排剩余对局，不修改已完成比分。重新预排会替换尚未开打的轮次。')};
 // 开始比赛 (pointsPlay, AGENTS.md C2): the clock plans and publishes, and the first games wait for anyone signed up,
 // the organiser or an administrator. With nothing planned yet, only an organiser's press plans the rest first.
 const awaitingPlay=active&&now>=e.start&&now<e.end&&!plannedPlayStarted(data,e)&&!ctx.readOnly&&(manager||canRecordScore(data,data.me,e));
 const unplanned=!pending.length&&!rounds.length,playable=pending.some(r=>r.status==='published')||(manager&&unplanned);
 const swap=(r:Round,id:string)=>{if(!currentSelected||currentSelected.roundId!==r.id){setSelected({roundId:r.id,playerId:id,lineup:roundLineupSnapshot(data.matches.filter(m=>m.roundId===r.id))});return}if(currentSelected.playerId!==id)send('swap',{roundId:r.id,p1:currentSelected.playerId,p2:id,expectedLineup:currentSelected.lineup});setSelected(null)};
 return <>
  {awaitingPlay&&(playable||pending.length>0)&&<section className="card planned-play-start" aria-label="开始比赛"><div><strong>{unplanned?'道友到齐即可开战':'赛程已排定，静候开战'}</strong><p className="hint">{!playable?'赛程还是草稿，宗主或副宗主发布后才能开始。':unplanned?'还没有赛程：点「开始比赛」会先按接龙排好，再开打第一局。':'第一局不会自己开打。道友到齐后点「开始比赛」，各片场按赛程开打；之后每片场录分后自动接下一局。'}</p></div>{playable&&<button type="button" className="primary" disabled={busy} onClick={()=>send('pointsPlay',{eventId:e.id})}><Swords size={17}/>开始比赛</button>}</section>}
  {selected&&!currentSelected&&<p className="connection-note" role="status">本轮阵容已更新，请重新选择要交换的两位球友。</p>}
  {/* Why there is no schedule yet: too few confirmed players, or simply not planned yet (the clock plans it at the start). */}
  {!rounds.length&&<p className="empty">{confirmed<courtPlayers(e)?'正式接龙满 '+courtPlayers(e)+' 人后才能排赛程。':editable?(mode==='planned'?'还没有赛程：可以点下面的「预排赛程」现在排好；不排的话，活动开始时会自动排好。':'还没有轮次：可以点下面的「生成下一轮」。'):'赛程还没排出，活动开始时会自动排好。'}</p>}
  {playerId&&!rounds.some(r=>data.matches.some(m=>m.roundId===r.id&&matchIncludesPlayer(m,playerId)))&&<p className="match-filter-empty">这位球友暂时没有对局，轮休不算参赛。</p>}
  {(()=>{
   const roundView=(r:Round,index:number,tabbed=false)=>{const allMatches=data.matches.filter(m=>m.roundId===r.id&&matchIncludesPlayer(m,playerId));if(playerId&&!allMatches.length)return null;const matches:Match[]=allMatches.filter(m=>m.status!=='cancelled'),withdrawn=allMatches.filter(m=>m.status==='cancelled'),changeable=manager&&(active||isPlannedLineup(e,r))&&['draft','published','playing'].includes(r.status)&&!fixed,rest=changeable?roundBenchIds(data as unknown as State,e,r,now):r.rest;const unscored=mode==='planned'&&['published','playing'].includes(r.status)?matches.filter(m=>editableMatchLineup(m,true)).length:0;
   const state=mode==='planned'&&['published','playing'].includes(r.status)?'待录分':mode==='planned'&&r.status==='complete'?'已结束':labels[r.status];
   // 对局台: a round is always open, never folded. The round picked in the tab strip has no header or frame of its own,
   // since its tab already names it; rounds shown without a tab (in progress, filtered) keep the header.
   return <section key={r.id+':'+r.status} className={'round-board is-'+r.status+(tabbed?' is-tabbed':'')} aria-label={'第 '+(index+1)+' 轮 · '+state+(mode==='planned'?'':' · '+hm(r.start))}>
   {!tabbed&&<header className="round-board-head"><strong>第 {index+1} 轮</strong><span className="round-board-state">{r.status==='playing'&&<i className="live-board-dot" aria-hidden="true"/>}{state}{unscored?' · '+unscored+' 场':''}{mode==='planned'?'':' · '+hm(r.start)}</span></header>}

   <div className="courts-grid">{matches.map(m=><MatchCard key={m.id} m={m} ctx={ctx} interactive={changeable&&editableMatchLineup(m,isPlannedLineup(e,r))} selected={currentSelected?.roundId===r.id?currentSelected.playerId:''} onSelect={id=>swap(r,id)}/>)}</div>
   {withdrawn.length>0&&<Disclosure label={'已撤销对局 · '+withdrawn.length}>{withdrawn.map(m=><MatchCard key={m.id} m={m} ctx={{...ctx,readOnly:true}}/>)}</Disclosure>}
   {rest.length>0&&<div className="rest"><strong>本轮轮休 · {rest.length} 人</strong><div className="actions">{rest.map(id=><GroupPlayer key={id} id={id} ctx={ctx} interactive={changeable} selected={currentSelected?.roundId===r.id?currentSelected.playerId:''} onSelect={id=>swap(r,id)}/>)}</div></div>}
   {editable&&<div className="actions">{r.status==='draft'&&<button type="button" className="primary" disabled={busy} onClick={()=>send('publish',{roundId:r.id})}><Check size={17}/>确认发布</button>}{['draft','published'].includes(r.status)&&<button type="button" className="ghost danger" disabled={busy} onClick={()=>setDanger({action:'cancelRound',payload:{roundId:r.id},title:'取消未开始的轮次',description:'仅撤销本轮尚未开始的对局，不修改历史比分。',reason:''})}>取消本轮</button>}</div>}
  </section>};
   // Rounds in progress always show. The others are one tab strip with one round open at a time, instead of a long
   // stack of round sections (docs/COMPACT_MOBILE_LAYOUT.md): a tapped round, or the next round when none is playing.
   // A player filter shows all.
   const playingRounds=rounds.filter(r=>r.status==='playing');
   if(playerId||rounds.length<2)return rounds.map((r,index)=>roundView(r,index));
   // The tab strip is always on top. Below it: a tapped round (tapping it again goes back), or the one a link focused,
   // else the round in progress
   // (several when planned rounds overlap), else the next round. One round shows without a header of its own.
   const picked=rounds.find(r=>r.id===roundTab)??rounds.find(r=>r.id===focusRoundId&&r.status!=='playing');
   const shown=picked?[picked]:playingRounds.length?playingRounds:[next&&rounds.includes(next)?next:rounds.at(-1)!];
   return <>
    {/* Every round, coloured by its state: green finished, red in progress, plain not started. */}
    <div className="round-tabs" role="tablist" aria-label="全部轮次">{rounds.map((r,i)=>{const selected=shown.includes(r);return <button type="button" role="tab" key={r.id} aria-selected={selected} className={'round-tab is-'+r.status+(selected?' is-selected':'')} onClick={()=>setRoundTab(roundTab===r.id?'':r.id)}>第 {i+1} 轮<small>{r.status==='complete'?'已结束':r.status==='playing'?'进行中':r.status==='draft'?'草稿':'待开始'}</small></button>})}</div>
    {shown.map(r=>roundView(r,rounds.indexOf(r),shown.length===1))}</>;
  })()}
  {/* 赛程管理 sits below the rounds, above 上场意愿: a scroll with the organiser's actions; members see nothing here. */}
  {(editable||(afterEnd&&mode==='planned'&&rounds.some(r=>r.pointsSlot!==undefined)))&&<section className="schedule-scroll" aria-label={mode==='planned'?'预排赛程':'逐轮安排'}>
   <header><strong>{mode==='planned'?'预排赛程':'逐轮安排'}</strong><span className="badge">{rounds.length} 轮</span></header>
   <div className="schedule-scroll-actions">{!editable?appendRound:mode==='planned'?<><button type="button" className="primary" disabled={busy||playing||Math.floor((e.end-ceilHalfHour(Math.max(e.start,now)))/60000)<5} onClick={arrange}><CalendarDays size={17}/> {rounds.length?'重新预排剩余赛程':'预排赛程'}</button>{rounds.some(r=>r.pointsSlot!==undefined)&&appendRound}{pending.some(r=>r.status==='draft')&&<button type="button" className="secondary" disabled={busy||playing} onClick={()=>send('publishPoints',{eventId:e.id})}><Check size={17}/>发布全部预排</button>}</>:<button type="button" className="primary" disabled={!canGenerate} onClick={generate}><Shuffle size={17}/>生成下一轮</button>}</div>
   {mode==='planned'?<p className="hint">未录分的预排对局可随时换人；录入比分后结束本局。{overtime?'时间已排满，再加的轮次会超过活动结束时间，沿用最后时段的名单和场地。':''}</p>:<p className="hint">{playing?'每片场地录分后自动接续已发布的下一场；球员尚在其他场地比赛时，下一场会等待。':pending.length?'当前已有未开打轮次，确认发布后点「开始比赛」开打。':'每轮结束后再生成，保留公平轮休与实力平衡。'}</p>}
  </section>}
 </>;
}
