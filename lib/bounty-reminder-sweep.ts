import {emptyState} from './domain/types';
import {bountyOfferMinutes} from './domain/bounties';
import {bountyReminders} from './bounty-reminders';
import {noticeStatements} from './reminder-store';

/** Every ten minutes (build/sites-worker.ts). An idle tick runs one small query for activities starting in the next
 * 30 minutes; members already told are skipped, and the notices commit in one batch. */
export async function runBountyReminderSweep({db,now}:{db:D1Database;now:number}){
 const soon="SELECT id FROM events WHERE json_extract(payload,'$.start')>? AND json_extract(payload,'$.start')<=? AND json_extract(payload,'$.deletedAt') IS NULL",window=[now,now+bountyOfferMinutes*60000];
 if(!await db.prepare(soon+' LIMIT 1').bind(...window).first())return {sent:0};
 const rows=await db.batch<{payload:string}>([
  db.prepare('SELECT payload FROM settings WHERE id=?').bind('club'),
  db.prepare(`SELECT payload FROM events WHERE id IN (${soon})`).bind(...window),
  db.prepare(`SELECT payload FROM registrations WHERE event_id IN (${soon})`).bind(...window),
  db.prepare(`SELECT payload FROM matches WHERE event_id IN (${soon})`).bind(...window),
  db.prepare('SELECT payload FROM accounts'),
  db.prepare('SELECT payload FROM players'),
  db.prepare(`SELECT payload FROM reminder_inbox WHERE kind='bounty' AND event_id IN (${soon})`).bind(...window),
 ]);
 const parse=(index:number)=>rows[index].results.map(row=>JSON.parse(String(row.payload)));
 const s=emptyState(),settings=parse(0)[0];if(!settings?.initialized)return {sent:0};
 s.settings=settings;s.events=parse(1);s.registrations=parse(2);s.matches=parse(3);s.accounts=parse(4);s.players=parse(5);
 const told=new Set(parse(6).map(n=>n.id)),notices=bountyReminders(s,now).filter(n=>!told.has(n.id));
 if(!notices.length)return {sent:0};
 await db.batch(notices.flatMap(notice=>noticeStatements(notice,'bounty-reminders:'+now,now)));
 return {sent:notices.length};
}
