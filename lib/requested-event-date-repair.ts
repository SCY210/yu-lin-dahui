import {env} from 'cloudflare:workers';
import {load,save,committed} from './store';
import {repairEventDate} from './domain/event-date-repair';

// Exact event and old timestamps read from live D1; the owner confirmed the
// corrected time on 2026-10-08. No visitor input selects or modifies this plan.
export const requestedEventDateRepair={
 key:'owner-request:correct-thursday-oct8-date:v1',
 eventId:'3923b57a-c63c-4c11-b747-a6570b5f2a4a',
 fromStart:1791565200000,fromEnd:1791572400000,
 toStart:1791478800000,toEnd:1791486000000,
};
export async function runRequestedEventDateRepair(){
 if(!env.DB)return;
 for(let attempt=0;attempt<4;attempt++){
  if(await committed(requestedEventDateRepair.key))return;
  const s=await load(),previous=structuredClone(s);
  if(!repairEventDate(s,requestedEventDateRepair,Date.now()))return;
  try{await save(s,requestedEventDateRepair.key,previous);return}catch(error){
   if(attempt<3&&String(error).includes('UNIQUE constraint failed: commits'))continue;
   throw error;
  }
 }
}
