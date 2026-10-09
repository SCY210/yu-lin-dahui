import {canCastAwardVote} from './domain/activity-voting';
import {z} from 'zod';
import type {State,Event,Registration,Settlement} from './domain/types';
import {newlyOpenedSignups} from './push-contract';
export const reminderKinds=['signup','registration','changes','matches','fees','awards','upcoming'] as const;
export type ReminderKind=typeof reminderKinds[number];
export const reminderLabels:Record<ReminderKind,string>={signup:'新活动开放',registration:'我的报名与候补',changes:'活动变更与取消',matches:'我的分组安排',fees:'费用确认',awards:'赛后评选',upcoming:'临近开场'};
export const reminderPreferences=z.object({signup:z.boolean(),registration:z.boolean(),changes:z.boolean(),matches:z.boolean(),fees:z.boolean(),awards:z.boolean(),upcoming:z.boolean()}).strict();
export type ReminderPreferences=z.infer<typeof reminderPreferences>;
export const defaultReminderPreferences:ReminderPreferences={signup:true,registration:true,changes:true,matches:true,fees:true,awards:true,upcoming:true};
export type Reminder={id:string;kind:ReminderKind;eventId:string;title:string;body:string;tab:'overview'|'rounds'|'fees'|'social';accountIds:string[];expires:number;playerId?:string;bookingId?:string;status?:string;roundId?:string;settlementId?:string;settlementVersion?:number;createdAt:number;readAt?:number|null};
const time=new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const slots=(r:Registration)=>r.bookingSignups??[{bookingId:'',status:r.status,arrival:r.arrival,departure:r.departure}];
export function participantIds(s:State,e:Event){const players=new Set(s.registrations.filter(r=>r.eventId===e.id&&slots(r).some(x=>x.status!=='cancelled')).map(r=>r.playerId));return s.accounts.filter(a=>players.has(a.playerId)||a.id===e.creatorId).map(a=>a.id)}
export function feeReminder(s:State,bill:Settlement,now=Date.now()):Reminder|null{
 const e=s.events.find(e=>e.id===bill.eventId&&e.deletedAt===undefined);
 if(!e||!bill.confirmed||['draft','cancelled'].includes(e.status))return null;
 const members=new Set(bill.bills.map(b=>b.playerId)),accountIds=s.accounts.filter(a=>members.has(a.playerId)&&s.players.some(p=>p.id===a.playerId&&p.enabled)).map(a=>a.id);
 if(!accountIds.length)return null;
 return {id:`fees:${e.id}:${bill.id}`,kind:'fees',eventId:e.id,title:bill.version>1?'费用分摊已更新':'费用分摊已确认',body:`${e.title}的第${bill.version}版分摊已确认，点击查看自己的金额和收款信息。`.slice(0,250),tab:'fees',accountIds,expires:now+86400000,createdAt:now,settlementId:bill.id,settlementVersion:bill.version};
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
 for(const bill of next.settlements){if(!bill.confirmed||previous.settlements.some(b=>b.id===bill.id&&b.confirmed))continue;const notice=feeReminder(next,bill,now);if(notice)result.push(notice);}
 return result;
}
export function upcomingReminders(s:State,accountId:string,now=Date.now()):Reminder[]{
 const account=s.accounts.find(a=>a.id===accountId);if(!account)return [];const result:Reminder[]=[];
 for(const r of s.registrations.filter(r=>r.playerId===account.playerId)){const e=s.events.find(e=>e.id===r.eventId&&e.deletedAt===undefined&&!['draft','ended','cancelled'].includes(e.status));if(!e)continue;for(const slot of slots(r)){if(slot.status!=='confirmed'||slot.arrival<=now||slot.arrival>now+3600000)continue;const b=s.bookings.find(b=>b.id===slot.bookingId);result.push({id:`upcoming:${e.id}:${account.id}:${slot.bookingId}:${slot.arrival}`,kind:'upcoming',eventId:e.id,title:'快到你的打球时间了',body:`${e.title} · ${b?.name??e.venue} · ${time.format(slot.arrival)}`,tab:'overview',accountIds:[account.id],expires:slot.arrival,createdAt:now})}}
 return result;
}
