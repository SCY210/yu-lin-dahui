import {z} from 'zod';
import {editReason} from './edit-reason';
import type {State} from './types';

/** points change the period's doubles-board points; rating (optional) changes 修为, and with it the realm and the
 * doubles grouping strength, from the moment of the grant. At least one of the two must be non-zero. */
const grantFields=z.object({
 playerId:z.string().min(1).max(100),
 period:z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/,'请选择有效月份'),
 points:z.number().int().min(-1000).max(1000),
 rating:z.number().int().min(-300).max(300).optional(),
 reason:editReason,
});
const nonZero=(g:{points:number;rating?:number})=>g.points!==0||!!g.rating;
const nonZeroMessage={message:'调整积分不能为0',path:['points']};
export const pointGrantInput=grantFields.refine(nonZero,nonZeroMessage);
const savedGrantInput=grantFields.extend({reason:z.string().trim().min(1).max(500)}).refine(nonZero,nonZeroMessage);
// The append-only audit row is also the durable grant ledger. It is saved in
// the same optimistic transaction as the command, never inferred from matches.
export function pointGrants(s:Pick<State,'audits'>){
 return s.audits.flatMap(a=>{
  if(a.action!=='grantPoints')return [];
  const parsed=savedGrantInput.safeParse(a.changes);
  return parsed.success?[{...parsed.data,rating:parsed.data.rating??0,id:a.id,at:a.at,actor:a.actor}]:[];
 });
}
export type RatingAdjustment={playerId:string;at:number;delta:number};
/** The 修为 part of the owner's grants, in time order, for the realm and grouping replays. */
export function ratingAdjustments(s:Partial<Pick<State,'audits'>>):RatingAdjustment[]{
 if(!s.audits)return [];
 return pointGrants({audits:s.audits}).filter(g=>g.rating!==0).map(g=>({playerId:g.playerId,at:g.at,delta:g.rating})).sort((x,y)=>x.at-y.at);
}
