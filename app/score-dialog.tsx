'use client';
import {month} from '../lib/domain/types';
import {useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {Pick} from './ui';
import {fmt} from './form-fields';
import {initialScoreDrafts,scoreEntryPayload} from '../lib/client/score-reminder';
import './score-reminder.css';

export default function ScoreDialog({m,ctx,close,pendingMatches=[],choose}:any){
 const correcting=m.status==='complete',live=ctx.data.rounds.find((r:any)=>r.id===m.roundId)?.live||(!correcting&&ctx.data.events.find((e:any)=>e.id===m.eventId)?.livePlay?.enabled);
 const rules=ctx.data.seasons.find((s:any)=>s.id===month(m.start))?.rules??ctx.data.settings.rules;
 const [format,setFormat]=useState(live||m.playMode==='koc'?'single':m.games.length>1?'best3':'single'),[third,setThird]=useState(m.games.length===3),[scores,setScores]=useState(()=>initialScoreDrafts(m)),[error,setError]=useState('');
 const reason=correcting?'修正比赛结果':'接龙球友确认比赛完成';
 const mySide=m.a.includes(ctx.data.me.playerId)?'a':m.b.includes(ctx.data.me.playerId)?'b':null;
 const sides:('a'|'b')[]=mySide==='b'?['b','a']:['a','b'];
 async function save(e:React.FormEvent){e.preventDefault();setError('');try{await ctx.action('score',scoreEntryPayload(m,scores,format==='single'?1:third?3:2,reason));close()}catch(e){setError(e instanceof Error?e.message:'暂时未能保存比分，请重试')}}
 return <Dialog open historyCloseBlocked={ctx.busy} onOpenChange={open=>{if(!open&&!ctx.busy)close()}}><DialogContent className="app-dialog simple-score-dialog"><DialogHeader><DialogTitle>{correcting?'修正比赛结果':'录入本局比分'}</DialogTitle><DialogDescription>{correcting?'填写实际比分，确认后重新计算。':'填好双方实际比分，确认即可；还没打完可以稍后再录。'}</DialogDescription></DialogHeader>
  <p className="simple-score-context">{ctx.data.events.find((e:any)=>e.id===m.eventId)?.title} · {ctx.data.bookings.find((b:any)=>b.id===m.courtId)?.name??'比赛场地'}</p>
  <form onSubmit={save}>
   <div className="simple-score-games">{scores.slice(0,format==='single'?1:third?3:2).map((game,index)=><div className="simple-score-game" key={index}>{format==='best3'&&<strong className="simple-score-game-title">第 {index+1} 局</strong>}<div className="simple-score-pair">{sides.map(side=><label key={side} className={side===mySide?'is-my-team':''}><strong>{mySide?side===mySide?'我方':'对方':side==='a'?'甲队':'乙队'}</strong><small>{m[side].map(ctx.name).join(' / ')}</small><input aria-label={'第'+(index+1)+'局'+(side==='a'?'甲队':'乙队')+'比分'} placeholder="比分" type="number" inputMode="numeric" step={1} min={0} max={rules.ceiling} required autoFocus={index===0&&side===sides[0]} value={game[side]} onChange={e=>setScores(scores.map((g,i)=>i===index?{...g,[side]:e.target.value===''?'':Number(e.target.value)}:g))}/></label>)}</div></div>)}</div>
   {format==='best3'&&<label className="check-label"><Checkbox checked={third} onCheckedChange={v=>setThird(v===true)}/>打到第三局</label>}
   {error&&<p className="connection-note" role="alert">{error}</p>}
   <div className="simple-score-actions"><button className="primary full" disabled={ctx.busy}>{ctx.busy?'正在保存…':correcting?'确认修改':'提交比分'}</button>{!correcting&&<button type="button" className="ghost full" disabled={ctx.busy} onClick={close}>稍后再录</button>}</div>
   {!live&&m.playMode!=='koc'&&<details className="simple-score-more"><summary>更多选项 · 三局两胜</summary><label>比赛形式<Pick value={format} onChange={setFormat} options={[["single","一局一轮"],["best3","三局两胜"]]}/></label></details>}
   {choose&&pendingMatches.length>1&&<details className="simple-score-more"><summary>其他待录对局（{pendingMatches.length-1}）</summary><div className="score-reminder-list">{pendingMatches.filter((other:any)=>other.id!==m.id).map((other:any)=><button key={other.id} type="button" className="ghost" disabled={ctx.busy} onClick={()=>choose(other.id)}>{ctx.data.events.find((e:any)=>e.id===other.eventId)?.title} · {fmt(other.start)}</button>)}</div></details>}
  </form>
 </DialogContent></Dialog>;
}
