import {bountyEvent,bountyGoals,bountyOffer,bountyOfferAt,bountyTitles} from './domain/bounties';
import type {Reminder} from './reminder-contract';
import type {State} from './domain/types';

const time=new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit',hour12:false});
const reward=(o:{coins:number;points:number})=>[o.coins?`${o.coins} 羽币`:'',o.points?`${o.points} 积分`:''].filter(Boolean).join(' + ')||'无奖励';

/** Bounty notices (docs/BOUNTIES.md): once an offer opens, 30 minutes before a points match, each member offered a
 * bounty is told once, in the app and on their devices. Only until the start, so a late tick sends nothing. One id per
 * activity and member: a repeated tick or a second device never adds another. */
export function bountyReminders(s:State,now:number):Reminder[]{
 return s.events.filter(e=>bountyEvent(e)&&bountyOfferAt(e)<=now&&now<e.start).flatMap(e=>s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed').flatMap(r=>{
  const offer=bountyOffer(s,e,r.playerId,now),account=s.accounts.find(a=>a.playerId===r.playerId);
  if(!offer||!account)return [];
  return [{id:`bounty:${e.id}:${r.playerId}`,kind:'bounty' as const,eventId:e.id,title:'悬赏令 · '+bountyTitles[offer.kind],tab:'overview' as const,accountIds:[account.id],expires:e.end,createdAt:now,playerId:r.playerId,
   body:`${e.title} ${time.format(e.start)} 开打。${bountyGoals[offer.kind]}，完成得 ${reward(offer)}；接下没完成扣 ${offer.penalty} 积分。不接没有惩罚，第一局开始前打开主页回应。`.slice(0,250)}];
 }));
}
