import {attendanceForEvent} from './attendance';
import {awaitingArrival} from './points-attendance';
import {isGuest} from './guests';
import {clubOwnerId} from './ownership';
import {gameFacts} from './game-facts';
import {realmLedger} from './realm-rating';
import {scoreSeasonGames,seasonGameScope} from './season-points';
import {appendTreasureLedger,automaticRewardPool} from './treasure-ledger';
import {fail,type Event,type State,type TreasureRewardClaim} from './types';

export const participationCoins=5;
const automaticKinds=new Set(['automatic_reward','automatic_correction']);

/** Explicit rollout boundary, persisted atomically with the first reconciliation.
 * Freeze historical IDs too: changing their dates later must never backfill them. */
export function activateAutomaticCoins(s:State,now:number){
 if(s.settings.automaticCoins)return false;
 if(!Number.isSafeInteger(now)||now<0)fail('羽币奖励启用时间无效');
 s.settings.automaticCoins={version:'win-points-v1',activatedAt:now,excludedEventIds:s.events.filter(e=>e.end<=now||e.status==='ended').map(e=>e.id).sort()};
 return true;
}

function total(values:number[]){const n=values.reduce((sum,value)=>sum+value,0);if(!Number.isSafeInteger(n))fail('羽币奖励账本异常，请联系群主');return n}
function desiredTotal(s:State,playerId:string){return total((s.treasureRewardClaims??[]).filter(r=>r.playerId===playerId).map(r=>r.amount))}
function creditedTotal(s:State,playerId:string){return total(s.treasureLedger.filter(r=>r.playerId===playerId&&automaticKinds.has(r.kind)).map(r=>r.delta))}
/** Outstanding overpayment never becomes a negative spendable wallet. New automatic
 * entitlements offset it before any additional coins are credited. */
export function pendingAutomaticCorrection(s:State,playerId:string){return Math.max(0,creditedTotal(s,playerId)-desiredTotal(s,playerId))}

function endedRewardEvent(e:Event,activatedAt:number,excluded:Set<string>,now:number){
 return !excluded.has(e.id)&&e.status!=='cancelled'&&e.status!=='draft'&&Number.isFinite(e.end)&&e.end>activatedAt&&e.end<=now;
}
function participation(s:State,e:Event,playerId:string,now:number){
 const registration=s.registrations.find(r=>r.eventId===e.id&&r.playerId===playerId);
 if(!registration)return false;
 // A real played result can establish arrival even after a missing-player report,
 // waitlist promotion or an organiser correcting the signup afterwards.
 const played=s.matches.some(m=>m.eventId===e.id&&[...m.a,...m.b].includes(playerId)&&m.end!==null&&m.end<=now&&gameFacts(m).length>0);
 if(played)return true;
 if(e.noShowHold?.includes(playerId)||awaitingArrival(e,playerId))return false;
 if(registration.status==='waitlist')return false;
 return attendanceForEvent(s,e).some(a=>a.playerId===playerId&&Math.min(a.end??e.end,e.end,now)>Math.max(a.start,e.start));
}

/** Build current entitlements from the same rated-game iterator as the board.
 * Owner grants, losses and attendance/notification/MVP points are never sources. */
function rewardEntitlements(s:State,now:number){
 const policy=s.settings.automaticCoins;if(!policy)return [];
 const excluded=new Set(policy.excludedEventIds),prior=new Set((s.treasureRewardClaims??[]).map(row=>row.id)),events=new Map(s.events.filter(e=>endedRewardEvent(e,policy.activatedAt,excluded,now)).map(e=>[e.id,e]));
 // Account disabling does not cancel genuine attendance or an earned entitlement.
 const members=new Set(s.accounts.map(a=>a.playerId).filter(id=>s.players.some(p=>p.id===id)&&!isGuest(s,id)));
 const claims:TreasureRewardClaim[]=[];
 for(const e of events.values())for(const playerId of members)if(participation(s,e,playerId,now)){
  const id=JSON.stringify(['participation',e.id,playerId]);
  if(e.deletedAt===undefined||prior.has(id))claims.push({id,eventId:e.id,playerId,source:'participation',amount:participationCoins,updated:now});
 }
 // Score the complete history before applying the reward rollout boundary:
 // earlier games establish (or break) a streak but receive no retroactive coins.
 // The canonical scope keeps quarters and singles/doubles streaks independent.
 const matches=new Map(s.matches.map(match=>[match.id,match]));
 const scored=scoreSeasonGames(realmLedger(s,now).games,g=>seasonGameScope(g,matches.get(g.matchId)!));
 for(const {game:g,points} of scored){
  if(!g.won||!events.has(g.eventId)||!members.has(g.playerId))continue;
  const amount=Math.max(0,points);if(!amount)continue;
  const id=JSON.stringify(['match_win',g.matchId,g.gameIndex,g.playerId]);
  if(events.get(g.eventId)!.deletedAt===undefined||prior.has(id))claims.push({id,eventId:g.eventId,playerId:g.playerId,source:'match_win',matchId:g.matchId,gameIndex:g.gameIndex,amount,updated:now});
 }
 return claims;
}

/** Caller saves this alongside business changes under the store revision gate.
 * Each source is unique and mutable only as an entitlement; money movements stay
 * append-only. Replaying polling, cron, edits or voids cannot re-award a source. */
export function reconcileAutomaticCoins(s:State,now:number){
 if(!s.settings.automaticCoins)return false;
 const actor=clubOwnerId(s);if(!s.accounts.some(a=>a.id===actor))return false;
 // Persisted source amounts are the reconciliation checkpoint. In particular,
 // existing correction debt must not consume a later independent owner grant
 // or order refund just because maintenance runs again.
 const previousDesired=new Map<string,number>();
 for(const row of s.treasureRewardClaims??[])previousDesired.set(row.playerId,total([previousDesired.get(row.playerId)??0,row.amount]));
 const desired=new Map(rewardEntitlements(s,now).map(row=>[row.id,row]));
 s.treasureRewardClaims??=[];
 let changed=false;
 for(const row of s.treasureRewardClaims){const next=desired.get(row.id);if(row.amount!==(next?.amount??0)||next&&row.eventId!==next.eventId){row.amount=next?.amount??0;if(next)row.eventId=next.eventId;row.updated=now;changed=true}desired.delete(row.id)}
 if(desired.size){s.treasureRewardClaims.push(...desired.values());changed=true}
 const players=new Set([...s.treasureRewardClaims.map(r=>r.playerId),...s.treasureLedger.filter(r=>automaticKinds.has(r.kind)).map(r=>r.playerId)]);
 for(const playerId of players){
  const before=previousDesired.get(playerId)??0,change=desiredTotal(s,playerId)-before,pendingBefore=Math.max(0,creditedTotal(s,playerId)-before);
  const delta=change<0?-Math.min(automaticRewardPool(s,playerId),-change):Math.max(0,change-pendingBefore);
  if(!delta)continue;
  const kind=delta>0?'automatic_reward' as const:'automatic_correction' as const;
  const reason=delta>0?'活动结束自动结算：胜局积分与参与奖励':'比分或活动记录修正，校正自动奖励';
  appendTreasureLedger(s,{playerId,delta,kind,reason,actor,at:now,requestId:`automatic:${crypto.randomUUID()}`});
  changed=true;
 }
 return changed;
}
