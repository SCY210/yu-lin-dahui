import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {canManageEvent} from './permissions';
import {editReason} from './edit-reason';
import {fail,type Account,type Bill,type Settlement,type State} from './types';

/** Payments a player reports themselves; older stored payments (other methods) still count towards paid. */
export const selfReportedPayment='self-report';
const pid=z.string().min(1).max(100);
const schemas={feePaid:z.object({eventId:pid,settlementId:pid,playerId:pid,paid:z.boolean(),reason:editReason})};

export function latestConfirmedSettlement(s:Pick<State,'settlements'>,eventId:string):Settlement|undefined{
 return s.settlements.filter(x=>x.eventId===eventId&&x.confirmed).sort((a,b)=>b.version-a.version)[0];
}
export function paidCents(s:Pick<State,'payments'>,eventId:string,playerId:string){
 return s.payments.filter(p=>p.eventId===eventId&&p.playerId===playerId).reduce((n,p)=>n+p.cents,0);
}
/** A bill counts as paid once the recorded payments cover its total; a zero bill needs nothing. */
export function billPaid(s:Pick<State,'payments'>,eventId:string,bill:Pick<Bill,'playerId'|'total'>){
 return bill.total<=0||paidCents(s,eventId,bill.playerId)>=bill.total;
}
/** Who receives a player's fee notices and may mark their bill paid: the player's own enabled account, or, for a
 * friend registered by someone else and without an account, the enabled account that registered them. */
export function feeContact(s:Pick<State,'accounts'|'players'>,playerId:string):{accountId:string;proxy:boolean}|null{
 const player=s.players.find(p=>p.id===playerId);if(!player?.enabled)return null;
 const own=s.accounts.find(a=>a.playerId===playerId);if(own)return {accountId:own.id,proxy:false};
 const owner=s.accounts.find(a=>a.id===player.ownerId);if(!owner)return null;
 const ownerPlayer=s.players.find(p=>p.id===owner.playerId);
 return ownerPlayer?.enabled?{accountId:owner.id,proxy:true}:null;
}
export function unpaidBills(s:Pick<State,'payments'>,bill:Settlement){return bill.bills.filter(b=>!billPaid(s,bill.eventId,b))}

/** Players mark their own bill (or a proxied friend's) as paid; activity managers may also correct it. */
export async function applyFeePayments(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);
 if(!command)return false;
 const p=command.payload;
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 const latest=latestConfirmedSettlement(s,e.id)??fail('费用分摊尚未确认');
 if(p.settlementId!==latest.id)fail('409: 分摊版本已更新，请刷新后再标记付款');
 const bill=latest.bills.find(b=>b.playerId===p.playerId)??fail('该球友不在已确认的分摊中');
 if(a.playerId!==p.playerId&&feeContact(s,p.playerId)?.accountId!==a.id&&!canManageEvent(a,e))fail('403: 只能标记自己或自己代报名朋友的付款');
 const id=`self:${e.id}:${p.playerId}`;
 s.payments=s.payments.filter(x=>x.id!==id);
 if(p.paid){
  const other=paidCents(s,e.id,p.playerId);
  if(other<bill.total)s.payments.push({id,eventId:e.id,playerId:p.playerId,cents:bill.total-other,method:selfReportedPayment,at:now,reason:'球友标记已付款',actor:a.id});
 }
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:p.paid?'标记已付款':'撤销付款标记',changes:{eventId:e.id,playerId:p.playerId,paid:p.paid,settlementId:latest.id}});
 return true;
}
