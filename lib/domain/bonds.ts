import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {finished} from './social';
import {gameFacts} from './game-facts';
import {isGuest} from './guests';
import {isClubOwner} from './ownership';
import {fail,type Account,type Match,type State} from './types';

import {bondTiers,bondTierIndex,bondGamePoints,bondWinPoints,bondCoinPoints,giftNoticeDays,type BondRow,type BondPair,type GiftNotice} from './bond-tiers';
export * from './bond-tiers';

/** A gift row of this member's own ledger: a shop gift they gave or received. Members cannot give coins to each other, so
 * nobody pools coins; coin gifts from the short time they were allowed stay in the ledger and still count. A cancelled shop
 * gift counts for nothing. */
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

function member(s:State,playerId:string,message:string){const p=s.players.find(p=>p.id===playerId);if(!p?.enabled||isGuest(s,playerId)||!s.accounts.some(a=>a.playerId===playerId))fail(message);return p}
/** The giving member and the receiving member of a gift; a member cannot give to themselves. */
export function giftParties(s:State,a:Account,toPlayerId:string){
 if(toPlayerId===a.playerId)fail('不能送给自己');
 return {from:member(s,a.playerId,'只有已启用的正式球友可以送礼'),to:member(s,toPlayerId,'只能送给已启用的正式球友')};
}
const message=z.string().trim().max(60,'留言最多60字').default('');
export const giftMessageInput=message;
const schemas={giftSeen:z.object({ids:z.array(z.string().min(1).max(200)).min(1).max(50)}).strict()};
const actions=new Set(Object.keys(schemas));
export function isBondAction(action:string){return actions.has(action)}

/** Gifts this member received and has not acknowledged yet. */
export function giftNotices(s:Pick<State,'treasureLedger'|'treasureOrders'>,a:Pick<Account,'playerId'|'giftSeen'>,now:number):GiftNotice[]{
 const seen=new Set(a.giftSeen??[]),since=now-giftNoticeDays*86400000;
 return giftRows(s,a.playerId).filter(r=>r.giftFrom&&r.at>=since&&r.at<=now&&!seen.has(r.id))
  .map(r=>({id:r.id,fromPlayerId:r.giftFrom!,coins:Math.max(0,r.delta),...(r.giftItem?{item:r.giftItem}:{}),value:r.giftValue??r.delta,...(r.message?{message:r.message}:{}),at:r.at}))
  .sort((x,y)=>x.at-y.at||x.id.localeCompare(y.id));
}

/** Every pair of members with a bond, strongest first, replayed the same way as `bondRows` so both agree. */
export function bondPairs(s:Pick<State,'matches'|'players'|'accounts'|'treasureLedger'|'treasureOrders'>,matches:Match[]=finished(s as State)):BondPair[]{
 const steps:{at:number;order:string;key:string;game?:boolean;won?:boolean;gift?:number}[]=[];
 const key=(x:string,y:string)=>x<y?x+'|'+y:y+'|'+x;
 for(const m of matches)for(const side of ['a','b'] as const){
  const team=[...new Set(m[side])];if(team.length<2)continue;
  for(const g of gameFacts(m))for(let i=0;i<team.length;i++)for(let j=i+1;j<team.length;j++)
   steps.push({at:m.end!,order:m.id+':'+String(g.index).padStart(3,'0'),key:key(team[i],team[j]),game:true,won:g.winner===side});
 }
 // Each gift appears once, on the giver's row.
 const cancelled=new Set(s.treasureOrders.filter(o=>o.status==='cancelled').map(o=>o.id));
 for(const r of s.treasureLedger)if(r.giftTo&&!(r.orderId&&cancelled.has(r.orderId)))
  steps.push({at:r.at,order:r.requestId.replace(/^gift:/,''),key:key(r.playerId,r.giftTo),gift:r.giftValue??Math.abs(r.delta)});
 steps.sort((x,y)=>x.at-y.at||x.order.localeCompare(y.order));
 const pairs=new Map<string,BondPair>();
 for(const step of steps){
  const [a,b]=step.key.split('|');if(a===b||isGuest(s as State,a)||isGuest(s as State,b))continue;
  const pair=pairs.get(step.key)??{a,b,score:0,games:0,wins:0,gifts:0};
  pair.score+=step.game?(bondGamePoints+(step.won?bondWinPoints:0))*bondTiers[bondTierIndex(pair.score)].boost:step.gift!*bondCoinPoints;
  if(step.game){pair.games++;if(step.won)pair.wins++}else pair.gifts+=step.gift!;
  pairs.set(step.key,pair);
 }
 return [...pairs.values()].filter(p=>p.score>0).sort((x,y)=>y.score-x.score||x.a.localeCompare(y.a)||x.b.localeCompare(y.b));
}

/** The viewer's own bonds; only the owner and administrators also see the bonds between every pair of members. */
export function bondView(s:State,a:Account,matches?:Match[]){
 return {rows:bondRows(s,a.playerId,matches),...(a.role==='admin'||isClubOwner(s,a)?{pairs:bondPairs(s,matches)}:{})};
}

export function applyBond(s:State,a:Account,action:string,input:unknown){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 const account=s.accounts.find(x=>x.id===a.id)??fail('账号不存在');
 account.giftSeen=[...new Set([...(account.giftSeen??[]),...command.payload.ids])].slice(-300);
 return true;
}
