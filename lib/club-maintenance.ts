import {enableAllRanked} from './domain/all-ranked';
import {enableEloRealms} from './domain/realm-rating';
import {enableSignedRanking} from './domain/signed-ranking';
import {mergeStrengthRating} from './domain/ranking';
import {fail,month} from './domain/types';
import {load,save} from './store';
import {enableDefaultAttendance} from './domain/attendance';
import {ensureClubOwner,clubOwnerId} from './domain/ownership';
import {runRequestedEventDateRepair} from './requested-event-date-repair';
import {runRequestedThursdaySplit} from './requested-thursday-split';

/** Upgrade current activities once; completed historical attendance stays intact. */
export async function loadClubState(){
 await runRequestedEventDateRepair();
 await runRequestedThursdaySplit();
 for(let attempt=0;attempt<4;attempt++){
  const state=await load(),previous=structuredClone(state),now=Date.now();
  const ownershipChanged=ensureClubOwner(state),attendanceChanged=enableDefaultAttendance(state,now),rankingChanged=enableSignedRanking(state,now),allRankedChanged=enableAllRanked(state,now),realmMigration=enableEloRealms(state,now),strengthMerge=mergeStrengthRating(state,now);
  if(!ownershipChanged&&!attendanceChanged&&!realmMigration&&!rankingChanged&&!allRankedChanged&&!strengthMerge)return state;
  if(ownershipChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:club-owner',action:'protectClubOwner',reason:'为已验证的网站所有者启用群主最高权限保护',changes:{accountId:clubOwnerId(state)}});
  if(attendanceChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:default-attendance',action:'enableDefaultAttendance',reason:'正式报名默认参加，移除签到操作'});
  if(realmMigration)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:elo-realms',action:'enableEloRealms',reason:'累计成长规则停用，境界改由段位分（Elo，每人从1000起）决定；按全部已有比赛记录从头回算，季度与年度榜积分改为段位分变化之和',changes:realmMigration});
  if(strengthMerge)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:strength-merge',action:'mergeStrengthRating',reason:'隐藏分组实力分并入段位分：自动分组、搭档模式和让分建议改用段位分；赛季积分改为胜负积分加强弱加成',changes:strengthMerge});
  if(rankingChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:signed-ranking',action:'enableSignedRanking',reason:'启用胜局加分、负局扣分与负积分；只更新默认规则和本月赛季，境界与实力分不变',changes:{period:month(now),rulesBefore:previous.settings.rules,rulesAfter:state.settings.rules,seasonsBefore:previous.seasons,seasonsAfter:state.seasons}});
  try{await save(state,'club-maintenance:'+crypto.randomUUID(),previous);return state}catch(error){
   if(attempt<3&&String(error).includes('UNIQUE constraint failed: commits'))continue;
   throw error;
  }
 }
 fail('409: 活动数据正在更新，请稍后重试');
}
