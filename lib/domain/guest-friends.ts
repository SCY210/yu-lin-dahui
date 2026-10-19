import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {guestGenderInput,guestLevelInput} from './guest-commands';
import {friendKey} from './guest-friend-key';
import {guestIds} from './guests';
import {replayRating} from './ranking';
import {fail,type State,type Account} from './types';

/** Recorded friends (docs/FRIEND_SIGNUP_ENTRY.md). Every activity keeps its own guest record, so one friend is the group
 * of records that share a `guestFriendId`, or, before any merge, the same host and nickname. The owner and admins can
 * merge duplicates, correct a friend's details and take them off the friend lists; history is never deleted. */
/** Every guest record of the friend that `playerId` belongs to. */
export function friendRecords(s:Pick<State,'players'|'accounts'>,playerId:string){
 const guests=guestIds(s),rep=s.players.find(p=>p.id===playerId);if(!rep||!guests.has(rep.id))fail('这位临时来宾不存在');
 const key=friendKey(rep,rep.ownerId);
 return s.players.filter(p=>guests.has(p.id)&&friendKey(p,p.ownerId)===key);
}
const id=z.string().min(1).max(100),reason=z.string().trim().max(500).optional();
const schemas={
 guestFriendMerge:z.object({playerIds:z.array(id).min(2).max(50),name:z.string().trim().min(1).max(150),hostPlayerId:id,reason}),
 guestFriendEdit:z.object({playerId:id,name:z.string().trim().min(1).max(150),gender:guestGenderInput,level:guestLevelInput,reason}),
 guestFriendHide:z.object({playerId:id,hidden:z.boolean(),reason}),
};
export async function applyGuestFriends(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 if(a.role!=='admin')fail('403: 只有群主和管理员可以管理临时来宾');
 const audit=(reason:string,changes:Record<string,unknown>)=>s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:command.payload.reason||reason,changes});
 if(command.action==='guestFriendMerge'){
  // One friend from now on: one nickname and one host, who owes their share in new activities and unconfirmed splits.
  // Confirmed split versions are stored snapshots and stay as they were.
  const p=command.payload,host=s.accounts.find(x=>x.playerId===p.hostPlayerId)??fail('请选择一位有账号的成员作为带来人');
  const records=[...new Map(p.playerIds.flatMap(pid=>friendRecords(s,pid)).map(r=>[r.id,r])).values()];
  if(!records.some(r=>r.ownerId===host.id))fail('带来人需要是这几位来宾的带来人之一');
  const friendId=records.find(r=>r.guestFriendId)?.guestFriendId??crypto.randomUUID();
  const before=records.map(r=>({playerId:r.id,name:r.name,ownerId:r.ownerId}));
  for(const r of records){r.guestFriendId=friendId;r.name=p.name;r.ownerId=host.id;delete r.guestHidden}
  audit('合并重复的临时来宾',{friendId,hostPlayerId:p.hostPlayerId,name:p.name,before});
  return true;
 }
 if(command.action==='guestFriendEdit'){
  // Nickname and gender change on every record; a new level applies from now on, from the latest record.
  const p=command.payload,records=friendRecords(s,p.playerId),latest=records.at(-1)!;
  const before={name:latest.name,gender:latest.guestGender??null,level:latest.guestLevels?.at(-1)?.level??latest.rating};
  for(const r of records){r.name=p.name;r.guestGender=p.gender}
  if(before.level!==p.level){latest.guestLevels=[...(latest.guestLevels??[]),{at:now,level:p.level}];replayRating(s,now)}
  audit('修改临时来宾信息',{playerIds:records.map(r=>r.id),before,after:{name:p.name,gender:p.gender,level:p.level}});
  return true;
 }
 const p=command.payload,records=friendRecords(s,p.playerId);
 for(const r of records){if(p.hidden)r.guestHidden=true;else delete r.guestHidden}
 audit(p.hidden?'临时来宾移出名单':'临时来宾恢复到名单',{playerIds:records.map(r=>r.id)});
 return true;
}
