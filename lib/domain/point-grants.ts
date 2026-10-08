import {z} from 'zod';
import type {State} from './types';

export const pointGrantInput=z.object({
 playerId:z.string().min(1).max(100),
 period:z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/,'请选择有效月份'),
 points:z.number().int().min(1).max(1000),
 reason:z.string().trim().min(1,'请填写加分原因').max(500),
});
// The append-only audit row is also the durable grant ledger. It is saved in
// the same optimistic transaction as the command, never inferred from matches.
export function pointGrants(s:Pick<State,'audits'>){
 return s.audits.flatMap(a=>{
  if(a.action!=='grantPoints')return [];
  const parsed=pointGrantInput.safeParse(a.changes);
  return parsed.success?[{...parsed.data,id:a.id,at:a.at,actor:a.actor}]:[];
 });
}
