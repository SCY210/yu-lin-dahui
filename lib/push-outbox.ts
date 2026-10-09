import {raw} from './store';
import {newlyOpenedSignups,signupPushMessage,pushSubscriptionInput} from './push-contract';
import {pushConfiguration,sendWebPush,type PushEnvironment} from './push-crypto';
import {reminderPreferences,defaultReminderPreferences,reminderKinds,type Reminder} from './reminder-contract';
import type {State,Event,Account,Player} from './domain/types';

export function signupPushStatements(next:State,previous:State,actorId:string,requestKey:string,action:string,now=Date.now()){
 if(!['event','eventStatus'].includes(action))return [];
 const db=raw(),statements:D1PreparedStatement[]=[];
 for(const event of newlyOpenedSignups(next,previous,now)){
  statements.push(db.prepare('INSERT INTO push_jobs(id,event_id,request_key,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(event.id,event.id,requestKey,now));
  // Recipient snapshot shares the club transaction. Later subscribers never
  // receive old activity notices; reopening a known job cannot add recipients.
  statements.push(db.prepare(`INSERT INTO push_deliveries(id,job_id,subscription_id,next_at)
   SELECT ?||':'||s.id,?,s.id,? FROM push_subscriptions s JOIN push_jobs j ON j.id=? AND j.request_key=?
   WHERE s.account_id<>? AND s.created_at<=? ON CONFLICT(id) DO NOTHING`).bind(event.id,event.id,now,event.id,requestKey,actorId,now));
 }
 return statements;
}
type Delivery={id:string;subscriptionId:string;subscription:string;event:string;account:string;player:string;createdAt:number;attempts:number;message:string|null;preferences:string|null;registration:string|null};
/** The Worker keeps this durable outbox alive after the response. Bounded
 * batches drain on subsequent club requests too; one failed device cannot fail
 * an activity save or prevent another device's delivery. */
export async function flushPushOutbox(source:PushEnvironment,send:typeof fetch=fetch){
 const config=pushConfiguration(source);if(!config)return;
 const db=raw(),deadline=Date.now()+24000;
 await db.prepare('DELETE FROM push_jobs WHERE created_at<?').bind(Date.now()-7*86400000).run();
 while(Date.now()<deadline-4500){
  const now=Date.now();const rows=(await db.prepare(`SELECT d.id,d.subscription_id AS subscriptionId,s.payload AS subscription,e.payload AS event,a.payload AS account,p.payload AS player,j.created_at AS createdAt,d.attempts,j.message,rs.payload AS preferences,r.payload AS registration
   FROM push_deliveries d JOIN push_jobs j ON j.id=d.job_id JOIN push_subscriptions s ON s.id=d.subscription_id JOIN events e ON e.id=j.event_id JOIN accounts a ON a.id=s.account_id JOIN players p ON p.id=a.player_id LEFT JOIN reminder_settings rs ON rs.account_id=a.id LEFT JOIN registrations r ON r.event_id=e.id AND r.player_id=p.id
   WHERE d.next_at<=? AND d.attempts<3 AND (d.state IN ('pending','retry') OR (d.state='sending' AND d.lease_until<=?)) ORDER BY d.next_at,d.id LIMIT 12`).bind(now,now).all<Delivery>()).results;
  if(!rows.length)break;
  await Promise.allSettled(rows.map(async row=>{
   const claimed=await db.prepare("UPDATE push_deliveries SET state='sending',attempts=attempts+1,lease_until=? WHERE id=? AND attempts=? AND (state IN ('pending','retry') OR (state='sending' AND lease_until<=?))").bind(now+60000,row.id,row.attempts,now).run();
   if(!claimed.meta.changes)return;
   let state='retry';
   try{
    const event:Event=JSON.parse(row.event),account:Account=JSON.parse(row.account),player:Player=JSON.parse(row.player);
    const notice:Reminder|null=row.message?JSON.parse(row.message):null;
    const preference=reminderPreferences.safeParse(row.preferences?JSON.parse(row.preferences):defaultReminderPreferences),kind=notice?.kind??'signup';
    let relevant=event.deletedAt===undefined&&(!notice?(event.status==='open'&&event.end>Date.now()):reminderKinds.includes(notice.kind)&&notice.accountIds.includes(account.id)&&notice.eventId===event.id&&notice.expires>Date.now()&&(notice.kind==='changes'||!['draft','cancelled'].includes(event.status)));
    if(notice?.kind==='registration'){const r=row.registration?JSON.parse(row.registration):null;const slot=notice.bookingId?r?.bookingSignups?.find((x:{bookingId:string})=>x.bookingId===notice.bookingId):r;relevant=relevant&&slot?.status===notice.status}
    if(notice?.kind==='matches'&&notice.roundId){const round=await db.prepare('SELECT payload FROM rounds WHERE id=?').bind(notice.roundId).first<{payload:string}>();const match=(await db.prepare('SELECT payload FROM matches WHERE round_id=?').bind(notice.roundId).all<{payload:string}>()).results.map(r=>JSON.parse(r.payload));relevant=relevant&&!!round&&['published','playing'].includes(JSON.parse(round.payload).status)&&match.some(m=>['published','playing'].includes(m.status)&&[...m.a,...m.b].includes(player.id))}
    if(notice?.kind==='awards')relevant=relevant&&(event.status==='ended'||event.end<=Date.now());
    if(notice?.kind==='fees'){
     const latest=(await db.prepare('SELECT payload FROM settlements WHERE event_id=? ORDER BY version DESC').bind(event.id).all<{payload:string}>()).results.map(r=>JSON.parse(r.payload)).find(b=>b.confirmed);
     relevant=relevant&&!!latest&&(notice.settlementId?latest.id===notice.settlementId:notice.id.endsWith(':fees:'+latest.id))&&latest.bills.some((b:{playerId:string})=>b.playerId===player.id||(notice.proxyPlayerIds??[]).includes(b.playerId));
    }
    if(!player.enabled||account.playerId!==player.id||!relevant||(preference.success&&!preference.data[kind])||row.createdAt<Date.now()-86400000){state='cancelled'}
    else{
     const subscription=pushSubscriptionInput.parse(JSON.parse(row.subscription));
     const status=await sendWebPush(subscription,notice?{title:'羽林大会 · '+notice.title,body:notice.body,eventId:notice.eventId,kind:notice.kind,tab:notice.tab,tag:'yulin-reminder-'+notice.id}:signupPushMessage(event),config,send,notice?Math.floor((notice.expires-Date.now())/1000):86400);
     if(status===404||status===410){await db.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(row.subscriptionId).run();return}
     if(status>=200&&status<300)state='sent';else if(status>=400&&status<500&&status!==429)state='failed';
    }
   }catch{ /* Network or encryption failure: retry without logging private endpoints. */ }
   if(state==='retry'&&row.attempts>=2)state='failed';
   await db.prepare('UPDATE push_deliveries SET state=?,next_at=?,lease_until=0 WHERE id=?').bind(state,Date.now()+30000*(row.attempts+1),row.id).run();
  }));
 }
}
