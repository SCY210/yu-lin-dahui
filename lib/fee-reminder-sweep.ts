import {emptyState} from './domain/types';
import {dueFeeReminders,feeReminderLookback,feeReminderSweepKey,reminderHours,type FeeReminderProgress} from './fee-reminders';
import {noticeStatements} from './reminder-store';

const day=24*3600000;
/** Hourly. An idle tick runs one small query; the notices and the new progress commit together, so a
 * failed or repeated tick never sends a step twice. */
export async function runFeeReminderSweep({db,now}:{db:D1Database;now:number}){
 if(!reminderHours(now))return {sent:0};
 const since=now-feeReminderLookback;
 const candidate=await db.prepare("SELECT 1 AS due FROM settlements WHERE json_extract(payload,'$.confirmed')=1 AND json_extract(payload,'$.created')>? AND json_extract(payload,'$.created')<=? LIMIT 1").bind(since,now-day).first();
 if(!candidate)return {sent:0};
 const recent="SELECT event_id FROM settlements WHERE json_extract(payload,'$.created')>?";
 const rows=await db.batch<{payload:string}>([
  db.prepare('SELECT payload FROM settings WHERE id=?').bind('club'),
  db.prepare('SELECT payload FROM settings WHERE id=?').bind(feeReminderSweepKey),
  db.prepare(`SELECT payload FROM events WHERE id IN (${recent})`).bind(since),
  db.prepare("SELECT payload FROM settlements WHERE json_extract(payload,'$.created')>?").bind(since),
  db.prepare(`SELECT payload FROM payments WHERE event_id IN (${recent})`).bind(since),
  db.prepare('SELECT payload FROM accounts'),
  db.prepare('SELECT payload FROM players'),
 ]);
 const parse=(index:number)=>rows[index].results.map(row=>JSON.parse(String(row.payload)));
 const s=emptyState(),settings=parse(0)[0];if(!settings?.initialized)return {sent:0};
 s.settings=settings;s.events=parse(2);s.settlements=parse(3);s.payments=parse(4);s.accounts=parse(5);s.players=parse(6);
 const stored=parse(1)[0] as {progress?:FeeReminderProgress}|undefined;
 const {notices,progress}=dueFeeReminders(s,stored?.progress??{},now);
 if(!notices.length&&JSON.stringify(progress)===JSON.stringify(stored?.progress??{}))return {sent:0};
 const key='fee-reminders:'+now;
 await db.batch([...notices.flatMap(notice=>noticeStatements(notice,key,now)),
  db.prepare('INSERT INTO settings(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(feeReminderSweepKey,JSON.stringify({progress,at:now}))]);
 return {sent:notices.length};
}
