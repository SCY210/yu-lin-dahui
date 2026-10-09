import {enableAllRanked} from './domain/all-ranked';
import {enableEloRealms} from './domain/realm-rating';
import {enableSignedRanking} from './domain/signed-ranking';
import {fail,month} from './domain/types';
import {load,save,raw} from './store';
import {enableDefaultAttendance} from './domain/attendance';
import {ensureClubOwner,clubOwnerId} from './domain/ownership';
import {runRequestedEventDateRepair,requestedEventDateRepair} from './requested-event-date-repair';
import {runRequestedThursdaySplit,requestedThursdaySplit} from './requested-thursday-split';

/** Upgrade current activities once; completed historical attendance stays intact. */
export async function loadClubState(){
 const keys=[requestedEventDateRepair.key,requestedThursdaySplit.key];
 const done=new Set((await raw().prepare('SELECT key FROM commits WHERE key IN (?,?)').bind(...keys).all<{key:string}>()).results.map(row=>row.key));
 // Keep pending jobs ordered; completed jobs share one indexed lookup.
 if(!done.has(requestedEventDateRepair.key))await runRequestedEventDateRepair();
 if(!done.has(requestedThursdaySplit.key))await runRequestedThursdaySplit();
 for(let attempt=0;attempt<4;attempt++){
  const state=await load(),previous=structuredClone(state),now=Date.now();
  const ownershipChanged=ensureClubOwner(state),attendanceChanged=enableDefaultAttendance(state,now),rankingChanged=enableSignedRanking(state,now),allRankedChanged=enableAllRanked(state,now),realmMigration=enableEloRealms(state,now);
  if(!ownershipChanged&&!attendanceChanged&&!realmMigration&&!rankingChanged&&!allRankedChanged)return state;
  if(ownershipChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:club-owner',action:'protectClubOwner',reason:'为已验证的网站所有者启用群主最高权限保护',changes:{accountId:clubOwnerId(state)}});
  if(attendanceChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:default-attendance',action:'enableDefaultAttendance',reason:'正式报名默认参加，移除签到操作'});
  if(realmMigration)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:elo-realms',action:'enableEloRealms',reason:'累计成长规则停用，境界改由段位分（Elo，每人从1000起）决定；按全部已有比赛记录从头回算，季度与年度榜积分改为段位分变化之和',changes:realmMigration});
  if(rankingChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:signed-ranking',action:'enableSignedRanking',reason:'启用胜局加分、负局扣分与负积分；只更新默认规则和本月赛季，境界与实力分不变',changes:{period:month(now),rulesBefore:previous.settings.rules,rulesAfter:state.settings.rules,seasonsBefore:previous.seasons,seasonsAfter:state.seasons}});
  try{await save(state,'club-maintenance:'+crypto.randomUUID(),previous);return state}catch(error){
   if(attempt<3&&String(error).includes('UNIQUE constraint failed: commits'))continue;
   throw error;
  }
 }
 fail('409: 活动数据正在更新，请稍后重试');
}
