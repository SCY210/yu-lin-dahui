import {load,save} from './store';
import {enableDefaultAttendance} from './domain/attendance';

/** Upgrade current activities once; completed historical attendance stays intact. */
export async function loadClubState(){
 for(let attempt=0;attempt<4;attempt++){
  const state=await load(),previous=structuredClone(state),now=Date.now();
  if(!enableDefaultAttendance(state,now))return state;
  state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:default-attendance',action:'enableDefaultAttendance',reason:'正式报名默认参加，移除签到操作'});
  try{await save(state,'automatic-attendance:'+crypto.randomUUID(),previous);return state}catch(error){
   if(attempt<3&&String(error).includes('UNIQUE constraint failed: commits'))continue;
   throw error;
  }
 }
 throw new Error('409: 活动数据正在更新，请稍后重试');
}
