import {apply} from './domain/commands';
import {env} from 'cloudflare:workers';
import {activateAutomaticCoins,reconcileAutomaticCoins} from './domain/automatic-coins';
import {coinRewardStart} from './coin-reward-clock';
import {startDuePointsSessions} from './domain/points-auto-start';
import {enableAllRanked} from './domain/all-ranked';
import {enableRoleRankedEvents} from './domain/event-ranking';
import {enableEloRealms} from './domain/realm-rating';
import {enableSignedRanking} from './domain/signed-ranking';
import {mergeStrengthRating,strengthAlgorithm} from './domain/ranking';
import {refreshStrength,sharedRealmLedger} from './club-view-shared';
import {fail,month} from './domain/types';
import {loadWithRestore,save,raw} from './store';
import type {State} from './domain/types';
import {enableDefaultAttendance} from './domain/attendance';
import {ensureClubOwner,clubOwnerId} from './domain/ownership';
import {runRequestedEventDateRepair,requestedEventDateRepair} from './requested-event-date-repair';
import {runRequestedThursdaySplit,requestedThursdaySplit} from './requested-thursday-split';

/** Upgrade current activities once; completed historical attendance stays intact. */
export async function loadClubState(options:{incremental?:boolean}={}){
 const keys=[requestedEventDateRepair.key,requestedThursdaySplit.key];
 const done=new Set((await raw().prepare('SELECT key FROM commits WHERE key IN (?,?)').bind(...keys).all<{key:string}>()).results.map(row=>row.key));
 // Keep pending jobs ordered; completed jobs share one indexed lookup.
 if(!done.has(requestedEventDateRepair.key))await runRequestedEventDateRepair();
 if(!done.has(requestedThursdaySplit.key))await runRequestedThursdaySplit();
 for(let attempt=0;attempt<4;attempt++){
  // The untouched snapshot is only needed when something changes; rebuild it from the fetched rows on demand.
  const {state,restore}=await loadWithRestore(options),now=Date.now();let snapshot:State|null=null;const previous=()=>snapshot??=restore();
  const ownershipChanged=ensureClubOwner(state),attendanceChanged=enableDefaultAttendance(state,now),rankingChanged=enableSignedRanking(state,now),allRankedChanged=enableAllRanked(state,now),rankedEventsChanged=enableRoleRankedEvents(state,now),realmMigration=enableEloRealms(state,now);
  // While nothing has changed yet, this state is exactly the stored revision, so the clock-driven 修为 refresh and the
  // coin ledger can be shared between requests of the same revision (lib/club-view-shared.ts).
  const quiet=!ownershipChanged&&!attendanceChanged&&!rankingChanged&&!allRankedChanged&&!rankedEventsChanged&&!realmMigration;
  const strengthMerge=quiet&&state.settings.initialized&&state.settings.strengthVersion===strengthAlgorithm?refreshStrength(state,now):mergeStrengthRating(state,now);
  const pointsStarted=await startDuePointsSessions(state,now,apply);
  const coinPolicyStarted=activateAutomaticCoins(state,coinRewardStart(env.CF_VERSION_METADATA?.timestamp,now));
  const coinRewardsChanged=reconcileAutomaticCoins(state,now,quiet&&!strengthMerge&&!pointsStarted&&!coinPolicyStarted?sharedRealmLedger(state,now):undefined);
  if(!coinPolicyStarted&&!coinRewardsChanged&&!pointsStarted&&!ownershipChanged&&!attendanceChanged&&!realmMigration&&!rankingChanged&&!allRankedChanged&&!rankedEventsChanged&&!strengthMerge)return state;
  if(ownershipChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:club-owner',action:'protectClubOwner',reason:'为已验证的网站所有者启用群主最高权限保护',changes:{accountId:clubOwnerId(state)}});
  if(attendanceChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:default-attendance',action:'enableDefaultAttendance',reason:'正式报名默认参加，移除签到操作'});
  if(realmMigration)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:elo-realms',action:'enableEloRealms',reason:'累计成长规则停用，境界改由修为（Elo，每人从1000起）决定；按全部已有比赛记录从头回算，季度与年度榜积分改为修为变化之和',changes:realmMigration});
  if(strengthMerge)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:strength-merge',action:'mergeStrengthRating',reason:'隐藏分组实力分并入修为：自动分组、搭档模式和让分建议改用只按双打小局计算的修为；赛季积分改为胜负积分加强弱加成',changes:strengthMerge});
  if(rankingChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:signed-ranking',action:'enableSignedRanking',reason:'启用胜局加分、负局扣分与负积分；只更新默认规则和本月赛季，境界与实力分不变',changes:{period:month(now),rulesBefore:previous().settings.rules,rulesAfter:state.settings.rules,seasonsBefore:previous().seasons,seasonsAfter:state.seasons}});
  try{await save(state,'club-maintenance:'+crypto.randomUUID(),previous());return state}catch(error){
   if(attempt<3&&String(error).includes('UNIQUE constraint failed: commits'))continue;
   throw error;
  }
 }
 fail('409: 活动数据正在更新，请稍后重试');
}
