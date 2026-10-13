import {load,raw,save} from './store';
import {RequestError} from './request-body';
import {notificationPointsStatus,recordNotificationPoints} from './domain/notification-points';
import type {StoredPushSubscription} from './push-contract';
import type {Account,Audit} from './domain/types';
import {notificationDeviceStatement} from './notification-device';

export async function notificationIncentiveFor(account:Pick<Account,'id'|'playerId'>){
 const rows=await raw().prepare("SELECT payload FROM audits WHERE json_extract(payload,'$.action')='notificationPoints' AND json_extract(payload,'$.actor')=?").bind(account.id).all<{payload:string}>();
 return notificationPointsStatus({audits:rows.results.map(row=>JSON.parse(row.payload) as Audit)},account);
}

/** Device changes and their score entries share the club revision transaction.
 * Provider expiry and logout deliberately use the cleanup-only helper instead. */
export async function changeNotificationEnrollment(accountId:string,id:string,subscription:StoredPushSubscription|null,acceptPoints=false,device?:{receiptId?:string;source?:'system-permission';verified?:boolean;phoneEligible?:boolean}){
 for(let attempt=0;attempt<5;attempt++){
  const before=await load(),next=structuredClone(before),account=next.accounts.find(a=>a.id===accountId);
  if(!account||!next.players.some(p=>p.id===account.playerId&&p.enabled))throw new RequestError('账号当前不可使用通知',403);
  const rows=await raw().prepare('SELECT id,account_id AS accountId FROM push_subscriptions WHERE account_id=? OR id=?').bind(accountId,id).all<{id:string;accountId:string}>();
  const owned=rows.results.filter(r=>r.accountId===accountId),existing=rows.results.find(r=>r.id===id);
  if(subscription&&existing&&existing.accountId!==accountId)throw new RequestError('此设备需要重新连接通知，请关闭后再开启',409);
  if(subscription&&!existing&&owned.length>=5)throw new RequestError('每个账号最多开启5台设备，请先在旧设备关闭通知',409);
  const incentive=notificationPointsStatus(next,account),kind=subscription?(incentive.status==='disabled'?'reactivate':'enable'):'disable';
  if(subscription&&acceptPoints&&device?.phoneEligible&&incentive.status!=='earned'&&!device?.verified)throw new RequestError('通知积分状态已更新，请重新开启并验证',409);
  const phoneRecord=!subscription&&device?.phoneEligible?await raw().prepare('SELECT id FROM notification_devices WHERE account_id=? AND subscription_id=? AND active=1 AND phone_eligible=1').bind(accountId,id).first():null;
  const eligible=subscription?acceptPoints&&device?.phoneEligible:existing?.accountId===accountId&&!!phoneRecord;
  const pointsDelta=eligible?recordNotificationPoints(next,account,kind,Date.now()):0;
  // Cleanup writers can remove expired devices without a revision. Conditional
  // penalty insertion checks device ownership again inside the batch.
  const audit=pointsDelta?next.audits.pop()!:null;
  if(audit&&device?.source==='system-permission'){audit.reason='下次进入检测到通知权限已关闭';audit.changes={...audit.changes as object,source:device.source}}
  const extra:D1PreparedStatement[]=[];
  if(audit){
   const receiptGuard=!subscription&&device?.receiptId?' AND id=?':'';
   const query=subscription?'INSERT INTO audits(id,payload) VALUES(?,?)':`INSERT INTO audits(id,payload) SELECT ?,? WHERE EXISTS(SELECT 1 FROM push_subscriptions WHERE id=? AND account_id=?) AND EXISTS(SELECT 1 FROM notification_devices WHERE account_id=? AND subscription_id=? AND active=1 AND phone_eligible=1${receiptGuard})`;
   extra.push(raw().prepare(query).bind(audit.id,JSON.stringify(audit),...(subscription?[]:[id,accountId,accountId,id]),...(receiptGuard?[device!.receiptId]:[])));
  }
  extra.push(subscription?raw().prepare('INSERT INTO push_subscriptions(id,account_id,payload,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE push_subscriptions.account_id=excluded.account_id').bind(id,accountId,JSON.stringify(subscription),Date.now()):raw().prepare('DELETE FROM push_subscriptions WHERE id=? AND account_id=?').bind(id,accountId));
  if(subscription&&device?.receiptId)extra.push(notificationDeviceStatement(accountId,id,device.receiptId,device.phoneEligible));
  if(!subscription)extra.push(raw().prepare('UPDATE notification_devices SET active=0 WHERE account_id=? AND subscription_id=?').bind(accountId,id));
  try{
   await save(next,crypto.randomUUID(),before,extra);
   const after=await load(),status=notificationPointsStatus(after,account);
   return {ok:true,enabled:!!subscription,pointsDelta:audit&&after.audits.some(row=>row.id===audit.id)?pointsDelta:0,incentive:{...status,eligibleOnDevice:device?.phoneEligible===true}};
  }catch(error){if(attempt<4&&String(error).includes('UNIQUE constraint failed: commits'))continue;throw error}
 }
 throw new RequestError('通知设置已更新，请刷新重试',409);
}
