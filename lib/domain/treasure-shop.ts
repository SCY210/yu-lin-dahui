import {z} from 'zod';
import {isClubOwner} from './ownership';
import {isGuest} from './guests';
import {parseDomainCommand} from './command-contract';
import {pendingAutomaticCorrection} from './automatic-coins';
import {treasureBalance,appendTreasureLedger} from './treasure-ledger';
export {treasureBalance} from './treasure-ledger';
import {fail,type Account,type State,type TreasureLedger} from './types';

const identifier=z.string().min(1).max(100),amount=z.number().int().min(0).max(1000000);
export const treasureProductInput=z.object({id:identifier.optional(),name:z.string().trim().min(1).max(80),description:z.string().trim().max(1000),price:amount.min(1),stock:amount,kind:z.enum(['physical','digital']),active:z.boolean(),expectedVersion:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional()}).strict().superRefine((c,ctx)=>{if(c.id&&c.expectedVersion===undefined)ctx.addIssue({code:z.ZodIssueCode.custom,path:['expectedVersion'],message:'编辑商品需要原始版本，请重新打开编辑窗口'});if(!c.id&&c.expectedVersion!==undefined)ctx.addIssue({code:z.ZodIssueCode.custom,path:['expectedVersion'],message:'新增商品不需要原始版本'})});
export const treasureGrantInput=z.object({playerId:identifier,amount:z.number().int().min(-1000000).max(1000000).refine(n=>n!==0,'调整数量不能为零'),reason:z.string().trim().min(1).max(300),requestId:z.string().uuid()}).strict();
export const treasureRedeemInput=z.object({productId:identifier,quantity:z.number().int().min(1).max(99).default(1),expectedPrice:amount.min(1),requestId:z.string().uuid()}).strict();
export const treasureOrderInput=z.object({id:identifier,status:z.enum(['fulfilled','cancelled'])}).strict();
const schemas={treasureProduct:treasureProductInput,treasureGrant:treasureGrantInput,treasureRedeem:treasureRedeemInput,treasureOrder:treasureOrderInput};
const actions=new Set(Object.keys(schemas));
export function isTreasureAction(action:string){return actions.has(action)}
function owner(s:State,a:Account){if(!isClubOwner(s,a))fail('403: 只有群主可以管理羽林宝阁')}
function member(s:State,playerId:string){const p=s.players.find(p=>p.id===playerId);if(!p?.enabled||isGuest(s,playerId)||!s.accounts.some(a=>a.playerId===playerId))fail('请选择已启用的正式球友');return p}
function addLedger(s:State,row:Omit<TreasureLedger,'id'|'balance'|'sequence'>){return appendTreasureLedger(s,row)}
function audit(s:State,a:Account,action:string,reason:string,now:number,changes:unknown){s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason,changes})}
function nextProductVersion(version:number|undefined){const next=(version??0)+1;if(!Number.isSafeInteger(next)||next<1)fail('商品版本异常，请联系群主');return next}

export function treasureProduct(s:State,a:Account,input:unknown,now:number){
 owner(s,a);const c=treasureProductInput.parse(input),existing=c.id?s.treasureProducts.find(p=>p.id===c.id):undefined;
 if(c.id&&!existing)fail('商品不存在');
 const {expectedVersion,...fields}=c;
 if(existing&&expectedVersion!==(existing.version??0))fail('409: 商品或库存已更新，请关闭并重新打开编辑窗口');
 const p={...fields,id:existing?.id??crypto.randomUUID(),created:existing?.created??now,updated:now,version:nextProductVersion(existing?.version)};
 if(existing)Object.assign(existing,p);else s.treasureProducts.push(p);
 audit(s,a,'treasureProduct','更新宝阁商品',now,{productId:p.id});return p;
}
export function treasureGrant(s:State,a:Account,input:unknown,now:number){
 owner(s,a);const c=treasureGrantInput.parse(input),prior=s.treasureLedger.find(r=>r.actor===a.id&&r.requestId===c.requestId);
 if(prior){if(prior.kind!=='grant'||prior.playerId!==c.playerId||prior.delta!==c.amount||prior.reason!==c.reason)fail('此请求编号已经用于其他操作');return prior}
 member(s,c.playerId);const entry=addLedger(s,{playerId:c.playerId,delta:c.amount,kind:'grant',reason:c.reason,actor:a.id,at:now,requestId:c.requestId});
 audit(s,a,'treasureGrant',c.reason,now,{playerId:c.playerId,amount:c.amount});return entry;
}
export function treasureRedeem(s:State,a:Account,input:unknown,now:number){
 const c=treasureRedeemInput.parse(input);member(s,a.playerId);
 const prior=s.treasureOrders.find(o=>o.accountId===a.id&&o.requestId===c.requestId);
 if(prior){if(prior.productId!==c.productId||prior.quantity!==c.quantity)fail('此请求编号已经用于其他操作');return prior}
 if(s.treasureLedger.some(r=>r.actor===a.id&&r.requestId===c.requestId))fail('此请求编号已经用于其他操作');
 const p=s.treasureProducts.find(p=>p.id===c.productId);if(!p?.active)fail('商品已下架或不存在');if(p.price!==c.expectedPrice)fail('409: 商品价格已更新，请刷新后重新确认');if(p.stock<c.quantity)fail('库存不足，请调整兑换数量');
 const total=p.price*c.quantity;if(!Number.isSafeInteger(total)||treasureBalance(s,a.playerId)<total)fail('羽币余额不足');
 const version=nextProductVersion(p.version);
 const order={id:crypto.randomUUID(),playerId:a.playerId,accountId:a.id,productId:p.id,productName:p.name,kind:p.kind,price:p.price,quantity:c.quantity,total,status:'pending' as const,created:now,updated:now,requestId:c.requestId};
 addLedger(s,{playerId:a.playerId,delta:-total,kind:'redeem',reason:`兑换：${p.name} × ${c.quantity}`,actor:a.id,at:now,requestId:c.requestId,orderId:order.id});
 p.stock-=c.quantity;p.updated=now;p.version=version;s.treasureOrders.push(order);
 audit(s,a,'treasureRedeem','兑换宝阁商品',now,{playerId:a.playerId,orderId:order.id});return order;
}
export function treasureOrder(s:State,a:Account,input:unknown,now:number){
 owner(s,a);const c=treasureOrderInput.parse(input),o=s.treasureOrders.find(o=>o.id===c.id);if(!o)fail('兑换记录不存在');
 if(o.status===c.status)return o;if(o.status!=='pending')fail('已处理的兑换不能再次变更');
 if(c.status==='cancelled'){
  const p=s.treasureProducts.find(p=>p.id===o.productId);if(!p)fail('商品记录不存在，无法退回库存');
  if(!Number.isSafeInteger(p.stock+o.quantity))fail('库存数量异常');
  const version=nextProductVersion(p.version);
  addLedger(s,{playerId:o.playerId,delta:o.total,kind:'refund',reason:`取消兑换：${o.productName} × ${o.quantity}`,actor:a.id,at:now,requestId:`refund:${o.id}`,orderId:o.id});p.stock+=o.quantity;p.updated=now;p.version=version;
 }
 o.status=c.status;o.updated=now;o.handledBy=a.id;audit(s,a,'treasureOrder',c.status==='fulfilled'?'已发放宝阁礼品':'取消兑换并退回羽币',now,{playerId:o.playerId,orderId:o.id});return o;
}
export function applyTreasure(s:State,a:Account,action:string,input:unknown,now:number){
 const parsed=parseDomainCommand(schemas,action,input);if(!parsed)return false;
 switch(parsed.action){case 'treasureProduct':treasureProduct(s,a,parsed.payload,now);break;case 'treasureGrant':treasureGrant(s,a,parsed.payload,now);break;case 'treasureRedeem':treasureRedeem(s,a,parsed.payload,now);break;case 'treasureOrder':treasureOrder(s,a,parsed.payload,now);break}return true;
}
/** Only the owner sees all fulfilment records. No account identifiers leave the shop projection. */
export function treasureShopView(s:State,a:Account){
 const isOwner=isClubOwner(s,a);
 const ledger=s.treasureLedger.filter(r=>r.playerId===a.playerId).map(r=>({id:r.id,playerId:r.playerId,delta:r.delta,balance:r.balance,kind:r.kind,reason:r.reason,at:r.at,orderId:r.orderId}));
 const orders=s.treasureOrders.filter(o=>isOwner||o.playerId===a.playerId).map(o=>({id:o.id,playerId:o.playerId,productId:o.productId,productName:o.productName,kind:o.kind,price:o.price,quantity:o.quantity,total:o.total,status:o.status,created:o.created,updated:o.updated}));
 const policy=s.settings.automaticCoins,rewardPolicy=policy?{version:policy.version,activatedAt:policy.activatedAt}:null;
 return {products:s.treasureProducts.filter(p=>isOwner||p.active),balance:treasureBalance(s,a.playerId),pendingCorrection:pendingAutomaticCorrection(s,a.playerId),rewardPolicy,ledger,orders,wallets:isOwner?s.accounts.filter(a=>s.players.some(p=>p.id===a.playerId&&p.enabled&&!isGuest(s,p.id))).map(a=>({playerId:a.playerId,balance:treasureBalance(s,a.playerId),pendingCorrection:pendingAutomaticCorrection(s,a.playerId)})):[]};
}
