import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {finished} from './social';
import {gameFacts} from './game-facts';
import {isGuest} from './guests';
import {appendTreasureLedger,treasureBalance} from './treasure-ledger';
import {fail,type Account,type Match,type State} from './types';

import {bondTiers,bondTierIndex,bondGamePoints,bondWinPoints,bondCoinPoints,giftNoticeDays,type BondRow,type GiftNotice} from './bond-tiers';
export * from './bond-tiers';

/** A gift row of this member's own ledger: coins or a shop gift they gave or received. A cancelled shop gift counts for nothing. */
function giftRows(s:Pick<State,'treasureLedger'|'treasureOrders'>,playerId:string){
 const cancelled=new Set(s.treasureOrders.filter(o=>o.status==='cancelled').map(o=>o.id));
 return s.treasureLedger.filter(r=>r.playerId===playerId&&(r.giftTo||r.giftFrom)&&!(r.orderId&&cancelled.has(r.orderId)));
}

/** Every member this player has a bond with, strongest first. Partner games and gifts are replayed in time order so each
 * game gets the boost of the stage the pair had reached by then. Both members of a pair derive the same score. */
export function bondRows(s:Pick<State,'matches'|'players'|'accounts'|'treasureLedger'|'treasureOrders'>,playerId:string,matches:Match[]=finished(s as State)):BondRow[]{
 const steps:{at:number;order:string;other:string;points:(score:number)=>number;game?:boolean;won?:boolean;sent?:number;received?:number}[]=[];
 for(const m of matches){
  const side=m.a.includes(playerId)?'a':m.b.includes(playerId)?'b':null;if(!side)continue;
  const partners=m[side].filter(id=>id!==playerId);if(!partners.length)continue;
  for(const g of gameFacts(m))for(const other of partners){
   const won=g.winner===side;
   steps.push({at:m.end!,order:m.id+':'+String(g.index).padStart(3,'0'),other,game:true,won,points:score=>(bondGamePoints+(won?bondWinPoints:0))*bondTiers[bondTierIndex(score)].boost});
  }
 }
 for(const r of giftRows(s,playerId)){
  const value=r.giftValue??Math.abs(r.delta),other=(r.giftTo??r.giftFrom)!;
  steps.push({at:r.at,order:r.requestId.replace(/^gift:/,''),other,points:()=>value*bondCoinPoints,...(r.giftTo?{sent:value}:{received:value})});
 }
 steps.sort((x,y)=>x.at-y.at||x.order.localeCompare(y.order)||x.other.localeCompare(y.other));
 const rows=new Map<string,BondRow>();
 for(const step of steps){
  if(step.other===playerId||isGuest(s as State,step.other))continue;
  const row=rows.get(step.other)??{playerId:step.other,score:0,games:0,wins:0,giftsSent:0,giftsReceived:0};
  row.score+=step.points(row.score);
  if(step.game){row.games++;if(step.won)row.wins++}
  row.giftsSent+=step.sent??0;row.giftsReceived+=step.received??0;rows.set(step.other,row);
 }
 return [...rows.values()].filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.playerId.localeCompare(b.playerId));
}

/** Coins received as gifts can be spent in the shop but not given on, so two members cannot raise a bond by passing
 * the same coins back and forth. Shop spending uses received coins first. */
export function giftableCoins(s:Pick<State,'treasureLedger'>,playerId:string){
 const rows=s.treasureLedger.filter(r=>r.playerId===playerId&&r.sequence!==undefined).sort((a,b)=>a.sequence!-b.sequence!);
 let received=0;
 for(const r of rows){if(r.kind==='gift_received'&&r.delta>0)received+=r.delta;else if(r.kind==='redeem'&&r.delta<0)received=Math.max(0,received+r.delta)}
 return Math.max(0,treasureBalance(s as State,playerId)-received);
}

function member(s:State,playerId:string,message:string){const p=s.players.find(p=>p.id===playerId);if(!p?.enabled||isGuest(s,playerId)||!s.accounts.some(a=>a.playerId===playerId))fail(message);return p}
/** The giving member and the receiving member of a gift; a member cannot give to themselves. */
export function giftParties(s:State,a:Account,toPlayerId:string){
 if(toPlayerId===a.playerId)fail('不能送给自己');
 return {from:member(s,a.playerId,'只有已启用的正式球友可以送礼'),to:member(s,toPlayerId,'只能送给已启用的正式球友')};
}
const message=z.string().trim().max(60,'留言最多60字').default('');
export const giftMessageInput=message;
export const bondGiftInput=z.object({toPlayerId:z.string().min(1).max(100),coins:z.number().int().min(1).max(10000),message,requestId:z.string().uuid()}).strict();
const schemas={bondGift:bondGiftInput,giftSeen:z.object({ids:z.array(z.string().min(1).max(200)).min(1).max(50)}).strict()};
const actions=new Set(Object.keys(schemas));
export function isBondAction(action:string){return actions.has(action)}

/** Give coins to another member. The giver's coins move to the receiver, and the pair's bond grows by bondCoinPoints per coin. */
export function bondGift(s:State,a:Account,input:unknown,now:number){
 const c=bondGiftInput.parse(input),prior=s.treasureLedger.find(r=>r.actor===a.id&&r.requestId===c.requestId);
 if(prior){if(prior.kind!=='gift_sent'||prior.giftTo!==c.toPlayerId||prior.delta!==-c.coins)fail('此请求编号已经用于其他操作');return prior}
 const {from,to}=giftParties(s,a,c.toPlayerId);
 if(giftableCoins(s,from.id)<c.coins)fail('可赠送的羽币不足：收到的赠礼只能兑换礼品，不能转送');
 const note=c.message?{message:c.message}:{};
 const sent=appendTreasureLedger(s,{playerId:from.id,delta:-c.coins,kind:'gift_sent',reason:`赠送给 ${to.name}`,actor:a.id,at:now,requestId:c.requestId,giftTo:to.id,giftValue:c.coins,...note});
 appendTreasureLedger(s,{playerId:to.id,delta:c.coins,kind:'gift_received',reason:`${from.name} 的赠礼`,actor:a.id,at:now,requestId:'gift:'+c.requestId,giftFrom:from.id,giftValue:c.coins,...note});
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'bondGift',reason:'赠送羽币',changes:{from:from.id,to:to.id,coins:c.coins}});
 return sent;
}

/** Gifts this member received and has not acknowledged yet. */
export function giftNotices(s:Pick<State,'treasureLedger'|'treasureOrders'>,a:Pick<Account,'playerId'|'giftSeen'>,now:number):GiftNotice[]{
 const seen=new Set(a.giftSeen??[]),since=now-giftNoticeDays*86400000;
 return giftRows(s,a.playerId).filter(r=>r.giftFrom&&r.at>=since&&r.at<=now&&!seen.has(r.id))
  .map(r=>({id:r.id,fromPlayerId:r.giftFrom!,coins:Math.max(0,r.delta),...(r.giftItem?{item:r.giftItem}:{}),value:r.giftValue??r.delta,...(r.message?{message:r.message}:{}),at:r.at}))
  .sort((x,y)=>x.at-y.at||x.id.localeCompare(y.id));
}

/** The viewer's own bonds and gifts only; nobody sees the bonds between two other members. */
export function bondView(s:State,a:Account,matches?:Match[]){
 return {rows:bondRows(s,a.playerId,matches),giftable:s.players.some(p=>p.id===a.playerId)?giftableCoins(s,a.playerId):0};
}

export function applyBond(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 if(command.action==='bondGift')bondGift(s,a,command.payload,now);
 else{const account=s.accounts.find(x=>x.id===a.id)??fail('账号不存在');account.giftSeen=[...new Set([...(account.giftSeen??[]),...command.payload.ids])].slice(-300)}
 return true;
}
