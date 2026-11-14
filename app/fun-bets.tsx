'use client';
import {Swords} from 'lucide-react';
import type {ClubData} from '../lib/contracts/club';
import type {Event,Match} from '../lib/domain/types';
import {funBetEligible,funBetMaxStake,funBetOpen,funBetState,type FunBet,type FunBetState} from '../lib/domain/fun-bets';
import {eventRankingEnabled} from '../lib/domain/event-ranking';
import {eventFormat} from '../lib/domain/match-format';
import {useActivityClock} from '../lib/client/use-activity-clock';
import type {Field} from './form-fields';
import './fun-bets.css';

type Ctx={data:ClubData;name:(id:string)=>string;busy?:boolean;send:(action:string,payload:Record<string,unknown>)=>void;
 open:(title:string,action:string,values:Record<string,unknown>,fields:Field[],convert?:(v:Record<string,unknown>)=>unknown,description?:string)=>void};
const stateLabels:Record<FunBetState,string>={pending:'等待应战',locked:'赌约已成',expired:'未凑齐，已过期',declined:'有人拒绝，未成立',withdrawn:'发起人已撤回',void:'对局有变，已作废','won-a':'已结算','won-b':'已结算'};

/** 趣味赛 on the 玩法 tab (docs/FUN_BETS.md): the viewer's own games open to a proposal, then every proposal of this
 * activity with who has answered, the buttons the viewer may press and, once scored, who won and lost what. */
export default function FunBets({e,ctx}:{e:Event;ctx:Ctx}){
 const {data,name,busy,send,open}=ctx,now=useActivityClock(e),me=data.me.playerId;
 if(!eventRankingEnabled(e)||e.tournament||eventFormat(e)!=='doubles')return null;
 const matches=new Map<string,Match>(data.matches.filter((m:Match)=>m.eventId===e.id).map((m:Match)=>[m.id,m]));
 const bets=[...(e.funBets??[])].sort((x,y)=>y.at-x.at);
 const live=(m:Match)=>bets.some(b=>b.matchId===m.id&&['pending','locked'].includes(funBetState(b,m,now)));
 const mine=[...matches.values()].filter(m=>[...m.a,...m.b].includes(me)&&funBetOpen(m,now)&&funBetEligible(e,m,id=>data.players.some(p=>p.id===id&&!p.guest&&!p.guestEventId))&&!live(m));
 const team=(ids:string[])=>ids.map(name).join(' / ');
 const court=(m?:Match)=>data.bookings.find(b=>b.id===m?.courtId)?.name??'场地';
 const propose=(m:Match)=>open('发起趣味赛','funBetCreate',{eventId:e.id,matchId:m.id,stake:10},[{key:'stake',label:'押注积分（每人）',type:'number',min:1,max:funBetMaxStake,step:1}],
  v=>({...v,stake:Number(v.stake)}),`${team(m.a)} 对 ${team(m.b)}。四人都接受才成立；录分后输方每人扣、赢方每人得押注的积分。每人最多押 ${funBetMaxStake} 积分。`);
 if(!bets.length&&!mine.length)return null;
 return <section className="card fun-bets" aria-label="趣味赛">
  <div className="row"><h3><Swords size={17} aria-hidden="true"/>趣味赛</h3></div>
  <p className="hint">同一局双打的四位道友各押相同的积分，四人都接受才成立；录分后输方每人付给赢方每人押注的积分，计入积分榜。只能在对局开打前（实时排场开局后 5 分钟内、尚未录分）发起和应战；换人、取消、判负或缺席时作废，不动积分。</p>
  {mine.length>0&&<ul className="fun-bet-list">{mine.map(m=><li key={m.id} className="fun-bet-open"><span><b>{court(m)}</b> {team(m.a)} 对 {team(m.b)}</span><button type="button" className="secondary" disabled={busy} onClick={()=>propose(m)}>发起趣味赛</button></li>)}</ul>}
  {bets.length>0&&<ul className="fun-bet-list">{bets.map(bet=>row(bet))}</ul>}
 </section>;
 function row(bet:FunBet){
  const m=matches.get(bet.matchId),state=funBetState(bet,m,now),everyone=[...bet.a,...bet.b];
  const waiting=everyone.filter(id=>!bet.accepted.includes(id)),settled=state==='won-a'||state==='won-b';
  const [won,lost]=state==='won-a'?[bet.a,bet.b]:[bet.b,bet.a];
  const can=state==='pending'&&everyone.includes(me);
  return <li key={bet.id} className={'fun-bet is-'+state}>
   <div><b>{court(m)}</b> {team(bet.a)} 对 {team(bet.b)} · 每人 {bet.stake} 积分</div>
   <div className="fun-bet-status"><span className="badge">{stateLabels[state]}</span>
    {state==='pending'&&<small>已应战 {bet.accepted.length}/4{waiting.length?' · 待回应：'+waiting.map(name).join('、'):''}</small>}
    {state==='declined'&&bet.declinedBy&&<small>{name(bet.declinedBy)} 拒绝</small>}
    {settled&&<small>{team(won)} 各 +{bet.stake}，{team(lost)} 各 -{bet.stake}</small>}
   </div>
   {can&&<div className="actions">
    {!bet.accepted.includes(me)&&<><button type="button" className="primary" disabled={busy} onClick={()=>send('funBetRespond',{eventId:e.id,betId:bet.id,accept:true})}>应战</button>
     <button type="button" className="ghost" disabled={busy} onClick={()=>send('funBetRespond',{eventId:e.id,betId:bet.id,accept:false})}>拒绝</button></>}
    {bet.by===me&&<button type="button" className="ghost" disabled={busy} onClick={()=>send('funBetWithdraw',{eventId:e.id,betId:bet.id})}>撤回</button>}
   </div>}
  </li>;
 }
}
