'use client';
import PointsAttendance from './points-attendance';
import EventTournament from './event-tournament';
import {useState} from 'react';
import {Play,Check,Shuffle,CalendarDays} from 'lucide-react';
import type {ClubData} from '../lib/contracts/club';
import type {Event,Match,Round,State} from '../lib/domain/types';
import {pendingMatchLineup,roundBenchIds,roundLineupSnapshot,type RoundLineup} from '../lib/domain/round-lineup';
import type {Field} from './form-fields';
import {dt,epoch,hm,labels,halfTimed,number,choice} from './form-fields';
import {ceilHalfHour} from '../lib/time-planning';
import {roundStartTime} from '../lib/client/round-start';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {canManageEvent} from '../lib/domain/permissions';
import {isPractice,eventFormat} from '../lib/domain/match-format';
import {pointsWindow} from '../lib/domain/points-window';
import {pendingSchedulingIds,schedulingMode,schedulingLabels,type SchedulingMode} from '../lib/domain/scheduling';
import EventLivePlay from './event-live-play';
import EventPointsPlan from './event-points-plan';
import MatchCard from './match-card';
import GroupPlayer from './group-player';
import Disclosure from './disclosure';
import './event-scheduling.css';
import MatchPlayerFilter from './match-player-filter';
import {eventMatchPlayerIds,matchIncludesPlayer} from '../lib/client/match-player-filter';
import {currentRoundSelection} from '../lib/client/lineup-sync';
type FormOpen=(title:string,action:string,values:Record<string,unknown>,fields:Field[],convert?:(v:Record<string,unknown>)=>Record<string,unknown>,description?:string)=>void;
export type SchedulingContext={matchPlayerId?:string;data:ClubData;name:(id:string)=>string;admin:boolean;busy:boolean;readOnly?:boolean;open:FormOpen;send:(action:string,payload:Record<string,unknown>)=>void;openProfile?:(id:string)=>void;setDanger:(value:{action:string;payload:Record<string,unknown>;title:string;description:string;reason:string})=>void};
const compareRounds=(a:Round,b:Round)=>(a.pointsSlot!==undefined&&b.pointsSlot!==undefined?a.pointsSlot-b.pointsSlot:0)||a.start-b.start||a.id.localeCompare(b.id);
export default function EventScheduling({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const now=useActivityClock(e),active=!['ended','cancelled','draft'].includes(eventStatusAt(e,now)),mode=schedulingMode(ctx.data,e),manager=!ctx.readOnly&&canManageEvent(ctx.data.me,e);
 const [selection,setSelection]=useState({eventId:e.id,playerId:''});
 const ids=eventMatchPlayerIds(ctx.data,e),playerId=selection.eventId===e.id&&ids.includes(selection.playerId)?selection.playerId:'';
 const filteredContext={...ctx,matchPlayerId:playerId};
 const filter=<MatchPlayerFilter ids={ids} value={playerId} myId={ctx.data.me.playerId} name={ctx.name} onChange={id=>setSelection({eventId:e.id,playerId:id})}/>;
 const cancelled=ctx.data.rounds.filter(r=>r.eventId===e.id&&r.status==='cancelled'&&(!playerId||ctx.data.matches.some(m=>m.roundId===r.id&&matchIncludesPlayer(m,playerId))));
 if(isPractice(e))return null;
 if(e.tournament)return <>{filter}<EventTournament key={e.id} e={e} ctx={filteredContext}/></>;
 const change=(next:SchedulingMode)=>ctx.open('切换排场方式','schedulingMode',{eventId:e.id,mode:next,expectedMode:mode,expectedPendingIds:pendingSchedulingIds(ctx.data,e.id)},[],undefined,
  '切换为「'+schedulingLabels[next]+'」。已完成比分和正在打的对局保持不变；尚未开打的旧安排会撤销，再按新方式安排。');
 return <div className="event-scheduling"><PointsAttendance e={e} ctx={ctx}/><section className="card scheduling-selector"><h2>排场方式</h2><div className="scheduling-options" role="group" aria-label="排场方式">{(['planned','round','live'] as const).map(value=><button type="button" key={value} className={mode===value?'primary':'secondary'} aria-pressed={mode===value} disabled={ctx.busy||!manager||!active||mode===value} onClick={()=>change(value)}>{schedulingLabels[value]}</button>)}</div><p className="hint">{mode==='planned'?'提前分配多轮，检查草稿后发布，再逐轮开赛、录分。':mode==='round'?'当前轮全部打完并录分后，再手动生成下一轮。':'每片场地录分后立即安排下一局，其他场地继续比赛。'}{!active?' 活动已结束或未开放，当前仅查看记录。':''}</p></section>
  {filter}
  {mode==='live'?<EventLivePlay key={e.id+':'+playerId} e={e} ctx={filteredContext}/>:<EventRounds key={e.id+':'+playerId} e={e} ctx={filteredContext} mode={mode} now={now}/>}
  {cancelled.length>0&&<Disclosure key={playerId} label={'已撤销轮次 · '+cancelled.length}>{cancelled.slice().sort(compareRounds).map(r=><section key={r.id}><h3>{hm(r.start)} · 已撤销</h3><div className="courts-grid">{ctx.data.matches.filter(m=>m.roundId===r.id&&matchIncludesPlayer(m,playerId)).map(m=><MatchCard key={m.id} m={m} ctx={{...ctx,readOnly:true}}/>)}</div></section>)}</Disclosure>}
 </div>;
}
export function EventRounds({e,ctx,mode,now}:{e:Event;ctx:SchedulingContext;mode:'planned'|'round';now:number}){
 const {data,name,send,busy,open,setDanger}=ctx,[selected,setSelected]=useState<{roundId:string;playerId:string;lineup:RoundLineup}|null>(null);
 const currentSelected=currentRoundSelection(selected,data);
 const playerId=ctx.matchPlayerId??'';
 const manager=!ctx.readOnly&&canManageEvent(data.me,e),active=!['ended','cancelled','draft'].includes(eventStatusAt(e,now)),editable=manager&&active;
 const rounds=data.rounds.filter(r=>r.eventId===e.id&&r.status!=='cancelled').slice().sort(compareRounds),pending=rounds.filter(r=>['draft','published'].includes(r.status)),next=pending[0];
 const playing=data.matches.some(m=>m.eventId===e.id&&m.status==='playing'),fixed=e.pointsChoice?.selectedMode==='fixed';
 const hasStarted=data.matches.some(m=>m.eventId===e.id&&['playing','complete','forfeit'].includes(m.status));
 const remaining=Math.floor((e.end-Math.max(e.start,now))/60000),canGenerate=editable&&!busy&&!playing&&!pending.length&&remaining>=5;
 const generate=()=>open('生成下一轮','generate',{eventId:e.id,at:Math.max(e.start,now),duration:Math.min(e.pointsPlan?.roundMinutes??15,remaining,90),seed:Math.floor(Math.random()*1000000)+1},[{...number('duration','每轮预计时长 · 分钟'),min:5,max:Math.min(90,remaining)}],undefined,'生成后可交换球友、调整场地、锁定分组，再确认发布。开赛时间自动记录。');
 const arrange=()=>{const window=pointsWindow(e),at=ceilHalfHour(Math.max(e.start,now)),max=Math.min(720,Math.floor((e.end-at)/60000));open('预排剩余赛程','planPoints',{eventId:e.id,at:dt(at),pointsMinutes:Math.max(5,Math.min(max,Math.round((window.end-at)/60000))),roundMinutes:window.roundMinutes,pairing:eventFormat(e)==='singles'?'rotate':e.pointsChoice?.selectedMode??'rotate',seed:Math.floor(Math.random()*1000000)+1},[
  halfTimed('at','赛程开始'),{...number('pointsMinutes','赛程时长 · 分钟'),min:5,max},{...number('roundMinutes','每轮预计时长 · 分钟'),min:5,max:60},...(eventFormat(e)==='singles'||hasStarted?[]:[choice('pairing','搭档方式',[['rotate','每轮换搭档'],['fixed','固定搭档']])])
 ],v=>({...v,at:epoch(String(v.at))}),'按接龙参加时段和可用场地预排剩余对局，不修改已完成比分。重新预排会替换尚未开打的轮次。')};
 const swap=(r:Round,id:string)=>{if(!currentSelected||currentSelected.roundId!==r.id){setSelected({roundId:r.id,playerId:id,lineup:roundLineupSnapshot(data.matches.filter(m=>m.roundId===r.id))});return}if(currentSelected.playerId!==id)send('swap',{roundId:r.id,p1:currentSelected.playerId,p2:id,expectedLineup:currentSelected.lineup});setSelected(null)};
 return <>
  <section className="card scheduling-controls"><div className="row"><h2>{mode==='planned'?'预排赛程':'逐轮安排'}</h2><span className="badge">{rounds.length} 轮</span></div>{editable&&<div className="actions">{mode==='planned'?<><button type="button" className="primary" disabled={busy||playing||Math.floor((e.end-ceilHalfHour(Math.max(e.start,now)))/60000)<5} onClick={arrange}><CalendarDays size={17}/> {rounds.length?'重新预排剩余赛程':'预排赛程'}</button>{rounds.some(r=>r.status==='complete'&&r.pointsSlot!==undefined)&&<button type="button" className="primary" disabled={!canGenerate} onClick={()=>send('pointsNext',{eventId:e.id,expectedRoundIds:rounds.map(r=>r.id).sort()})}><Shuffle size={17}/>添加下一场</button>}{pending.some(r=>r.status==='draft')&&<button type="button" className="secondary" disabled={busy||playing} onClick={()=>send('publishPoints',{eventId:e.id})}><Check size={17}/>发布全部预排</button>}</>:<button type="button" className="primary" disabled={!canGenerate} onClick={generate}><Shuffle size={17}/>生成下一轮</button>}</div>}
   <p className="hint">{playing?'请先录完当前轮全部对局；切换排场方式不会打断当前比赛。':mode==='round'&&pending.length?'当前已有未开打轮次，请先发布、开赛或取消。':mode==='planned'?(rounds.some(r=>r.status==='complete')&&!pending.length?'预排赛程已打完，可添加下一场。自动安排当前可上场球友与场地，检查新草稿后发布、开赛。':'草稿和已发布、未开打的分组都支持换人；只调整当前轮，不改其他轮次。'):'每轮结束后再生成，保留公平轮休与实力平衡。'}</p>
  </section>
  {selected&&!currentSelected&&<p className="connection-note" role="status">本轮阵容已更新，请重新选择要交换的两位球友。</p>}
  {!rounds.length&&<p className="empty">{mode==='planned'?'正式接龙后即可预排赛程。':'正式接龙后可生成第一轮。'}</p>}
  {playerId&&!rounds.some(r=>data.matches.some(m=>m.roundId===r.id&&matchIncludesPlayer(m,playerId)))&&<p className="match-filter-empty">这位球友暂时没有对局，轮休不算参赛。</p>}
  {rounds.map((r,index)=>{const allMatches=data.matches.filter(m=>m.roundId===r.id&&matchIncludesPlayer(m,playerId));if(playerId&&!allMatches.length)return null;const matches:Match[]=allMatches.filter(m=>m.status!=='cancelled'),withdrawn=allMatches.filter(m=>m.status==='cancelled'),changeable=editable&&['draft','published'].includes(r.status)&&!fixed,rest=changeable?roundBenchIds(data as unknown as State,e,r):r.rest;return <Disclosure key={r.id+':'+r.status} defaultOpen={!!playerId||r.status==='playing'||r.id===next?.id} label={'第 '+(index+1)+' 轮 · '+labels[r.status]+' · '+hm(r.start)}>
   <p className="hint">{r.live?'实时对局记录':'预计 '+r.duration+' 分钟'}{changeable?' · 点击两位球友旁的交换图标换人，也可与场下成员交换；已录分对局保持不变。':''}</p>
   <div className="courts-grid">{matches.map(m=><MatchCard key={m.id} m={m} ctx={ctx} interactive={changeable&&pendingMatchLineup(m)} selected={currentSelected?.roundId===r.id?currentSelected.playerId:''} onSelect={id=>swap(r,id)}/>)}</div>
   {withdrawn.length>0&&<Disclosure label={'已撤销对局 · '+withdrawn.length}>{withdrawn.map(m=><MatchCard key={m.id} m={m} ctx={{...ctx,readOnly:true}}/>)}</Disclosure>}
   <div className="rest"><strong>本轮轮休 · {rest.length} 人</strong><div className="actions">{rest.map(id=><GroupPlayer key={id} id={id} ctx={ctx} interactive={changeable} selected={currentSelected?.roundId===r.id?currentSelected.playerId:''} onSelect={id=>swap(r,id)}/>)}</div></div>
   <Disclosure label="上场与等待机会">{r.eligible.map(id=>{const prior=rounds.filter(x=>['published','playing','complete'].includes(x.status)&&x.eligible.includes(id)),played=prior.filter(x=>data.matches.some(m=>m.roundId===x.id&&m.status!=='cancelled'&&[...m.a,...m.b].includes(id)&&(!m.noShow?.length||m.noShow.includes(id))));return <div className="row small-line" key={id}><span>{name(id)}</span><span>{played.length}/{prior.length} 轮上场</span></div>})}</Disclosure>
   {editable&&<div className="actions">{r.status==='draft'&&<button type="button" className="primary" disabled={busy} onClick={()=>send('publish',{roundId:r.id})}><Check size={17}/>确认发布</button>}{r.status==='published'&&<button type="button" className="primary" disabled={busy||playing||r.id!==next?.id||now<e.start||now<r.start} onClick={()=>send('start',{roundId:r.id,at:roundStartTime(e,r,now),monthly:true,elo:true})}><Play size={17}/>开始本轮</button>}{['draft','published'].includes(r.status)&&<button type="button" className="ghost danger" disabled={busy} onClick={()=>setDanger({action:'cancelRound',payload:{roundId:r.id},title:'取消未开始的轮次',description:'仅撤销本轮尚未开始的对局，不修改历史比分。',reason:''})}>取消本轮</button>}</div>}
  </Disclosure>})}
  <Disclosure label="搭档方式与投票"><EventPointsPlan e={e} ctx={ctx} planning/></Disclosure>
 </>;
}
