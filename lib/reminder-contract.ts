import {canCastAwardVote} from './domain/activity-voting';
import {z} from 'zod';
import type {State,Event,Registration,Settlement,Bill} from './domain/types';
import {feeContact,unpaidBills} from './domain/fee-payments';
import {newlyOpenedSignups} from './push-contract';
export const reminderKinds=['signup','registration','changes','matches','fees','awards','upcoming'] as const;
export type ReminderKind=typeof reminderKinds[number];
export const reminderLabels:Record<ReminderKind,string>={signup:'新活动开放',registration:'我的报名与候补',changes:'活动变更与取消',matches:'我的分组安排',fees:'费用确认',awards:'赛后评选',upcoming:'临近开场'};
export const reminderPreferences=z.object({signup:z.boolean(),registration:z.boolean(),changes:z.boolean(),matches:z.boolean(),fees:z.boolean(),awards:z.boolean(),upcoming:z.boolean()}).strict();
export type ReminderPreferences=z.infer<typeof reminderPreferences>;
export const defaultReminderPreferences:ReminderPreferences={signup:true,registration:true,changes:true,matches:true,fees:true,awards:true,upcoming:true};
export type Reminder={id:string;kind:ReminderKind;eventId:string;title:string;body:string;tab:'overview'|'rounds'|'fees'|'social';accountIds:string[];expires:number;playerId?:string;bookingId?:string;status?:string;roundId?:string;settlementId?:string;settlementVersion?:number;/** Proxied friends whose bills this notice covers. */proxyPlayerIds?:string[];/** An unpaid reminder: repeatable, never deduplicated against the confirmation notice. */due?:boolean;createdAt:number;readAt?:number|null};
const time=new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const slots=(r:Registration)=>r.bookingSignups??[{bookingId:'',status:r.status,arrival:r.arrival,departure:r.departure}];
export function participantIds(s:State,e:Event){const players=new Set(s.registrations.filter(r=>r.eventId===e.id&&slots(r).some(x=>x.status!=='cancelled')).map(r=>r.playerId));return s.accounts.filter(a=>players.has(a.playerId)||a.id===e.creatorId).map(a=>a.id)}
/** Groups a settlement's bills by the account that receives them: a player's own account, or for a proxied friend
 * without an account, the account that registered the friend (see feeContact). */
function billsByContact(s:State,bill:Settlement,bills=bill.bills){
 const groups=new Map<string,{own?:Bill;friends:Bill[]}>();
 for(const b of bills){const c=feeContact(s,b.playerId);if(!c)continue;const g=groups.get(c.accountId)??{friends:[]};if(c.proxy)g.friends.push(b);else g.own=b;groups.set(c.accountId,g)}
 return groups;
}
// Notices never show amounts (they can appear on a lock screen); the fees page shows them.
const friendList=(s:State,friends:Bill[])=>friends.map(b=>s.players.find(p=>p.id===b.playerId)?.name??'代报名朋友').join('、');
/** Confirmation notices: one shared notice for players paying only for themselves, and a personal notice for each
 * account that also registered friends, naming those friends. */
export function feeReminders(s:State,bill:Settlement,now=Date.now()):Reminder[]{
 const e=s.events.find(e=>e.id===bill.eventId&&e.deletedAt===undefined);
 if(!e||!bill.confirmed||['draft','cancelled'].includes(e.status))return [];
 const title=bill.version>1?'费用分摊已更新':'费用分摊已确认',base={kind:'fees' as const,eventId:e.id,title,tab:'fees' as const,expires:now+86400000,createdAt:now,settlementId:bill.id,settlementVersion:bill.version};
 const groups=billsByContact(s,bill),plain=[...groups].filter(([,g])=>!g.friends.length).map(([id])=>id),result:Reminder[]=[];
 if(plain.length)result.push({...base,id:`fees:${e.id}:${bill.id}`,body:`${e.title}的第${bill.version}版分摊已确认，点击查看自己的金额和收款信息。`.slice(0,250),accountIds:plain});
 for(const [accountId,g] of groups)if(g.friends.length)result.push({...base,id:`fees:${e.id}:${bill.id}:${accountId}`,accountIds:[accountId],proxyPlayerIds:g.friends.map(b=>b.playerId),
  body:`${e.title}的第${bill.version}版分摊已确认。${g.own?'除了你自己的费用，':''}你代报名的 ${friendList(s,g.friends)} 的费用也发给你，请代为转交或代付，点击查看金额和收款信息。`.slice(0,250)});
 return result;
}
/** "Remind unpaid": one personal notice per account that still has an unpaid bill of its own or of a proxied friend.
 * Each reminder request gets its own id, so a later reminder reaches people again. */
export function unpaidFeeReminders(s:State,bill:Settlement,key:string,now=Date.now()):Reminder[]{
 const e=s.events.find(e=>e.id===bill.eventId&&e.deletedAt===undefined);
 if(!e||!bill.confirmed||['draft','cancelled'].includes(e.status))return [];
 return [...billsByContact(s,bill,unpaidBills(s,bill))].map(([accountId,g])=>({kind:'fees' as const,eventId:e.id,tab:'fees' as const,expires:now+86400000,createdAt:now,accountIds:[accountId],settlementId:bill.id,settlementVersion:bill.version,due:true,proxyPlayerIds:g.friends.map(b=>b.playerId),
  id:`fees-due:${e.id}:${bill.id}:${key}:${accountId}`,title:'费用提醒：还未付款',
  body:`${e.title}的分摊还未标记付款：${[g.own?'你自己':'',g.friends.length?'你代报名的 '+friendList(s,g.friends):''].filter(Boolean).join('、')}。付款后请在费用页点“标记已付款”。`.slice(0,250)}));
}
export function remindersForChange(next:State,previous:State,actor:string,key:string,now=Date.now()):Reminder[]{
 const result:Reminder[]=[],before=new Map(previous.events.map(e=>[e.id,e]));
 function add(e:Event,kind:ReminderKind,unique:string,title:string,body:string,accountIds:string[],tab:Reminder['tab']='overview',detail:Partial<Reminder>={}){if(!accountIds.length)return;result.push({id:kind==='signup'?e.id:`${e.id}:${key}:${kind}:${unique}`,kind,eventId:e.id,title,body:body.slice(0,250),tab,accountIds:[...new Set(accountIds)],expires:kind==='registration'||kind==='matches'?Math.max(now+3600000,e.end):now+86400000,createdAt:now,...detail})}
 for(const e of newlyOpenedSignups(next,previous,now))add(e,'signup','open','新活动开放报名',`${e.title} · ${time.format(e.start)} · ${e.venue}`,next.accounts.filter(a=>a.id!==actor).map(a=>a.id));
 for(const e of next.events){const old=before.get(e.id);if(!old||e.deletedAt!==undefined||old.deletedAt!==undefined||old.status==='draft')continue;
  const cancelled=e.status==='cancelled'||e.deletedAt!==undefined;
  const changed=(cancelled&&old.status!=='cancelled')||(e.start!==old.start||e.end!==old.end||e.venue!==old.venue||e.address!==old.address)||JSON.stringify(next.bookings.filter(b=>b.eventId===e.id).map(({id,name,start,end,venue,address})=>({id,name,start,end,venue,address})))!==JSON.stringify(previous.bookings.filter(b=>b.eventId===e.id).map(({id,name,start,end,venue,address})=>({id,name,start,end,venue,address})));
  if(changed)add(e,'changes','changed',e.mergedInto?'活动已合并':cancelled?'活动已取消':'活动安排有变更',e.mergedInto?`${e.title}已合并，请查看合并后的活动安排。`:cancelled?`${e.title}已取消，请勿按原计划前往。`:`${e.title}的场地或时间已调整，请核对最新安排。`,[...participantIds(previous,old),...participantIds(next,e)].filter(id=>id!==actor));
  if(!cancelled&&e.status==='ended'&&old.status!=='ended')add(e,'awards','ended','MVP 投票已开放',`${e.title}已结束，来投出本场 MVP。`,next.accounts.filter(a=>a.id!==actor&&canCastAwardVote(next,e,a,now)).map(a=>a.id),'social');
 }
 for(const r of next.registrations){const e=next.events.find(e=>e.id===r.eventId);if(!e||e.deletedAt!==undefined||e.status==='cancelled')continue;const account=next.accounts.find(a=>a.playerId===r.playerId);if(!account)continue;const old=previous.registrations.find(x=>x.id===r.id);
  for(const slot of slots(r)){const prior=old?slots(old).find(x=>x.bookingId===slot.bookingId):undefined;if(prior?.status===slot.status&&prior.arrival===slot.arrival&&prior.departure===slot.departure)continue;if(!prior&&slot.status==='cancelled')continue;const court=next.bookings.find(b=>b.id===slot.bookingId)?.name??e.venue;const promoted=prior?.status==='waitlist'&&slot.status==='confirmed';const title=prior?.status===slot.status?'报名时间已调整':promoted?'候补转正，轮到你了':slot.status==='confirmed'?'报名成功':slot.status==='waitlist'?'已加入候补':'报名已取消';add(e,'registration',r.playerId+slot.bookingId,title,`${e.title} · ${court} · ${time.format(slot.arrival)}${slot.status==='waitlist'?'，等待空位后通知你。':''}`,[account.id],'overview',{playerId:r.playerId,bookingId:slot.bookingId,status:slot.status});}
 }
 for(const round of next.rounds){if(round.status!=='published'||previous.rounds.find(r=>r.id===round.id)?.status==='published')continue;const e=next.events.find(e=>e.id===round.eventId);if(!e||e.deletedAt!==undefined||e.status==='cancelled')continue;const playing=new Set(next.matches.filter(m=>m.roundId===round.id&&m.status==='published').flatMap(m=>[...m.a,...m.b]));add(e,'matches',round.id,'你的分组已发布',`${e.title} · ${time.format(round.start)}，打开活动查看场地、搭档和对手。`,next.accounts.filter(a=>playing.has(a.playerId)&&a.id!==actor).map(a=>a.id),'rounds',{roundId:round.id});}
 for(const bill of next.settlements){if(!bill.confirmed||previous.settlements.some(b=>b.id===bill.id&&b.confirmed))continue;result.push(...feeReminders(next,bill,now));}
 return result;
}
export function upcomingReminders(s:State,accountId:string,now=Date.now()):Reminder[]{
 const account=s.accounts.find(a=>a.id===accountId);if(!account)return [];const result:Reminder[]=[];
 for(const r of s.registrations.filter(r=>r.playerId===account.playerId)){const e=s.events.find(e=>e.id===r.eventId&&e.deletedAt===undefined&&!['draft','ended','cancelled'].includes(e.status));if(!e)continue;for(const slot of slots(r)){if(slot.status!=='confirmed'||slot.arrival<=now||slot.arrival>now+3600000)continue;const b=s.bookings.find(b=>b.id===slot.bookingId);result.push({id:`upcoming:${e.id}:${account.id}:${slot.bookingId}:${slot.arrival}`,kind:'upcoming',eventId:e.id,title:'快到你的打球时间了',body:`${e.title} · ${b?.name??e.venue} · ${time.format(slot.arrival)}`,tab:'overview',accountIds:[account.id],expires:slot.arrival,createdAt:now})}}
 return result;
}
