import type {Account,Event,Settings,State} from './domain/types';
import {awardVotingClosesAt} from './domain/activity-voting';
import {attendanceForEvent,usesAutomaticAttendance} from './domain/attendance';
import {registrationSpans} from './domain/booking-signups';
import {pointsWindow} from './domain/points-window';
import {inactivityDeadline,isRatedMatch} from './domain/realm-rating';
import {month} from './domain/types';
import {nextQuarterStart} from './ranking-quarter';

const minute=60000,roundDuration=20*minute;
const maxAge=5*60000;
/** While an activity runs, a view is reused for at most this long even if no clock boundary below applies. */
export const liveMaxAge=15000;
export type ClubReadVersion={revision:number;settings:Settings;account:Account|null;profileRestrictions?:State['profileRestrictions'];noticeScope?:{version:string;contentHash:string}};
export type ClubReadIdentity={userId:string;method:string;username:string|null;activityId?:string};
const scope=(version:ClubReadVersion,identity:ClubReadIdentity,period:string,year:number)=>JSON.stringify([
 version.noticeScope??null,version.profileRestrictions??null,version.revision,version.settings.initialized,version.settings.ownerAccountId??null,version.account,
 identity.userId,identity.method,identity.username,period,year,identity.activityId??null,
]);

/** Only validators are retained, never a shared response or an unfiltered state.
 * A different Worker / a cold start is a harmless miss and reads a full snapshot. */
export function createClubReadCache(limit=256){
 const entries=new Map<string,{scope:string;expires:number}>();
 const match=(header:string|null,version:ClubReadVersion,identity:ClubReadIdentity,period:string,year:number,now:number):string|null=>{
  if(!header||header.length>8192||!version.settings.initialized||!version.account)return null;
  const expected=scope(version,identity,period,year);
  // GET validators use weak comparison. Proxies may weaken ETags after compression.
  for(const candidate of header.split(',')){
   const value=candidate.trim();
   if(!/^(?:W\/)?"club-[0-9a-f-]{36}"$/.test(value))continue;
   const token=value.startsWith('W/')?value.slice(2):value,entry=entries.get(token);
   if(!entry)continue;
   if(now>=entry.expires){entries.delete(token);continue}
   if(entry.scope===expected)return token;
  }
  return null;
 };
 return {
  match,
  matches(...args:Parameters<typeof match>){return match(...args)!==null},
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

/** Clock moments inside a running activity at which a member's view, or the clock-driven maintenance that only runs
 * on a full read (auto-started rounds, refilled live courts), can change without a write. */
function liveBoundaries(s:State,e:Event,boundary:(at:number)=>void,now:number){
 const round=(e.pointsPlan?.roundMinutes??15)*minute,window=pointsWindow(e),cuts=[e.start,e.end];
 boundary(window.start);boundary(window.end);
 for(const r of s.rounds)if(r.eventId===e.id){boundary(r.start);boundary(r.start+r.duration*minute)}
 // Courts and players count for a round only while they remain for its whole length.
 for(const b of s.bookings)if(b.eventId===e.id){cuts.push(b.start,b.end);boundary(b.end-round+1)}
 for(const r of s.registrations)if(r.eventId===e.id)for(const span of registrationSpans(s,e,r)){cuts.push(span.start,span.end??e.end);boundary((span.end??e.end)-round+1)}
 for(const at of cuts){
  boundary(at);
  // The remaining rounds of the current attendance/court phase (pointsRoundWindows) drop by one each time fewer than
  // five minutes are left beyond a whole number of rounds before the phase ends.
  for(let k=0;k<=48&&at-(k*round+5*minute)>now;k++)boundary(at-(k*round+5*minute));
 }
}

/** An unchanged revision is not enough: availability / personality / remaining rounds change at clock boundaries.
 * During a running activity the view is reused only until its next live boundary, and for liveMaxAge at most;
 * other views expire before their next boundary. Fee estimates of a running activity use its planned end. */
export function clubViewValidUntil(s:State,a:Account,now:number){
 let expires=now+maxAge;
 const boundary=(at:number)=>{if(at>now)expires=Math.min(expires,at)};
 boundary(nextQuarterStart(month(now)));
 const events=s.events.filter(e=>e.deletedAt===undefined&&(a.role==='admin'||e.status!=='draft'||e.creatorId===a.id));
 for(const e of events){
  if(e.start<=now&&now<e.end){
   // Legacy check-in attendance bills elapsed minutes continuously: keep those activities on full refresh.
   if(!usesAutomaticAttendance(e))return now;
   expires=Math.min(expires,now+liveMaxAge);liveBoundaries(s,e,boundary,now);
  }
  boundary(e.start);boundary(e.end);
  for(const attendance of attendanceForEvent(s,e)){
   boundary(attendance.start);
   if(attendance.end!==null){boundary(attendance.end);boundary(attendance.end-roundDuration+1)}
  }
  for(const booking of s.bookings.filter(b=>b.eventId===e.id)){
   boundary(booking.start);boundary(booking.end-roundDuration+1);
  }
 }
 // A historical score can be entered with a future end time. Achievements only
 // unlock when that completed fact has actually happened.
 // Realms settle when an activity with results ends, even one this account cannot see.
 const scored=new Set(s.matches.filter(m=>m.status==='complete').map(m=>m.eventId));
 for(const e of s.events)if(scored.has(e.id))boundary(e.end);
 const visibleIds=new Set(s.events.filter(e=>a.role==='admin'||e.status!=='draft'||e.creatorId===a.id).map(e=>e.id));
 for(const m of s.matches)if(m.status==='complete'&&visibleIds.has(m.eventId)&&m.end!==null)boundary(m.end);
 // Derived realm/placement and grouping strength can restart without a write.
 for(const m of s.matches)if(isRatedMatch(m,now))boundary(inactivityDeadline(m.end!));
 // MVP voting closes on the clock: the result, its points and the winner's notice appear without a write.
 const voted=new Set(s.awardVotes.map(v=>v.eventId));
 for(const e of s.events)if(voted.has(e.id))boundary(awardVotingClosesAt(e));
 return expires;
}
