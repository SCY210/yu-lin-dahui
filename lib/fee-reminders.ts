import type {State} from './domain/types';
import {feeContact,unpaidBills} from './domain/fee-payments';
import {clubOwnerId} from './domain/ownership';
import {unpaidFeeReminders,type Reminder} from './reminder-contract';

/** Automatic unpaid-fee reminders (docs/FEE_PAYMENTS.md). The hourly cron reminds everyone who still owes 24, 48 and
 * 72 hours after a split is confirmed, then tells the owner and administrators once, 24 hours after the third reminder,
 * if bills are still unpaid. Organisers can still remind by hand at any time. */
export const feeReminderSweepKey='fee-reminder-sweep-v1';
export const automaticFeeReminders=3;
const hour=3600000,day=24*hour;
/** Only recent splits: the whole sequence takes four days; older unpaid bills are left to the organisers. */
export const feeReminderLookback=7*day;
/** Progress per confirmed settlement version: reminders sent and whether the owner was told. */
export type FeeReminderProgress=Record<string,{sent:number;escalated?:boolean}>;

const madridHour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'2-digit',hourCycle:'h23'});
/** Reminders go out between 09:00 and 21:59 in Madrid; one that falls due at night waits for the morning. */
export function reminderHours(now:number){const h=Number(madridHour.format(now));return h>=9&&h<22}

const owners=(s:Pick<State,'settings'|'accounts'>)=>[...new Set([clubOwnerId(s as State),...s.accounts.filter(a=>a.role==='admin').map(a=>a.id)])].filter(id=>s.accounts.some(a=>a.id===id));

/** What the sweep at `now` sends, and the progress to store with it. A step missed while the cron was down is sent
 * once, never as a burst. Paid-up, deleted and cancelled activities drop out of the progress. */
export function dueFeeReminders(s:State,progress:FeeReminderProgress,now:number){
 const notices:Reminder[]=[],next:FeeReminderProgress={};
 if(!reminderHours(now))return {notices,progress};
 for(const e of s.events){
  if(e.deletedAt!==undefined||['draft','cancelled'].includes(e.status))continue;
  const bill=s.settlements.filter(b=>b.eventId===e.id&&b.confirmed).sort((a,b)=>b.version-a.version)[0];
  if(!bill||now-bill.created>=feeReminderLookback||now<bill.created)continue;
  const owing=unpaidBills(s,bill).filter(b=>feeContact(s,b.playerId));
  if(!owing.length)continue;
  const record={...(progress[bill.id]??{sent:0})},due=Math.min(automaticFeeReminders,Math.floor((now-bill.created)/day));
  if(record.sent<due){
   notices.push(...unpaidFeeReminders(s,bill,'auto-'+due,now));record.sent=due;
  }else if(record.sent>=automaticFeeReminders&&!record.escalated&&now-bill.created>=(automaticFeeReminders+1)*day){
   const names=owing.map(b=>s.players.find(p=>p.id===b.playerId)?.name??'球友'),accountIds=owners(s);
   if(accountIds.length)notices.push({kind:'fees',eventId:e.id,tab:'fees',expires:now+day,createdAt:now,accountIds,settlementId:bill.id,settlementVersion:bill.version,overdue:true,
    id:`fees-overdue:${e.id}:${bill.id}`,title:'费用提醒：仍有未付款',
    body:`${e.title}的分摊已自动提醒 ${automaticFeeReminders} 次，仍有 ${owing.length} 人未标记付款：${names.join('、')}。可在费用页查看或再次提醒。`.slice(0,250)});
   record.escalated=true;
  }
  next[bill.id]=record;
 }
 return {notices,progress:next};
}

