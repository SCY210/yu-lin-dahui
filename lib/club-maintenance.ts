import {enableWeeklyProgression} from './domain/cultivation';
import {enableSignedRanking} from './domain/signed-ranking';
import {fail,month} from './domain/types';
import {load,save} from './store';
import {enableDefaultAttendance} from './domain/attendance';
import {ensureClubOwner,clubOwnerId} from './domain/ownership';

/** Upgrade current activities once; completed historical attendance stays intact. */
export async function loadClubState(){
 for(let attempt=0;attempt<4;attempt++){
  const state=await load(),previous=structuredClone(state),now=Date.now();
  const ownershipChanged=ensureClubOwner(state),attendanceChanged=enableDefaultAttendance(state,now),progressionChanged=enableWeeklyProgression(state,now),rankingChanged=enableSignedRanking(state,now);
  if(!ownershipChanged&&!attendanceChanged&&!progressionChanged&&!rankingChanged)return state;
  if(ownershipChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:club-owner',action:'protectClubOwner',reason:'为已验证的网站所有者启用群主最高权限保护',changes:{accountId:clubOwnerId(state)}});
  if(attendanceChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:default-attendance',action:'enableDefaultAttendance',reason:'正式报名默认参加，移除签到操作'});
  if(progressionChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:weekly-progression',action:'enableWeeklyProgression',reason:'每周球局成长规则：胜10负3、实际小局统计、保留旧境界并取消旧默认月度封顶',changes:{version:'weekly-v2',players:state.players.length,rulesBefore:previous.settings.rules,rulesAfter:state.settings.rules,seasonsBefore:previous.seasons.map(season=>({id:season.id,rules:season.rules,version:season.version??1})),preservedBases:state.players.map(player=>({playerId:player.id,base:player.cultivationBase??0}))}});
  if(rankingChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:signed-ranking',action:'enableSignedRanking',reason:'启用胜局加分、负局扣分与负积分；只更新默认规则和本月赛季，修为与实力分不变',changes:{period:month(now),rulesBefore:previous.settings.rules,rulesAfter:state.settings.rules,seasonsBefore:previous.seasons,seasonsAfter:state.seasons}});
  try{await save(state,'club-maintenance:'+crypto.randomUUID(),previous);return state}catch(error){
   if(attempt<3&&String(error).includes('UNIQUE constraint failed: commits'))continue;
   throw error;
  }
 }
 fail('409: 活动数据正在更新，请稍后重试');
}
