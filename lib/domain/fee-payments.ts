import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {canManageEvent} from './permissions';
import {editReason} from './edit-reason';
import {openTransfers,playerSettled,transferPaidCents,transferPayment} from './fee-transfers';
import {fail,type Account,type Bill,type Settlement,type State} from './types';

/** Payments a player reports themselves; older stored payments (other methods) still count towards paid. */
export const selfReportedPayment='self-report';
const pid=z.string().min(1).max(100);
const schemas={feePaid:z.object({eventId:pid,settlementId:pid,playerId:pid,paid:z.boolean(),reason:editReason}),feeTransferPaid:z.object({eventId:pid,settlementId:pid,from:pid,to:pid,paid:z.boolean(),reason:editReason})};

export function latestConfirmedSettlement(s:Pick<State,'settlements'>,eventId:string):Settlement|undefined{
 return s.settlements.filter(x=>x.eventId===eventId&&x.confirmed).sort((a,b)=>b.version-a.version)[0];
}
/** Payments towards a bill paid the old way; marked transfers between members (fee advances) do not count here. */
export function paidCents(s:Pick<State,'payments'>,eventId:string,playerId:string){
 return s.payments.filter(p=>p.eventId===eventId&&p.playerId===playerId&&!p.to).reduce((n,p)=>n+p.cents,0);
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
/** Who still owes on a confirmed version. With fee advances that is everyone with an unmarked transfer to make,
 * including a collector who still has to repay advancers; advancers whose advance covers their share owe nothing. */
export function unpaidBills(s:Pick<State,'payments'>,bill:Settlement):Bill[]{
 if(!bill.transfers)return bill.bills.filter(b=>!billPaid(s,bill.eventId,b));
 const open=openTransfers(s.payments,bill),payers=[...new Set(open.map(t=>t.from))];
 return payers.map(playerId=>bill.bills.find(b=>b.playerId===playerId)??{playerId,court:0,ball:0,other:0,total:open.filter(t=>t.from===playerId).reduce((n,t)=>n+t.cents,0),minutes:0});
}
export {playerSettled};

/** Players mark their own bill (or a proxied friend's) as paid; activity managers may also correct it. */
export async function applyFeePayments(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);
 if(!command)return false;
 const p=command.payload;
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 const latest=latestConfirmedSettlement(s,e.id)??fail('费用分摊尚未确认');
 if(p.settlementId!==latest.id)fail('409: 分摊版本已更新，请刷新后再标记付款');
 if(command.action==='feeTransferPaid'){
  // One transfer between members: the payer (or whoever registered a friend who pays), the receiver, or an organiser.
  const t=command.payload,transfer=latest.transfers?.find(x=>x.from===t.from&&x.to===t.to)??fail('这笔转账不在已确认的分摊中');
  if(a.playerId!==t.from&&feeContact(s,t.from)?.accountId!==a.id&&a.playerId!==t.to&&!canManageEvent(a,e))fail('403: 只能标记自己付出或收到的转账');
  const id=`transfer:${e.id}:${t.from}:${t.to}`;
  s.payments=s.payments.filter(x=>x.id!==id);
  if(t.paid){const other=transferPaidCents(s.payments,e.id,t.from,t.to);if(other<transfer.cents)s.payments.push({id,eventId:e.id,playerId:t.from,to:t.to,cents:transfer.cents-other,method:transferPayment,at:now,reason:a.playerId===t.to?'收款人确认已收到':'标记已转账',actor:a.id})}
  s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:command.action,reason:t.paid?'标记已转账':'撤销转账标记',changes:{eventId:e.id,from:t.from,to:t.to,cents:transfer.cents,paid:t.paid,settlementId:latest.id}});
  return true;
 }
 if(latest.transfers)fail('本次分摊按转账结算，请标记每一笔转账');
 const pay=command.payload;
 const bill=latest.bills.find(b=>b.playerId===pay.playerId)??fail('该球友不在已确认的分摊中');
 if(a.playerId!==pay.playerId&&feeContact(s,pay.playerId)?.accountId!==a.id&&!canManageEvent(a,e))fail('403: 只能标记自己或自己代报名朋友的付款');
 const id=`self:${e.id}:${pay.playerId}`;
 s.payments=s.payments.filter(x=>x.id!==id);
 if(pay.paid){
  const other=paidCents(s,e.id,pay.playerId);
  if(other<bill.total)s.payments.push({id,eventId:e.id,playerId:pay.playerId,cents:bill.total-other,method:selfReportedPayment,at:now,reason:'球友标记已付款',actor:a.id});
 }
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:pay.paid?'标记已付款':'撤销付款标记',changes:{eventId:e.id,playerId:pay.playerId,paid:pay.paid,settlementId:latest.id}});
 return true;
}
