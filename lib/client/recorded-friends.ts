import {friendKey} from '../domain/guest-friend-key';

type Record={id:string;name:string;guest?:boolean;guestEventId?:string;guestHostId?:string;guestFriendId?:string;guestHidden?:boolean};
export type RecordedFriend<T extends Record>={key:string;latest:T;records:T[];activities:number;last:number};

/** Recorded friends as the owner and admins see them (docs/FRIEND_SIGNUP_ENTRY.md): each friend is the group of their
 * per-activity guest records, sharing a merged `guestFriendId` or, before any merge, the same host and nickname. The
 * latest record (by activity start) carries the current nickname. Sorted by nickname, then most recent activity. Both
 * the 临时来宾 manager and account creation (a friend who joins) use this one list. */
export function recordedFriends<T extends Record>(players:T[],events:{id:string;start:number}[]):RecordedFriend<T>[]{
 const starts=new Map(events.map(e=>[e.id,e.start])),groups=new Map<string,T[]>();
 for(const p of players)if(p.guest||p.guestEventId){const k=friendKey(p,p.guestHostId);groups.set(k,[...(groups.get(k)??[]),p])}
 return [...groups].map(([key,records])=>{
  const dated=[...records].sort((a,b)=>(starts.get(a.guestEventId??'')??0)-(starts.get(b.guestEventId??'')??0));
  return {key,records,latest:dated.at(-1)!,activities:new Set(records.map(r=>r.guestEventId).filter(Boolean)).size,last:starts.get(dated.at(-1)!.guestEventId??'')??0};
 }).sort((a,b)=>a.latest.name.localeCompare(b.latest.name,'zh-CN')||b.last-a.last);
}

type ChoiceData={players:(Record&{guestHost?:string})[];accounts:{playerId:string}[];events:{id:string;start:number}[];registrations:{eventId:string;playerId:string}[]};
/** Profiles a new account can take over (docs/FRIEND_TO_MEMBER.md): a member's profile left without an account keeps
 * its history, and a recorded friend, one line per friend as in 临时来宾 (merged records once, removed friends left
 * out), becomes a member with all their records. */
export function accountProfileChoices(data:ChoiceData){
 const claimed=new Set(data.accounts.map(a=>a.playerId));
 const available=data.players.filter(p=>!p.guest&&!p.guestEventId&&!claimed.has(p.id));
 const friends=recordedFriends(data.players,data.events).filter(f=>!f.latest.guestHidden).map(f=>{
  const ids=new Set(f.records.map(r=>r.id)),activities=new Set(data.registrations.filter(r=>ids.has(r.playerId)).map(r=>r.eventId)).size;
  return {id:f.latest.id,name:f.latest.name,host:f.latest.guestHost??'球友',activities};
 });
 return {available,friends};
}
