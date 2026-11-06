import {friendRecords} from './guest-friends';
import {guestLevelAt} from './guests';
import {replayRating} from './ranking';
import {fail,type State} from './types';

/** A recorded friend joins with their own account (docs/FRIEND_TO_MEMBER.md). Every activity kept its own guest record, so
 * the friend's records become one member: the chosen record is kept as the member's player and every reference to the
 * other records (signups, games, rounds, votes, fees) is pointed at it. The member's rating is then replayed from the
 * friend's last level, so their past games count as a member's. The audit log keeps the old records verbatim. The new
 * account is added here, before the replay, so the member is no longer treated as a guest; it gets the kept record. */
export function convertFriendToMember(s:State,playerId:string,accountId:string,name:string,now:number){
 const all=friendRecords(s,playerId);
 const activities=(id:string)=>new Set([
  ...all.filter(r=>r.id===id&&r.guestEventId).map(r=>r.guestEventId!),
  ...s.registrations.filter(r=>r.playerId===id).map(r=>r.eventId),
  ...s.matches.filter(m=>m.a.includes(id)||m.b.includes(id)).map(m=>m.eventId),
 ]);
 // A duplicate signup in an activity the friend has another record for, cancelled and never played (as 临时来宾 cancels
 // it), stays behind as a hidden guest record: merging it would sign the member up twice there.
 const idle=(id:string)=>!s.matches.some(m=>m.a.includes(id)||m.b.includes(id))&&s.registrations.filter(r=>r.playerId===id).every(r=>r.status==='cancelled');
 const shares=(id:string)=>all.some(o=>o.id!==id&&[...activities(id)].some(e=>activities(o.id).has(e)));
 const left=all.filter(r=>idle(r.id)&&shares(r.id)),records=all.filter(r=>!left.includes(r));
 if(!records.length)fail('这位朋友没有可以转换的记录');
 // The chosen record carries the member, unless it is such a duplicate; then the latest kept record does.
 const target=records.find(r=>r.id===playerId)??records.at(-1)!;
 const others=records.filter(r=>r!==target),ids=new Set(records.map(r=>r.id));
 // Two kept records in one activity would leave the member signed up or playing twice there.
 const seen=new Map<string,string>();
 for(const r of records)for(const eventId of activities(r.id)){
  const other=seen.get(eventId);
  if(other&&other!==r.id)fail('这位朋友在同一场活动里有两条接龙，请先在「临时来宾」里取消重复的那条再开账号');
  seen.set(eventId,r.id);
 }
 const level=guestLevelAt([...all].sort((a,b)=>(a.guestLevels?.at(-1)?.at??0)-(b.guestLevels?.at(-1)?.at??0)).at(-1)!,now);
 const before=all.map(r=>({playerId:r.id,name:r.name,ownerId:r.ownerId,guestEventId:r.guestEventId??null,level:guestLevelAt(r,now)}));
 const replace=(value:unknown,path:string):unknown=>{
  if(typeof value==='string')return ids.has(value)?target.id:value;
  if(Array.isArray(value)){
   const out=value.map((v,i)=>replace(v,path+'['+i+']'));
   if(value.filter(v=>typeof v==='string'&&ids.has(v)).length>1)fail('这位朋友的几条记录出现在同一处（'+path+'），无法合并，请联系开发者处理');
   return out;
  }
  if(value&&typeof value==='object'){
   const out:Record<string,unknown>={};
   for(const [k,v] of Object.entries(value)){
    const key=ids.has(k)?target.id:k;
    if(key in out)fail('这位朋友的几条记录出现在同一处（'+path+'.'+k+'），无法合并，请联系开发者处理');
    out[key]=replace(v,path+'.'+k);
   }
   return out;
  }
  return value;
 };
 // Everything but the people themselves and the audit history, which records what happened as it was.
 const kept=new Set<keyof State>(['players','accounts','audits','revision']);
 const next:Partial<State>={};
 for(const key of Object.keys(s) as (keyof State)[])if(!kept.has(key))(next as Record<string,unknown>)[key]=replace(s[key],key);
 Object.assign(s,next);
 const removed=new Set(others.map(r=>r.id));
 s.players=s.players.filter(p=>!removed.has(p.id));
 for(const r of left)r.guestHidden=true;
 s.accounts.push({id:accountId,email:'',role:'member',playerId:target.id});
 Object.assign(target,{ownerId:accountId,name,initialRating:level,rating:level,ratingReason:'临时来宾转为正式道友'});
 delete target.guestEventId;delete target.guestFriendId;delete target.guestHidden;delete target.guestLevels;
 replayRating(s,now);
 return {playerId:target.id,before,level,merged:others.map(r=>r.id),left:left.map(r=>r.id)};
}
