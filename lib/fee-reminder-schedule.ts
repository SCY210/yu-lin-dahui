/** When the hourly cron sends automatic unpaid-fee reminders (docs/FEE_PAYMENTS.md). Shared by the server sweep and the
 * app, so the home page marks a bill overdue at the same moment the owner and administrators are told. */
const hour=3600000,day=24*hour;
export const automaticFeeReminders=3;

const madridHour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'2-digit',hourCycle:'h23'});
/** Reminders go out between 09:00 and 21:59 in Madrid; one that falls due at night waits for the morning. */
export function reminderHours(now:number){const h=Number(madridHour.format(now));return h>=9&&h<22}

/** The first hourly cron tick at or after `due` that falls in reminder hours. */
export function nextReminderTick(due:number){
 let t=Math.ceil(due/hour)*hour;
 for(let i=0;i<24&&!reminderHours(t);i++)t+=hour;
 return t;
}
/** When bills still unpaid after the automatic reminders count as overdue: the tick, a day after the last reminder,
 * that tells the owner and administrators. */
export function feeOverdueAt(confirmedAt:number){return nextReminderTick(confirmedAt+(automaticFeeReminders+1)*day)}
