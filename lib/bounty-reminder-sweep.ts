import {emptyState} from './domain/types';
import {bountyOfferMinutes,drawnBounty} from './domain/bounties';
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
 const told=new Set(parse(6).map(n=>n.id));
 // Only an untold upset candidate with a published lineup needs historical ratings. Never replay a partial history.
 if(s.registrations.some(r=>r.status==='confirmed'&&!told.has(`bounty:${r.eventId}:${r.playerId}`)&&drawnBounty(r.eventId,r.playerId)==='upset'&&s.matches.some(m=>m.eventId===r.eventId&&m.status==='published'&&[...m.a,...m.b].includes(r.playerId)))){
  const history=await db.batch<{payload:string}>([
   db.prepare('SELECT payload FROM events'),
   db.prepare("SELECT payload FROM matches WHERE json_extract(payload,'$.status') IN ('complete','forfeit')"),
   db.prepare("SELECT payload FROM audits WHERE json_extract(payload,'$.action')='grantPoints'"),
   db.prepare(`SELECT payload FROM rounds WHERE event_id IN (${soon})`).bind(...window),
   db.prepare(`SELECT payload FROM bookings WHERE event_id IN (${soon})`).bind(...window),
  ]);
  const rows=(i:number)=>history[i].results.map(row=>JSON.parse(String(row.payload)));
  s.events=rows(0);s.matches=[...new Map([...s.matches,...rows(1)].map(m=>[m.id,m])).values()];s.audits=rows(2);s.rounds=rows(3);s.bookings=rows(4);
 }
 const notices=bountyReminders(s,now).filter(n=>!told.has(n.id));
 if(!notices.length)return {sent:0};
 await db.batch(notices.flatMap(notice=>noticeStatements(notice,'bounty-reminders:'+now,now)));
 return {sent:notices.length};
}
