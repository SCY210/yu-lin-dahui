'use client';
import {Swords} from 'lucide-react';
import type {ClubData} from '../lib/contracts/club';
import type {Event,Match} from '../lib/domain/types';
import {duelEvent,duelGameOf,duelMaxStake,duelState,type Duel,type DuelState} from '../lib/domain/duels';
import {eventRankingEnabled} from '../lib/domain/event-ranking';
import {eventFormat} from '../lib/domain/match-format';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {choice,type Field} from './form-fields';
import './duels.css';

type Ctx={data:ClubData;name:(id:string)=>string;busy?:boolean;send:(action:string,payload:Record<string,unknown>)=>void;
 open:(title:string,action:string,values:Record<string,unknown>,fields:Field[],convert?:(v:Record<string,unknown>)=>unknown,description?:string)=>void};
const stateLabels:Record<DuelState,string>={pending:'等待应战',expired:'开赛前没凑齐，已过期',declined:'有人拒绝，未成立',withdrawn:'已撤回',locked:'战帖已成，待排场',void:'没能对上或对局作废，不动积分','won-a':'已结算','won-b':'已结算'};

/** 天机战帖 on the 玩法 tab (docs/DUELS.md): before the activity starts a member challenges two players with their own
 * partner; then every duel of this activity with who has answered, the buttons the viewer may press and the result. */
export default function Duels({e,ctx}:{e:Event;ctx:Ctx}){
 const {data,name,busy,send,open}=ctx,now=useActivityClock(e),me=data.me.playerId;
 if(!eventRankingEnabled(e)||e.tournament||eventFormat(e)!=='doubles')return null;
 const matches:Match[]=data.matches.filter((m:Match)=>m.eventId===e.id);
 const duels=[...(e.duels??[])].sort((x,y)=>y.at-x.at);
 // Confirmed members of this activity; friends have no points to stake.
 const roster=data.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed').map(r=>r.playerId)
  .filter((id,i,all)=>all.indexOf(id)===i&&data.players.some(p=>p.id===id&&!p.guest&&!p.guestEventId));
 const engaged=new Set(duels.filter(d=>['pending','locked'].includes(duelState(d,e,matches,now))).flatMap(d=>[...d.a,...d.b]));
 const canSend=duelEvent(e,now)&&roster.includes(me)&&!engaged.has(me);
 const team=(ids:readonly string[])=>ids.map(name).join(' / ');
 const others=roster.filter(id=>id!==me&&!engaged.has(id)).map(id=>[id,name(id)]);
 const challenge=()=>open('下天机战帖','duelCreate',{eventId:e.id,partner:others[0]?.[0]??'',opponent1:others[1]?.[0]??'',opponent2:others[2]?.[0]??'',stake:10},
  [choice('partner','我方搭档',others),choice('opponent1','对手一',others),choice('opponent2','对手二',others),{key:'stake',label:'押注积分（每人）',type:'number',min:1,max:duelMaxStake,step:1}],
  v=>({eventId:v.eventId,partner:v.partner,opponents:[v.opponent1,v.opponent2],stake:Number(v.stake),reason:v.reason}),
  `开赛前四位都应战才成立，开赛后排场会在轮次公平允许时安排这一局。录分后输方每人扣、赢方每人得押注的积分；每人最多押 ${duelMaxStake} 积分。请先和三位道友商量好。`);
 if(!duels.length&&!canSend)return null;
 return <section className="card duels" aria-label="天机战帖">
  <div className="row"><h3><Swords size={17} aria-hidden="true"/>天机战帖</h3>{canSend&&others.length>=3&&<button type="button" className="primary" disabled={busy} onClick={challenge}>下战帖</button>}</div>
  <p className="hint">活动开始前，约好的四位道友写明哪两人对哪两人、每人押多少积分；四位都应战才成立。开赛后排场会在轮次公平允许时把四人排进同一局，按这两队对阵；录分后输方每人付给赢方每人押注的积分，计入积分榜。没能对上、判负或缺席时不动积分。</p>
  {duels.length>0&&<ul className="duel-list">{duels.map(row)}</ul>}
 </section>;
 function row(d:Duel){
  const state=duelState(d,e,matches,now),four=[...d.a,...d.b],waiting=four.filter(id=>!d.accepted.includes(id));
  const [won,lost]=state==='won-a'?[d.a,d.b]:[d.b,d.a],can=state==='pending'&&four.includes(me);
  // Once it holds, the game itself says where it is: on the schedule, or being played.
  const game=state==='locked'?duelGameOf(d,e,matches):undefined,label=game?.status==='playing'?'斗法进行中':game?'已排进赛程':stateLabels[state];
  return <li key={d.id} className={'duel is-'+state}>
   <div>{team(d.a)} <b>对</b> {team(d.b)} · 每人 {d.stake} 积分</div>
   <div className="duel-status"><span className="badge">{label}</span>
    {state==='pending'&&<small>已应战 {d.accepted.length}/4{waiting.length?' · 待回应：'+waiting.map(name).join('、'):''}</small>}
    {state==='declined'&&d.declinedBy&&<small>{name(d.declinedBy)} 拒绝</small>}
    {(state==='won-a'||state==='won-b')&&<small>{team(won)} 各 +{d.stake}，{team(lost)} 各 -{d.stake}</small>}
   </div>
   {can&&<div className="actions">
    {!d.accepted.includes(me)&&<><button type="button" className="primary" disabled={busy} onClick={()=>send('duelRespond',{eventId:e.id,duelId:d.id,accept:true})}>应战</button>
     <button type="button" className="ghost" disabled={busy} onClick={()=>send('duelRespond',{eventId:e.id,duelId:d.id,accept:false})}>拒绝</button></>}
    {d.by===me&&<button type="button" className="ghost" disabled={busy} onClick={()=>send('duelWithdraw',{eventId:e.id,duelId:d.id})}>撤回</button>}
   </div>}
  </li>;
 }
}
