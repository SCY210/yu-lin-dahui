import {raw} from './store';
import {emptyState} from './domain/types';
import {defaultReminderPreferences,reminderPreferences,remindersForChange,upcomingReminders,feeReminder,type Reminder,type ReminderPreferences} from './reminder-contract';
import {signupPushStatements} from './push-outbox';
import type {State} from './domain/types';
export async function preferencesFor(accountId:string):Promise<ReminderPreferences>{const r=await raw().prepare('SELECT payload FROM reminder_settings WHERE account_id=?').bind(accountId).first<{payload:string}>();if(!r)return {...defaultReminderPreferences};const parsed=reminderPreferences.safeParse(JSON.parse(r.payload));return parsed.success?parsed.data:{...defaultReminderPreferences}}
export function inboxStatements(notice:Reminder){return notice.accountIds.map(accountId=>{
 const base=[notice.id+':'+accountId,accountId,notice.eventId,notice.kind,JSON.stringify(notice),notice.createdAt,accountId];
 if(notice.kind==='fees'&&notice.settlementId){const suffix=':fees:'+notice.settlementId;return raw().prepare(`INSERT INTO reminder_inbox(id,account_id,event_id,kind,payload,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM accounts a JOIN players p ON p.id=a.player_id WHERE a.id=? AND json_extract(p.payload,'$.enabled')=1) AND NOT EXISTS(SELECT 1 FROM reminder_inbox WHERE account_id=? AND event_id=? AND kind='fees' AND (json_extract(payload,'$.settlementId')=? OR substr(json_extract(payload,'$.id'),-length(?))=?)) ON CONFLICT(id) DO NOTHING`).bind(...base,accountId,notice.eventId,notice.settlementId,suffix,suffix)}
 return raw().prepare(`INSERT INTO reminder_inbox(id,account_id,event_id,kind,payload,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM accounts a JOIN players p ON p.id=a.player_id WHERE a.id=? AND json_extract(p.payload,'$.enabled')=1) ON CONFLICT(id) DO NOTHING`).bind(...base);
 })}
export function clubReminderStatements(next:State,previous:State,actorId:string,key:string,action:string,now=Date.now()){
 const statements=signupPushStatements(next,previous,actorId,key,action,now),db=raw();
 const notices=remindersForChange(next,previous,actorId,key,now);
 if(action==='notifyFees'){const audit=next.audits.at(-1);if(audit?.action==='notifyFees'){const id=(audit.changes as {settlementId?:string})?.settlementId,bill=next.settlements.find(b=>b.id===id);if(bill){const notice=feeReminder(next,bill,now);if(notice)notices.push(notice)}}}
 for(const notice of notices){
  statements.push(...inboxStatements(notice));if(notice.kind==='signup')continue;
  statements.push(db.prepare('INSERT INTO push_jobs(id,event_id,request_key,created_at,message) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(notice.id,notice.eventId,key,now,JSON.stringify(notice)));
  statements.push(db.prepare(`INSERT INTO push_deliveries(id,job_id,subscription_id,next_at) SELECT ?||':'||s.id,?,s.id,? FROM push_subscriptions s JOIN push_jobs j ON j.id=? AND j.request_key=? WHERE EXISTS(SELECT 1 FROM reminder_inbox i WHERE i.account_id=s.account_id AND json_extract(i.payload,'$.id')=?) AND s.created_at<=? ON CONFLICT(id) DO NOTHING`).bind(notice.id,notice.id,now,notice.id,key,notice.id,now));
 }
 return statements;
}
export async function reminderCenter(accountId:string){
 const state=emptyState(),parts=await raw().batch([
  raw().prepare('SELECT payload FROM accounts WHERE id=?').bind(accountId),
  raw().prepare('SELECT payload FROM registrations WHERE player_id=(SELECT player_id FROM accounts WHERE id=?)').bind(accountId),
  raw().prepare('SELECT payload FROM events WHERE id IN (SELECT event_id FROM registrations WHERE player_id=(SELECT player_id FROM accounts WHERE id=?))').bind(accountId),
  raw().prepare('SELECT payload FROM bookings WHERE event_id IN (SELECT event_id FROM registrations WHERE player_id=(SELECT player_id FROM accounts WHERE id=?))').bind(accountId)
 ]);(['accounts','registrations','events','bookings'] as const).forEach((key,index)=>{(state[key] as unknown[])=parts[index].results.map(row=>JSON.parse(String((row as {payload:string}).payload)))});
 const now=Date.now(),preferences=await preferencesFor(accountId),upcoming=preferences.upcoming?upcomingReminders(state,accountId,now):[],qs=upcoming.flatMap(inboxStatements);if(qs.length)await raw().batch(qs);
 const currentIds=new Set(upcoming.map(n=>n.id)),old=(await raw().prepare("SELECT id,payload FROM reminder_inbox WHERE account_id=? AND kind='upcoming'").bind(accountId).all<{id:string;payload:string}>()).results;
 const stale=old.filter(row=>!currentIds.has(JSON.parse(row.payload).id)).map(row=>raw().prepare('DELETE FROM reminder_inbox WHERE id=? AND account_id=?').bind(row.id,accountId));if(stale.length)await raw().batch(stale);
 await raw().prepare('DELETE FROM reminder_inbox WHERE account_id=? AND kind=\'upcoming\' AND json_extract(payload,\'$.expires\')<=?').bind(accountId,now).run();
 const results=await raw().batch([raw().prepare('SELECT id,payload,read_at AS readAt,created_at AS createdAt FROM reminder_inbox WHERE account_id=? AND created_at>? ORDER BY created_at DESC,id DESC LIMIT 40').bind(accountId,now-30*86400000),raw().prepare('SELECT COUNT(*) AS count FROM reminder_inbox WHERE account_id=? AND read_at IS NULL AND created_at>?').bind(accountId,now-30*86400000)]);
 const items=(results[0].results as unknown as {id:string;payload:string;readAt:number|null;createdAt:number}[]).map(row=>{const n=JSON.parse(String(row.payload)) as Reminder;return {id:String(row.id),kind:n.kind,eventId:n.eventId,title:n.title,body:n.body,tab:n.tab,createdAt:Number(row.createdAt),readAt:row.readAt===null?null:Number(row.readAt)}});
 return {items,unread:Number((results[1].results[0] as {count:number}|undefined)?.count??0),preferences:await preferencesFor(accountId)};
}
