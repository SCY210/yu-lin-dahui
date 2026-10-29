import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {finished} from './social';
import {gameFacts} from './game-facts';
import {guestIds,isGuest} from './guests';
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
type BondState=Pick<State,'matches'|'players'|'accounts'|'treasureLedger'|'treasureOrders'>;
type BondGift=Pick<State['treasureLedger'][number],'playerId'|'giftTo'|'giftFrom'|'giftValue'|'delta'|'at'|'requestId'>;
/** Only immutable replay facts enter the shared cache, never a request's State or mutable match arrays. */
function bondMatches(matches:Match[]){return matches.map(m=>({id:m.id,end:m.end!,a:[...m.a],b:[...m.b],games:gameFacts(m).map(g=>({index:g.index,winner:g.winner}))}))}
type BondMatch=ReturnType<typeof bondMatches>[number];
export function bondRows(s:BondState,playerId:string,matches:Match[]=finished(s as State)):BondRow[]{
 return replayBondRows(playerId,bondMatches(matches.filter(m=>m.a.includes(playerId)||m.b.includes(playerId))),giftRows(s,playerId),guestIds(s));
}
function replayBondRows(playerId:string,matches:BondMatch[],gifts:BondGift[],guests:Set<string>):BondRow[]{
 const steps:{at:number;order:string;other:string;points:(score:number)=>number;game?:boolean;won?:boolean;sent?:number;received?:number}[]=[];
 for(const m of matches){
  const side=m.a.includes(playerId)?'a':m.b.includes(playerId)?'b':null;if(!side)continue;
  const partners=m[side].filter(id=>id!==playerId);if(!partners.length)continue;
  for(const g of m.games)for(const other of partners){
   const won=g.winner===side;
   steps.push({at:m.end!,order:m.id+':'+String(g.index).padStart(3,'0'),other,game:true,won,points:score=>(bondGamePoints+(won?bondWinPoints:0))*bondTiers[bondTierIndex(score)].boost});
  }
 }
 for(const r of gifts){
  const value=r.giftValue??Math.abs(r.delta),other=(r.giftTo??r.giftFrom)!;
  steps.push({at:r.at,order:r.requestId.replace(/^gift:/,''),other,points:()=>value*bondCoinPoints,...(r.giftTo?{sent:value}:{received:value})});
 }
 steps.sort((x,y)=>x.at-y.at||x.order.localeCompare(y.order)||x.other.localeCompare(y.other));
 const rows=new Map<string,BondRow>();
 for(const step of steps){
  if(step.other===playerId||guests.has(step.other))continue;
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
export function bondPairs(s:BondState,matches:Match[]=finished(s as State)):BondPair[]{
 const cancelled=new Set(s.treasureOrders.filter(o=>o.status==='cancelled').map(o=>o.id));
 return replayBondPairs(bondMatches(matches),s.treasureLedger.filter(r=>r.giftTo&&!(r.orderId&&cancelled.has(r.orderId))),guestIds(s));
}
function replayBondPairs(matches:BondMatch[],gifts:BondGift[],guests:Set<string>):BondPair[]{
 const steps:{at:number;order:string;key:string;game?:boolean;won?:boolean;gift?:number}[]=[];
 const key=(x:string,y:string)=>x<y?x+'|'+y:y+'|'+x;
 for(const m of matches)for(const side of ['a','b'] as const){
  const team=[...new Set(m[side])];if(team.length<2)continue;
  for(const g of m.games)for(let i=0;i<team.length;i++)for(let j=i+1;j<team.length;j++)
   steps.push({at:m.end!,order:m.id+':'+String(g.index).padStart(3,'0'),key:key(team[i],team[j]),game:true,won:g.winner===side});
 }
 // Each gift appears once, on the giver's row.
 for(const r of gifts)if(r.giftTo)
  steps.push({at:r.at,order:r.requestId.replace(/^gift:/,''),key:key(r.playerId,r.giftTo),gift:r.giftValue??Math.abs(r.delta)});
 steps.sort((x,y)=>x.at-y.at||x.order.localeCompare(y.order));
 const pairs=new Map<string,BondPair>();
 for(const step of steps){
  const [a,b]=step.key.split('|');if(a===b||guests.has(a)||guests.has(b))continue;
  const pair=pairs.get(step.key)??{a,b,score:0,games:0,wins:0,gifts:0};
  pair.score+=step.game?(bondGamePoints+(step.won?bondWinPoints:0))*bondTiers[bondTierIndex(pair.score)].boost:step.gift!*bondCoinPoints;
  if(step.game){pair.games++;if(step.won)pair.wins++}else pair.gifts+=step.gift!;
  pairs.set(step.key,pair);
 }
 return [...pairs.values()].filter(p=>p.score>0).sort((x,y)=>y.score-x.score||x.a.localeCompare(y.a)||x.b.localeCompare(y.b));
}

/** Viewer-independent indexed facts. Replay only the requested member, once; administrative pairs are computed
 * only when an authorized viewer needs them. Keep each ledger side independent: legacy gifts may be asymmetric. */
export function bondHistory(s:BondState){
 const matches=bondMatches(finished(s as State)),guests=guestIds(s),byPlayer=new Map<string,BondMatch[]>(),gifts=new Map<string,BondGift[]>(),allGifts:BondGift[]=[];
 for(const match of matches)for(const id of new Set([...match.a,...match.b])){
  const rows=byPlayer.get(id);if(rows)rows.push(match);else byPlayer.set(id,[match]);
 }
 const cancelled=new Set(s.treasureOrders.filter(o=>o.status==='cancelled').map(o=>o.id));
 for(const gift of s.treasureLedger)if((gift.giftTo||gift.giftFrom)&&!(gift.orderId&&cancelled.has(gift.orderId))){
  const {playerId,giftTo,giftFrom,giftValue,delta,at,requestId}=gift,snapshot={playerId,giftTo,giftFrom,giftValue,delta,at,requestId};allGifts.push(snapshot);
  const rows=gifts.get(playerId);if(rows)rows.push(snapshot);else gifts.set(playerId,[snapshot]);
 }
 const rows=new Map<string,BondRow[]>();let pairs:BondPair[]|undefined;
 return {
  rowFor(playerId:string){let value=rows.get(playerId);if(!value){value=replayBondRows(playerId,byPlayer.get(playerId)??[],gifts.get(playerId)??[],guests);rows.set(playerId,value)}return value},
  pairs(){return pairs??=replayBondPairs(matches,allGifts,guests)},
 };
}
export type BondHistory=ReturnType<typeof bondHistory>;

/** The viewer's own bonds; only the owner and administrators also see the bonds between every pair of members.
 * Shared history is internal only. Recheck authorization and return independent rows on every projection. */
export function bondView(s:State,a:Account,matches?:Match[],history?:BondHistory){
 const all=history?undefined:matches??finished(s),rows=history?history.rowFor(a.playerId):bondRows(s,a.playerId,all);
 return {rows:history?rows.map(row=>({...row})):rows,...(a.role==='admin'||isClubOwner(s,a)?{pairs:history?history.pairs().map(pair=>({...pair})):bondPairs(s,all)}:{})};
}

export function applyBond(s:State,a:Account,action:string,input:unknown){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 const account=s.accounts.find(x=>x.id===a.id)??fail('账号不存在');
 account.giftSeen=[...new Set([...(account.giftSeen??[]),...command.payload.ids])].slice(-300);
 return true;
}
