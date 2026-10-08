import {env} from 'cloudflare:workers';
import {load,save,committed} from './store';
import {clubOwnerId} from './domain/ownership';
import {mergeUpcomingActivities} from './domain/event-merge';

// One bounded data migration explicitly requested by the Site owner on 2026-10-05.
// No request parameters or visitor identity can select events or grant permissions.
// Exact IDs were read from the live Site; the previously deleted activity is excluded.
export const requestedEventMerge={
 key:'owner-request:merge-oct10-court-signups:v1',
 targetId:'eb3dc52d-5199-4665-8d28-2c628406fd0a',
 sourceIds:['17d24bed-87dd-43a1-b982-6bcc99e20884'],
};
export async function runRequestedEventMerge(){
 if(!env.DB)return;
 for(let attempt=0;attempt<4;attempt++){
  if(await committed(requestedEventMerge.key))return;
  const s=await load(),previous=structuredClone(s);
  if(!s.events.some(e=>e.id===requestedEventMerge.targetId)||!s.events.some(e=>e.id===requestedEventMerge.sourceIds[0]))return;
  const owner=s.accounts.find(a=>a.id===clubOwnerId(s));if(!owner)throw new Error('合并活动需要已验证的群主账号');
  mergeUpcomingActivities(s,owner,requestedEventMerge.targetId,requestedEventMerge.sourceIds,Date.now(),'群主要求将同日两场活动合为一个，并把原接龙移入对应场地');
  try{await save(s,requestedEventMerge.key,previous);return}catch(error){
   if(attempt<3&&String(error).includes('UNIQUE constraint failed: commits'))continue;
   throw error;
  }
 }
}
