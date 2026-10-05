import type {Account,Settings,State} from './domain/types';
import {attendanceForEvent} from './domain/attendance';

const roundDuration=20*60000;
const maxAge=5*60000;
export type ClubReadVersion={revision:number;settings:Settings;account:Account|null};
export type ClubReadIdentity={userId:string;method:string;username:string|null};
const scope=(version:ClubReadVersion,identity:ClubReadIdentity,period:string,year:number)=>JSON.stringify([
 version.revision,version.settings.initialized,version.settings.ownerAccountId??null,version.account,
 identity.userId,identity.method,identity.username,period,year,
]);

/** Only validators are retained, never a shared response or an unfiltered state.
 * A different Worker / a cold start is a harmless miss and reads a full snapshot. */
export function createClubReadCache(limit=256){
 const entries=new Map<string,{scope:string;expires:number}>();
 return {
  matches(token:string|null,version:ClubReadVersion,identity:ClubReadIdentity,period:string,year:number,now:number){
   if(!token||!version.settings.initialized||!version.account)return false;
   const entry=entries.get(token);
   if(!entry)return false;
   if(now>=entry.expires){entries.delete(token);return false}
   return entry.scope===scope(version,identity,period,year);
  },
  remember(version:ClubReadVersion,identity:ClubReadIdentity,period:string,year:number,expires:number,now:number){
   if(expires<=now)return null;
   for(const [key,value] of entries)if(value.expires<=now)entries.delete(key);
   while(entries.size>=limit)entries.delete(entries.keys().next().value!);
   const token='"club-'+crypto.randomUUID()+'"';
   entries.set(token,{scope:scope(version,identity,period,year),expires:Math.min(expires,now+maxAge)});
   return token;
  },
 };
}

/** An unchanged revision is not enough: fees have continuously elapsed minutes,
 * and availability / personality / remaining rounds change at clock boundaries.
 * Keep live activities on full refresh and expire other views before a boundary. */
export function clubViewValidUntil(s:State,a:Account,now:number){
 let expires=now+maxAge;
 const boundary=(at:number)=>{if(at>now)expires=Math.min(expires,at)};
 const events=s.events.filter(e=>e.deletedAt===undefined&&(a.role==='admin'||e.status!=='draft'||e.creatorId===a.id));
 for(const e of events){
  if(e.start<=now&&now<e.end)return now;
  boundary(e.start);boundary(e.end);
  // floor((end-now)/duration) loses a round immediately after each exact boundary.
  if(e.end>now)boundary(now+(e.end-now)%roundDuration+1);
  for(const attendance of attendanceForEvent(s,e)){
   boundary(attendance.start);
   if(attendance.end!==null){boundary(attendance.end);boundary(attendance.end-roundDuration+1)}
  }
  for(const booking of s.bookings.filter(b=>b.eventId===e.id)){
   boundary(booking.start);boundary(booking.end-roundDuration+1);
  }
 }
 return expires;
}
