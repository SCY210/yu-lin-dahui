import {fail} from './domain/types';
import {load,save} from './store';
import {enableDefaultAttendance} from './domain/attendance';
import {ensureClubOwner,clubOwnerId} from './domain/ownership';

/** Upgrade current activities once; completed historical attendance stays intact. */
export async function loadClubState(){
 for(let attempt=0;attempt<4;attempt++){
  const state=await load(),previous=structuredClone(state),now=Date.now();
  const ownershipChanged=ensureClubOwner(state),attendanceChanged=enableDefaultAttendance(state,now);
  if(!ownershipChanged&&!attendanceChanged)return state;
  if(ownershipChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:club-owner',action:'protectClubOwner',reason:'为已验证的网站所有者启用群主最高权限保护',changes:{accountId:clubOwnerId(state)}});
  if(attendanceChanged)state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:default-attendance',action:'enableDefaultAttendance',reason:'正式报名默认参加，移除签到操作'});
  try{await save(state,'club-maintenance:'+crypto.randomUUID(),previous);return state}catch(error){
   if(attempt<3&&String(error).includes('UNIQUE constraint failed: commits'))continue;
   throw error;
  }
 }
 fail('409: 活动数据正在更新，请稍后重试');
}
