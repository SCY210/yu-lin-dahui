'use client';
import {Bell,CheckCircle2,FileClock,Plus} from 'lucide-react';
import type {Event} from '../lib/domain/types';
import {canManageEvent} from '../lib/domain/permissions';
import {competitionCosts,ballCents} from '../lib/domain/money';
import {feeMembers} from '../lib/domain/fee-transfers';
import {euro,text,money,number,choice,why} from './ui';
import type {SchedulingContext} from './event-scheduling';
import './fee-status.css';
import './tournament-fees.css';

/** A competition's fees (docs/TOURNAMENTS.md): a compulsory entry fee, never a split. The page shows what the
 * competition costs (courts, shuttles, prizes), the fee per entrant rounded up to a whole euro, and once confirmed,
 * who has paid. Organisers record shuttles, confirm the fee and remind those who have not paid. */
export default function TournamentFees({e,ctx}:{e:Event;ctx:SchedulingContext&{action:(name:string,payload:Record<string,unknown>,toast?:boolean)=>Promise<unknown>}}){
 const {data,open,name}=ctx,manager=canManageEvent(data.me,e),c=competitionCosts(data,e),p=e.tournament?.prizes;
 const latest=data.settlements.filter(x=>x.eventId===e.id&&x.confirmed).sort((a,b)=>b.version-a.version)[0];
 const changed=!!latest&&(latest.bills.length!==c.entrants.length||latest.bills.some(b=>b.total!==c.fee||!c.entrants.includes(b.playerId)));
 const payments=data.payments??[],paid=(id:string,total:number)=>total<=0||payments.filter(x=>x.eventId===e.id&&x.playerId===id&&!x.to).reduce((n,x)=>n+x.cents,0)>=total;
 const proxied=(id:string)=>id!==data.me.playerId&&data.players.find(x=>x.id===id)?.ownerId===data.me.id;
 const unpaid=latest?latest.bills.filter(b=>!paid(b.playerId,b.total)).length:0;
 const mark=(id:string,value:boolean)=>void ctx.action('feePaid',{eventId:e.id,settlementId:latest!.id,playerId:id,paid:value,reason:value?'标记已付款':'撤销付款标记'},false).catch(()=>{});
 const ball=()=>open('记录球费','cost',{eventId:e.id,type:'ball',name:'比赛用球',pricing:'unit',cents:200,used:0,start:'',end:'',bearer:'members',advancedBy:'',reason:'比赛用球'},[text('name','型号'),money('cents','单颗价格 · 欧元/颗'),{...number('used','消耗颗数'),min:0},choice('advancedBy','这些球是谁买的',feeMembers(data.players)),why],(v:Record<string,unknown>)=>({...v,pricing:'unit',start:null,end:null}),'球费 = 单颗价格 × 颗数，计入报名费。');
 const line=(label:string,cents:number,detail?:string)=><div className="tournament-fee-line"><span>{label}{detail&&<small>{detail}</small>}</span><strong>{euro(cents)}</strong></div>;
 return <div className="tournament-fees">
  <section className="card tournament-fee-summary">
   <div className="tournament-fee-headline"><span>每人报名费</span><strong>{euro(c.fee)}</strong><small>{c.entrants.length} 位正式报名 · 向上取整到整欧元</small></div>
   <div className={'fee-confirmation '+(latest&&!changed?'is-confirmed':'is-pending')} role="status">{latest&&!changed?<CheckCircle2 size={22} aria-hidden="true"/>:<FileClock size={22} aria-hidden="true"/>}<div><strong>{latest?changed?'报名或费用有变动，待重新确认':'报名费已确认 · 第 '+latest.version+' 版':'报名费待组织者确认'}</strong><small>比赛不分摊场地和球费，所有正式报名的选手交同样的报名费。</small></div></div>
   {line('场地费',c.courts,data.bookings.filter(b=>b.eventId===e.id).length+' 个场地时段')}
   {line('球费',c.shuttles,data.costs.filter(x=>x.eventId===e.id).map(x=>x.name+' '+euro(x.type==='ball'?ballCents(x):x.cents)).join(' · ')||'尚未记录')}
   {line('冠亚季奖品',c.prizes,p?'冠军 '+euro(p.first)+' · 亚军 '+euro(p.second)+' · 季军 '+euro(p.third):'在比赛对战表的「赛制与奖品」中设置')}
   {line('合计',c.total)}
   {latest&&!!latest.roundingDifference&&<p className="hint">向上取整多收 {euro(latest.roundingDifference)}，留作比赛备用。</p>}
   {manager&&<div className="actions"><button type="button" className="secondary" disabled={ctx.busy} onClick={ball}><Plus size={16}/>记录球费</button><button type="button" className="primary" disabled={ctx.busy||!c.entrants.length||!!latest&&!changed} onClick={()=>ctx.send('settle',{eventId:e.id,confirmed:true,reason:latest?'报名或费用变动后重新确认':'确认比赛报名费'})}>{latest?'重新确认报名费':'确认报名费'}</button>{latest&&unpaid>0&&<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>ctx.send('notifyFees',{eventId:e.id,settlementId:latest.id,reason:'提醒未付款'})}><Bell size={16}/>提醒未付款（{unpaid}）</button>}</div>}
  </section>
  {latest&&<section className="card"><h3>付款情况 · {latest.bills.length-unpaid} / {latest.bills.length} 已付</h3>{latest.bills.map(b=><div className="bill-row" key={b.playerId}><div><strong>{name(b.playerId)}{proxied(b.playerId)&&<small> · 我代报名</small>}</strong></div><div><strong>{euro(b.total)}</strong><small>报名费</small></div><div className="fee-paid-status">{paid(b.playerId,b.total)?<span className="fee-status is-paid">已付款</span>:<span className="fee-status is-unpaid">未付款</span>}{(b.playerId===data.me.playerId||proxied(b.playerId)||manager)&&b.total>0&&<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>mark(b.playerId,!paid(b.playerId,b.total))}>{paid(b.playerId,b.total)?'撤销':'标记已付款'}</button>}</div></div>)}</section>}
 </div>;
}
