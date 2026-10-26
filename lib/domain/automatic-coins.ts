import {attendanceForEvent} from './attendance';
import {awaitingArrival} from './points-attendance';
import {isGuest} from './guests';
import {clubOwnerId} from './ownership';
import {gameFacts} from './game-facts';
import {realmLedger,type RealmLedger} from './realm-rating';
import {scoreSeasonGames,seasonGameScope} from './season-points';
import {appendTreasureLedger,automaticRewardPool} from './treasure-ledger';
import {eventRankingEnabled} from './event-ranking';
import {fail,type Event,type State,type TreasureRewardClaim} from './types';

export const participationCoins=5;
/** Attending this many points matches in a row earns attendanceStreakCoins; the count then starts again. */
export const attendanceStreakLength=4;
export const defaultAttendanceStreakCoins=20;
export const attendanceStreakCoins=(s:Pick<State,'settings'>)=>s.settings.attendanceStreakCoins??defaultAttendanceStreakCoins;
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
/** Lookups for participation, built once per reconciliation instead of scanning every signup, match and derived
 * attendance per activity and player. Same answers: the first signup row wins, as with Array.find. */
type ParticipationIndex={registrations:Map<string,State['registrations'][number]>;played:Set<string>;attendance:Map<string,ReturnType<typeof attendanceForEvent>>};
const pair=(eventId:string,playerId:string)=>eventId+'\u0000'+playerId;
function participationIndex(s:State,now:number):ParticipationIndex{
 const registrations=new Map<string,State['registrations'][number]>();
 for(const r of s.registrations){const key=pair(r.eventId,r.playerId);if(!registrations.has(key))registrations.set(key,r)}
 const played=new Set<string>();
 for(const m of s.matches)if(m.end!==null&&m.end<=now&&gameFacts(m).length>0)for(const id of [...m.a,...m.b])played.add(pair(m.eventId,id));
 return {registrations,played,attendance:new Map()};
}
function participation(s:State,e:Event,playerId:string,now:number,index=participationIndex(s,now)){
 const registration=index.registrations.get(pair(e.id,playerId));
 if(!registration)return false;
 // A real played result can establish arrival even after a missing-player report,
 // waitlist promotion or an organiser correcting the signup afterwards.
 if(index.played.has(pair(e.id,playerId)))return true;
 if(e.noShowHold?.includes(playerId)||awaitingArrival(e,playerId))return false;
 if(registration.status==='waitlist')return false;
 let attendance=index.attendance.get(e.id);if(!attendance){attendance=attendanceForEvent(s,e);index.attendance.set(e.id,attendance)}
 return attendance.some(a=>a.playerId===playerId&&Math.min(a.end??e.end,e.end,now)>Math.max(a.start,e.start));
}

/** Build current entitlements from the same rated-game iterator as the board.
 * Owner grants, losses and attendance/notification/MVP points are never sources. */
function rewardEntitlements(s:State,now:number,ledger?:RealmLedger){
 const policy=s.settings.automaticCoins;if(!policy)return [];
 const excluded=new Set(policy.excludedEventIds),priorAmounts=new Map((s.treasureRewardClaims??[]).map(row=>[row.id,row.amount])),prior=new Set(priorAmounts.keys()),events=new Map(s.events.filter(e=>endedRewardEvent(e,policy.activatedAt,excluded,now)).map(e=>[e.id,e]));
 // Account disabling does not cancel genuine attendance or an earned entitlement.
 const members=new Set(s.accounts.map(a=>a.playerId).filter(id=>s.players.some(p=>p.id===id)&&!isGuest(s,id)));
 const claims:TreasureRewardClaim[]=[],index=participationIndex(s,now);
 for(const e of events.values())for(const playerId of members)if(participation(s,e,playerId,now,index)){
  const id=JSON.stringify(['participation',e.id,playerId]);
  if(e.deletedAt===undefined||prior.has(id))claims.push({id,eventId:e.id,playerId,source:'participation',amount:participationCoins,updated:now});
 }
 claims.push(...attendanceStreakClaims(s,now,events,members,index,priorAmounts));
 // Score the complete history before applying the reward rollout boundary:
 // earlier games establish (or break) a streak but receive no retroactive coins.
 // The canonical scope keeps quarters and singles/doubles streaks independent.
 const matches=new Map(s.matches.map(match=>[match.id,match]));
 const scored=scoreSeasonGames((ledger??realmLedger(s,now)).games,g=>seasonGameScope(g,matches.get(g.matchId)!));
 for(const {game:g,points} of scored){
  if(!g.won||!events.has(g.eventId)||!members.has(g.playerId))continue;
  const amount=Math.max(0,points);if(!amount)continue;
  const id=JSON.stringify(['match_win',g.matchId,g.gameIndex,g.playerId]);
  if(events.get(g.eventId)!.deletedAt===undefined||prior.has(id))claims.push({id,eventId:g.eventId,playerId:g.playerId,source:'match_win',matchId:g.matchId,gameIndex:g.gameIndex,amount,updated:now});
 }
 return claims;
}

/** Points matches held (ranked, not tournaments, not cancelled, draft or deleted), in the order they started. */
function heldPointsMatches(s:State,now:number){
 return s.events.filter(e=>e.deletedAt===undefined&&eventRankingEnabled(e)&&!e.tournament&&!['draft','cancelled'].includes(e.status)&&Number.isFinite(e.end)&&e.end<=now)
  .sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
}
/** Every attendanceStreakLength points matches in a row that a member attended on time earn coins on the last of them.
 * Missing one, or being reported late in one, starts the count again; singles and doubles count together. The whole
 * history establishes or breaks a run, but only activities inside the reward rollout earn. An awarded run keeps the
 * amount it was awarded with, so changing the setting only affects new runs. */
function attendanceStreakClaims(s:State,now:number,rewardable:Map<string,Event>,members:Set<string>,index:ParticipationIndex,priorAmounts:Map<string,number>){
 const claims:TreasureRewardClaim[]=[],coins=attendanceStreakCoins(s);
 const runs=new Map([...members].map(id=>[id,0]));
 for(const e of heldPointsMatches(s,now)){
  const late=new Set((e.pointsSession?.attendance??[]).filter(row=>row.late).map(row=>row.playerId));
  for(const playerId of members){
   const run=participation(s,e,playerId,now,index)&&!late.has(playerId)?runs.get(playerId)!+1:0;
   runs.set(playerId,run);
   if(!run||run%attendanceStreakLength||!rewardable.has(e.id))continue;
   const id=JSON.stringify(['attendance_streak',e.id,playerId]),amount=priorAmounts.get(id)||coins;
   if(amount>0)claims.push({id,eventId:e.id,playerId,source:'attendance_streak',amount,updated:now});
  }
 }
 return claims;
}

/** Caller saves this alongside business changes under the store revision gate.
 * Each source is unique and mutable only as an entitlement; money movements stay
 * append-only. Replaying polling, cron, edits or voids cannot re-award a source. */
/** `ledger`: an already computed realmLedger(s,now) for this exact state, when the caller has one to share. */
export function reconcileAutomaticCoins(s:State,now:number,ledger?:RealmLedger){
 if(!s.settings.automaticCoins)return false;
 const actor=clubOwnerId(s);if(!s.accounts.some(a=>a.id===actor))return false;
 // Persisted source amounts are the reconciliation checkpoint. In particular,
 // existing correction debt must not consume a later independent owner grant
 // or order refund just because maintenance runs again.
 const previousDesired=new Map<string,number>();
 for(const row of s.treasureRewardClaims??[])previousDesired.set(row.playerId,total([previousDesired.get(row.playerId)??0,row.amount]));
 const desired=new Map(rewardEntitlements(s,now,ledger).map(row=>[row.id,row]));
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
  const reason=delta>0?'活动结束自动结算：胜局积分、参与与连续到场奖励':'比分或活动记录修正，校正自动奖励';
  appendTreasureLedger(s,{playerId,delta,kind,reason,actor,at:now,requestId:`automatic:${crypto.randomUUID()}`});
  changed=true;
 }
 return changed;
}
