import {getAppCredential} from './auth';
import {raw} from './store';
import {canManageEvent} from './domain/permissions';
import type {Account,Event,Photo} from './domain/types';

type PhotoAccessRow={accountPayload:string|null;photoPayload:string|null;eventPayload:string|null};
export type AuthorizedPhoto={status:200;account:Account;photo:Photo}|{status:401|403|404};

/** Fresh session, membership and visibility checks in one indexed D1 trip.
 * Never cache this result: revocation must also precede image cache/304 hits. */
export async function readAuthorizedPhoto(id:string):Promise<AuthorizedPhoto>{
 const credential=await getAppCredential();if(!credential)return {status:401};
 const db=raw();
 const row=credential.method==='password'
  ?await db.prepare(`SELECT a.payload AS accountPayload,p.payload AS photoPayload,e.payload AS eventPayload
   FROM auth_sessions s JOIN password_credentials c ON c.id=s.user_id
   LEFT JOIN accounts a ON a.id=s.user_id LEFT JOIN photos p ON p.id=?
   LEFT JOIN events e ON e.id=json_extract(p.payload,'$.eventId') WHERE s.id=? AND s.expires>?`)
   .bind(id,credential.sessionId,Date.now()).first<PhotoAccessRow>()
  :await db.prepare(`SELECT a.payload AS accountPayload,p.payload AS photoPayload,e.payload AS eventPayload
   FROM accounts a LEFT JOIN photos p ON p.id=?
   LEFT JOIN events e ON e.id=json_extract(p.payload,'$.eventId') WHERE a.id=?`)
   .bind(id,credential.user.userId).first<PhotoAccessRow>();
 if(!row)return {status:credential.method==='password'?401:403};
 if(!row.accountPayload)return {status:403};
 if(!row.photoPayload)return {status:404};
 const account=JSON.parse(row.accountPayload) as Account,photo=JSON.parse(row.photoPayload) as Photo;
 if(photo.eventId){
  const event=row.eventPayload?JSON.parse(row.eventPayload) as Event:null;
  if(!event||event.deletedAt!==undefined||event.status==='draft'&&!canManageEvent(account,event))return {status:404};
 }
 return {status:200,account,photo};
}
