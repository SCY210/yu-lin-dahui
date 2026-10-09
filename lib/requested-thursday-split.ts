import {env} from 'cloudflare:workers';
import {load,save,committed} from './store';
import {clubOwnerId} from './domain/ownership';
import {calculateSettlement} from './domain/money';
import {apply} from './domain/commands';
import {clubReminderStatements} from './reminder-store';

// The owner explicitly chose EUR3.37 per person for this already-confirmed
// six-person activity. A bounded new version preserves the two earlier ones.
export const requestedThursdaySplit={key:'owner-request:thursday-six-equal-337:v1',eventId:'3923b57a-c63c-4c11-b747-a6570b5f2a4a'};
export async function runRequestedThursdaySplit(){
 if(!env.DB)return;
 for(let attempt=0;attempt<4;attempt++){
  if(await committed(requestedThursdaySplit.key))return;
  const s=await load(),previous=structuredClone(s),now=Date.now(),e=s.events.find(e=>e.id===requestedThursdaySplit.eventId&&e.deletedAt===undefined);
  if(!e||e.start!==1791478800000||e.end!==1791486000000||now<e.end)return;
  const owner=s.accounts.find(a=>a.id===clubOwnerId(s)&&a.role==='admin');if(!owner||e.creatorId!==owner.id)return;
  const result=calculateSettlement(s,e,now),latest=s.settlements.filter(x=>x.eventId===e.id&&x.confirmed).sort((a,b)=>b.version-a.version)[0];
  if(!latest||![2020,2022].includes(latest.total)||result.expenseTotal!==2020||result.total!==2022||result.bills.length!==6||result.bills.some(b=>b.total!==337)||result.unallocated)return;
  await apply(s,owner,'settle',{eventId:e.id,confirmed:true,reason:'群主确认本场六人统一每人3.37欧元，同额取整到分'},now);
  try{await save(s,requestedThursdaySplit.key,previous,clubReminderStatements(s,previous,owner.id,requestedThursdaySplit.key,'settle',now));return}catch(error){
   if(attempt<3&&String(error).includes('UNIQUE constraint failed: commits'))continue;
   throw error;
  }
 }
}
