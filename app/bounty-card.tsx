'use client';
import {useEffect,useState} from 'react';
import {ScrollText,CheckCircle2,XCircle} from 'lucide-react';
import {bountyGoals,bountyTitles,type BountyKind} from '../lib/domain/bounties';
import {myBounty,pendingBountyOffers,type ViewBounty} from '../lib/client/bounties';
import './bounty.css';

type Offer={eventId:string;playerId:string;kind:BountyKind;coins:number;points:number;penalty:number};
export const rewardText=(b:{coins:number;points:number})=>[b.coins?`${b.coins} 羽币`:'',b.points?`${b.points} 积分`:''].filter(Boolean).join(' + ')||'无奖励';

/** The scroll of one bounty: its goal, reward and penalty. */
export function BountyScroll({kind,coins,points,penalty}:{kind:BountyKind;coins:number;points:number;penalty:number}){
 return <div className="bounty-scroll">
  <p className="bounty-goal">{bountyGoals[kind]}</p>
  <dl><div><dt>完成奖励</dt><dd>{rewardText({coins,points})}</dd></div><div><dt>接下未完成</dt><dd>{penalty?`扣 ${penalty} 积分`:'不扣分'}</dd></div></dl>
 </div>;
}
/** This member's bounty for one activity: an offer to answer, or the accepted bounty and, after the activity, its result. */
export default function BountyCard({title,offer,accepted,busy,onRespond,onOpen}:{title?:string;offer?:Offer|null;accepted?:ViewBounty;busy?:boolean;onRespond?:(offer:Offer,accept:boolean)=>void;onOpen?:()=>void}){
 if(offer)return <section className="card bounty-card is-offer" aria-label="悬赏令">
  <BountyHead kind={offer.kind} title={title} onOpen={onOpen} state="待回应"/>
  <BountyScroll {...offer}/>
  <p className="hint">接不接都可以：不接没有惩罚。只能回应一次，你的第一局开始后悬赏令失效。</p>
  <div className="actions"><button type="button" className="primary" disabled={busy} onClick={()=>onRespond?.(offer,true)}>接下悬赏</button><button type="button" className="ghost" disabled={busy} onClick={()=>onRespond?.(offer,false)}>不接</button></div>
 </section>;
 if(!accepted)return null;
 const done=accepted.outcome==='completed',failed=accepted.outcome==='failed';
 return <section className={'card bounty-card'+(done?' is-completed':failed?' is-failed':'')} aria-label="悬赏令" role="status">
  <BountyHead kind={accepted.kind} title={title} onOpen={onOpen} state={done?'已完成':failed?'未完成':'进行中'}/>
  <BountyScroll {...accepted}/>
  {done?<p className="bounty-result"><CheckCircle2 size={17} aria-hidden="true"/>悬赏完成！获得 {rewardText(accepted)}。</p>
   :failed?<p className="bounty-result"><XCircle size={17} aria-hidden="true"/>悬赏未完成{accepted.penalty?`，扣 ${accepted.penalty} 积分`:''}。</p>
   :<p className="hint">活动结束后自动结算；补录比分也会重新结算。</p>}
 </section>;
}
function BountyHead({kind,title,state,onOpen}:{kind:BountyKind;title?:string;state:string;onOpen?:()=>void}){
 return <div className="bounty-head"><span className="bounty-seal" aria-hidden="true"><ScrollText size={20}/></span>
  <div><strong>{bountyTitles[kind]}</strong>{title&&(onOpen?<button type="button" className="bounty-event" onClick={onOpen}>{title} ›</button>:<small>{title}</small>)}</div>
  <span className="badge bounty-state">{state}</span></div>;
}

/** The activity page shows this member's bounty for the activity: the offer while it can be answered, then its state. */
/** The clock bounty cards read: a fixed `now` in tests, otherwise refreshed every 30 seconds so offers open and close on time. */
function useBountyClock(now?:number){
 const [tick,setTick]=useState(Date.now);
 useEffect(()=>{if(now!==undefined)return;const timer=setInterval(()=>setTick(Date.now()),30000);return()=>clearInterval(timer)},[now]);
 return now??tick;
}
export function EventBounty({e,data,busy,respond,now:fixed}:{e:Parameters<typeof myBounty>[0]&{id:string};data:Parameters<typeof pendingBountyOffers>[0];busy?:boolean;respond:(offer:Offer,accept:boolean)=>void;now?:number}){
 const now=useBountyClock(fixed),offer=pendingBountyOffers(data,now).find(o=>o.eventId===e.id),accepted=myBounty(e,data.me.playerId);
 return <BountyCard offer={offer} accepted={accepted} busy={busy} onRespond={respond}/>;
}
/** Home: offers to answer, then accepted bounties of activities running or ended in the last day. */
export function HomeBounties({data,busy,respond,onOpen,now:fixed}:{data:Parameters<typeof pendingBountyOffers>[0]&{events:{id:string;title:string;start:number;end:number}[]};busy?:boolean;respond:(offer:Offer,accept:boolean)=>void;onOpen:(eventId:string)=>void;now?:number}){
 const now=useBountyClock(fixed),offers=pendingBountyOffers(data,now),title=(id:string)=>data.events.find(e=>e.id===id)?.title;
 const accepted=data.events.filter(e=>now<e.end+86400000&&!offers.some(o=>o.eventId===e.id)).map(e=>({e,b:myBounty(e,data.me.playerId)})).filter(x=>!!x.b);
 if(!offers.length&&!accepted.length)return null;
 return <>{offers.map(o=><BountyCard key={'offer'+o.eventId} title={title(o.eventId)} offer={o} busy={busy} onRespond={respond} onOpen={()=>onOpen(o.eventId)}/>)}
  {accepted.map(({e,b})=><BountyCard key={'bounty'+e.id} title={e.title} accepted={b} onOpen={()=>onOpen(e.id)}/>)}</>;
}
