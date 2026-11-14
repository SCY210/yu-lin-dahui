import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {eventFormat} from './match-format';
import {authorizeEventAction} from './permissions';
import {replanAfterExpiry} from './planned-replan';
import {fail,type Account,type State} from './types';

/** Lock and unlock commands for 锁组 (lib/domain/locked-pairs.ts, docs/LOCKED_PAIRS.md). */
const id=z.string().min(1).max(100);
const schemas={
 pairLock:z.object({eventId:id,playerIds:z.tuple([id,id])}).strict(),
 pairUnlock:z.object({eventId:id,playerId:id}).strict(),
};
export const lockedPairActions=Object.keys(schemas);

export function applyLockedPairs(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);
 if(!command)return false;
 const p=command.payload;
 authorizeEventAction(s,a,action,p);
 const e=s.events.find(x=>x.id===p.eventId&&x.deletedAt===undefined)??fail('活动不存在或已删除');
 if(e.tournament)fail('赛事使用对战表里的固定队伍，不使用锁组');
 if(eventFormat(e)!=='doubles')fail('只有双打活动可以锁组');
 if(['ended','cancelled'].includes(e.status)||now>=e.end)fail('活动已结束或取消');
 const name=(playerId:string)=>s.players.find(x=>x.id===playerId)?.name??'该球友';
 const pairs=e.lockedPairs??[];
 if(command.action==='pairLock'){
  const [first,second]=command.payload.playerIds;
  if(first===second)fail('请选择两位不同的球友');
  for(const playerId of [first,second]){
   if(!s.players.some(x=>x.id===playerId&&x.enabled))fail(`${name(playerId)}已停用，不能锁组`);
   if(!s.registrations.some(r=>r.eventId===e.id&&r.playerId===playerId&&r.status==='confirmed'))fail(`${name(playerId)}还没有正式接龙本活动，不能锁组`);
   const existing=pairs.find(pair=>pair.includes(playerId));
   if(existing){if(existing.includes(first)&&existing.includes(second))return true;fail(`${name(playerId)}已经和${name(existing.find(x=>x!==playerId)!)}锁组，请先取消原来的锁组`)}
  }
  // Fixed partners already drawn: let them be drawn again with the lock, unless games have started.
  const teams=e.pointsChoice?.selectedMode==='fixed'?e.pointsChoice.teams:undefined;
  if(teams&&!teams.some(team=>team.includes(first)&&team.includes(second))){
   if(s.matches.some(m=>m.eventId===e.id&&['playing','complete','forfeit'].includes(m.status)))fail('固定搭档的比赛已经开始，不能再更换搭档');
   e.pointsChoice!.teams=undefined;
  }
  e.lockedPairs=[...pairs,[first,second]];
  s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'pairLock',reason:`锁组：${name(first)} + ${name(second)}`,changes:{eventId:e.id,playerIds:[first,second]}});
 }else{
  const playerId=command.payload.playerId,pair=pairs.find(x=>x.includes(playerId));
  if(!pair)return true;
  e.lockedPairs=pairs.filter(x=>x!==pair);
  if(!e.lockedPairs.length)delete e.lockedPairs;
  s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'pairUnlock',reason:`取消锁组：${name(pair[0])} + ${name(pair[1])}`,changes:{eventId:e.id,playerIds:[...pair]}});
 }
 // Planned rounds that have not started follow the new locks; hand-edited rounds keep their lineups.
 replanAfterExpiry(s,e,now,'锁组变更，按新的锁组重排之后尚未开打的轮次');
 return true;
}
