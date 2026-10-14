import {fail,type State,type TreasureLedger} from './types';

function safeSum(values:number[]){const result=values.reduce((sum,value)=>sum+value,0);if(!Number.isSafeInteger(result))fail('羽币账本异常，请联系群主');return result}
export function treasureBalance(s:State,playerId:string){const balance=safeSum(s.treasureLedger.filter(row=>row.playerId===playerId).map(row=>row.delta));if(balance<0)fail('羽币账本异常，请联系群主');return balance}

/** All pre-feature movements are a protected opening balance. Every new movement
 * receives a per-wallet sequence in the same optimistic transaction as its coins,
 * so timestamps, random IDs and database row-return order cannot reorder spends. */
export function appendTreasureLedger(s:State,row:Omit<TreasureLedger,'id'|'balance'|'sequence'>){
 const ledger=s.treasureLedger.filter(entry=>entry.playerId===row.playerId);
 const sequence=ledger.reduce((latest,entry)=>Math.max(latest,entry.sequence??0),0)+1;
 const balance=safeSum([treasureBalance(s,row.playerId),row.delta]);
 if(!Number.isSafeInteger(sequence)||balance<0)fail('羽币余额不足或账本异常');
 const next={...row,id:crypto.randomUUID(),balance,sequence};s.treasureLedger.push(next);return next;
}

/** Only an unspent automatic reward can be reclaimed. Independent grants and
 * refunds are protected; spending consumes automatic coins first. Historical
 * pre-feature movements are intentionally not inferred as automatic earnings. */
export function automaticRewardPool(s:State,playerId:string){
 const rows=s.treasureLedger.filter(row=>row.playerId===playerId);
 let protectedCoins=safeSum(rows.filter(row=>row.sequence===undefined).map(row=>row.delta)),automatic=0;
 if(protectedCoins<0)fail('羽币账本异常，请联系群主');
 const ordered=rows.filter(row=>row.sequence!==undefined).sort((a,b)=>a.sequence!-b.sequence!);
 let previous=0;
 for(const row of ordered){
  if(!Number.isSafeInteger(row.sequence)||row.sequence!<=previous)fail('羽币账本顺序异常，请联系群主');previous=row.sequence!;
  if(row.kind==='automatic_reward'){
   if(row.delta<0)fail('羽币自动奖励异常');automatic=safeSum([automatic,row.delta]);
  }else if(row.kind==='automatic_correction'){
   if(row.delta>0||-row.delta>automatic)fail('羽币奖励校正异常');automatic+=row.delta;
  }else if(row.delta>=0){protectedCoins=safeSum([protectedCoins,row.delta])}
  else{
   const spending=-row.delta;
   if(row.kind==='redeem'){const used=Math.min(automatic,spending);automatic-=used;protectedCoins-=spending-used}
   else{const used=Math.min(protectedCoins,spending);protectedCoins-=used;automatic-=spending-used}
   if(automatic<0||protectedCoins<0)fail('羽币余额不足或账本异常');
  }
 }
 if(safeSum([automatic,protectedCoins])!==treasureBalance(s,playerId))fail('羽币账本异常，请联系群主');
 return automatic;
}
