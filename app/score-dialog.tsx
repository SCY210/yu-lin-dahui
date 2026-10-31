'use client';
import {month,type Season} from '../lib/domain/types';
import {scoreEntryStart} from '../lib/domain/score-entry';import {matchRule,scoringCap,scoringLabel,type ScoringRule,type Tournament} from '../lib/domain/tournament';
import {useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {Pick} from './ui';
import {fmt} from './form-fields';
import {Avatar} from './avatar';
import {initialScoreDrafts,scoreEntryPayload} from '../lib/client/score-reminder';
import './score-reminder.css';

type Game={a:number;b:number};
type Named={id:string;name?:string;title?:string;avatarId?:string;livePlay?:{enabled?:boolean};tournament?:Tournament};
const sameGames=(x:Game[],y:Game[])=>x.length===y.length&&x.every((g,i)=>g.a===y[i].a&&g.b===y[i].b);

/** Teams face each other with avatars and one score box under each; the viewer's own team is on the left. */
export default function ScoreDialog({m,ctx,close,pendingMatches=[],choose}:any){
 // The form remembers the score it opened with: if another player saves this game first, it shows their score
 // instead of quietly overwriting it, and the server refuses a different score sent from a stale form.
 const [opened,setOpened]=useState(()=>({status:m.status,games:m.games.map((g:Game)=>({a:g.a,b:g.b}))}));
 const [saving,setSaving]=useState(false);
 const event=ctx.data.events.find((e:Named)=>e.id===m.eventId),correcting=opened.status==='complete',live=ctx.data.rounds.find((r:{id:string;live?:boolean})=>r.id===m.roundId)?.live||(!correcting&&event?.livePlay?.enabled);
 const rules=ctx.data.seasons.find((season:Season)=>season.id===month(scoreEntryStart(m,ctx.data)))?.rules??ctx.data.settings.rules,rule:ScoringRule|undefined=matchRule(event?.tournament,m.id),ruleFormat=rule&&(rule.games===3?'best3':'single');
 const [format,setFormat]=useState(ruleFormat??(live||m.playMode==='koc'?'single':m.games.length>1?'best3':'single')),[third,setThird]=useState(m.games.length===3),[scores,setScores]=useState(()=>initialScoreDrafts(m)),[error,setError]=useState('');
 const [scoreLineup]=useState(()=>({a:[...m.a],b:[...m.b]}));
 const lineupChanged=JSON.stringify(scoreLineup.a)!==JSON.stringify(m.a)||JSON.stringify(scoreLineup.b)!==JSON.stringify(m.b);
 const savedByOther=!saving&&!lineupChanged&&m.status==='complete'&&!sameGames(m.games,opened.games);
 const reason=correcting?'修正比赛结果':'接龙球友确认比赛完成';
 const mySide=m.a.includes(ctx.data.me.playerId)?'a':m.b.includes(ctx.data.me.playerId)?'b':null;
 const sides:('a'|'b')[]=mySide==='b'?['b','a']:['a','b'];
 const player=(id:string)=>ctx.data.players?.find((p:Named)=>p.id===id);
 const court=ctx.data.bookings.find((b:Named)=>b.id===m.courtId)?.name??'比赛场地',title=event?.title;
 const teamLabel=(side:'a'|'b')=>mySide?side===mySide?'我方':'对方':side==='a'?'甲队':'乙队';
 const count=format==='single'?1:third?3:2;
 async function save(e:React.FormEvent){e.preventDefault();setError('');if(lineupChanged){setError('本局人员已更新，请关闭后重新打开录分');return}
  setSaving(true);
  try{await ctx.action('score',{...scoreEntryPayload(m,scores,count,reason),expectedA:scoreLineup.a,expectedB:scoreLineup.b,expectedGames:opened.games});close()}
  catch(e){setError(e instanceof Error?e.message:'暂时未能保存比分，请重试')}
  finally{setSaving(false)}}
 const correct=()=>{setOpened({status:'complete',games:m.games.map((g:Game)=>({a:g.a,b:g.b}))});setScores(initialScoreDrafts(m));setFormat(ruleFormat??(m.games.length>1?'best3':'single'));setThird(m.games.length===3);setError('')};
 const team=(side:'a'|'b')=><div className={'score-team'+(side===mySide?' is-my-team':'')}>
   <span className="score-team-label">{teamLabel(side)}</span>
   {m[side].map((id:string)=><span key={id} className="score-team-player"><Avatar p={player(id)} size="score-avatar" eager/><span>{ctx.name(id)}</span></span>)}
  </div>;
 const teams=<div className="score-teams">{team(sides[0])}<span className="score-team-vs" aria-hidden="true">VS</span>{team(sides[1])}</div>;
 return <Dialog open historyCloseBlocked={ctx.busy} onOpenChange={open=>{if(!open&&!ctx.busy)close()}}><DialogContent className="app-dialog simple-score-dialog"><DialogHeader><DialogTitle>{savedByOther?'这局已录入比分':correcting?'修正比赛结果':'录入本局比分'}</DialogTitle><DialogDescription className="simple-score-context">{court}{title?' · '+title:''}{rule?' · '+scoringLabel(rule):''}</DialogDescription></DialogHeader>
  {teams}
  {savedByOther?<div className="score-conflict" role="alert">
   <p><strong>{m.enteredByPlayerId?ctx.name(m.enteredByPlayerId):'其他球友'}</strong> 刚刚录入了这局比分</p>
   <div className="score-conflict-result">{m.games.map((g:Game,i:number)=><b key={i}>{g[sides[0]]} : {g[sides[1]]}</b>)}</div>
   <div className="simple-score-actions"><button type="button" className="primary full" onClick={close}>比分没错</button><button type="button" className="ghost full" disabled={ctx.busy} onClick={correct}>比分不对，我来修正</button></div>
  </div>:<form onSubmit={save}>
   <div className="simple-score-games">{scores.slice(0,count).map((game,index)=><div className="simple-score-game" key={index}>{format==='best3'&&<strong className="simple-score-game-title">第 {index+1} 局</strong>}<div className="simple-score-pair">{sides.map((side,i)=><label key={side} className={(side===mySide?'is-my-team':'')+(i?' is-second':'')}>
    <input aria-label={'第'+(index+1)+'局'+(side==='a'?'甲队':'乙队')+'比分'} placeholder="比分" type="number" inputMode="numeric" step={1} min={0} max={rule?scoringCap(rule):rules.ceiling} required autoFocus={index===0&&side===sides[0]} value={game[side]} onChange={e=>setScores(scores.map((g,j)=>j===index?{...g,[side]:e.target.value===''?'':Number(e.target.value)}:g))}/>
   </label>)}</div></div>)}</div>
   {format==='best3'&&<label className="check-label"><Checkbox checked={third} onCheckedChange={v=>setThird(v===true)}/>打到第三局</label>}
   {error&&<p className="connection-note" role="alert">{error}</p>}{lineupChanged&&<p className="connection-note" role="alert">本局人员已更新，请关闭后重新打开录分，核对新的参赛者。</p>}
   <div className="simple-score-actions"><button className="primary full" disabled={ctx.busy||lineupChanged}>{ctx.busy?'正在保存…':correcting?'确认修改':'提交比分'}</button>{!correcting&&<button type="button" className="ghost full" disabled={ctx.busy} onClick={close}>稍后再录</button>}</div>
   {!live&&m.playMode!=='koc'&&!rule&&<details className="simple-score-more"><summary>三局两胜</summary><label>比赛形式<Pick value={format} onChange={setFormat} options={[["single","一局一轮"],["best3","三局两胜"]]}/></label></details>}
   {choose&&pendingMatches.length>1&&<details className="simple-score-more"><summary>其他待录对局（{pendingMatches.length-1}）</summary><div className="score-reminder-list">{pendingMatches.filter((other:any)=>other.id!==m.id).map((other:any)=><button key={other.id} type="button" className="ghost" disabled={ctx.busy} onClick={()=>choose(other.id)}>{ctx.data.events.find((e:any)=>e.id===other.eventId)?.title} · {fmt(other.start)}</button>)}</div></details>}
  </form>}
 </DialogContent></Dialog>;
}
