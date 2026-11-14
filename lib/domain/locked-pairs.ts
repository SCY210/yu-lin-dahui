import type {Event} from './types';

/** 锁组 (docs/LOCKED_PAIRS.md): an organiser locks two players of a doubles activity together. Whenever both are
 * available, the lineup generators bring them on court together and on the same side; when only one of them is there,
 * that player rotates as usual. Hand-made swaps and lineup edits are not restricted. */

/** Partner of each locked player for the players given (both must be among them). */
export function lockedPartners(e:Pick<Event,'lockedPairs'>,available:Iterable<string>){
 const ids=new Set(available),partner=new Map<string,string>();
 for(const [a,b] of e.lockedPairs??[])if(ids.has(a)&&ids.has(b)){partner.set(a,b);partner.set(b,a)}
 return partner;
}

/** Whether every locked player in a lineup (teams of two in order) is on court with their partner, on the same team. */
export function keepsLocks(list:readonly string[],partner:ReadonlyMap<string,string>){
 for(let i=0;i<list.length;i++){
  const other=partner.get(list[i]);if(other===undefined)continue;
  const j=list.indexOf(other);if(j<0||Math.floor(i/2)!==Math.floor(j/2))return false;
 }
 return true;
}

/** The next four from a queue (best first), keeping each locked pair together. A pair takes two seats and waits for
 * the next court when only one seat is left. Pairs come first in the result, so positions 0-1 (and 2-3) are teams.
 * Without locks this is the first four in the queue. */
export function pickFour(order:readonly string[],partner:ReadonlyMap<string,string>):string[]|undefined{
 const present=new Set(order),seen=new Set<string>(),pairs:string[][]=[],singles:string[][]=[];
 for(const id of order){
  if(seen.has(id))continue;const other=partner.get(id);
  if(other===undefined){singles.push([id]);seen.add(id)}
  else if(present.has(other)){pairs.push([id,other]);seen.add(id);seen.add(other)}
 }
 const options=[singles.slice(0,4),[...pairs.slice(0,1),...singles.slice(0,2)],pairs.slice(0,2)].filter(o=>o.flat().length===4);
 if(!options.length)return undefined;
 // Least far down the queue: compare the furthest position chosen, then the next, and so on.
 const rank=(o:string[][])=>o.flat().map(id=>order.indexOf(id)).sort((a,b)=>b-a);
 const better=(x:number[],y:number[])=>{for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]<y[i];return false};
 let best=options[0];for(const o of options.slice(1))if(better(rank(o),rank(best)))best=o;
 return [...best.filter(u=>u.length===2),...best.filter(u=>u.length===1)].flat();
}

/** The team splits of four players that keep their locked pairs; undefined when no locked pair is among them. */
export function lockSplits(ids:readonly string[],partner:ReadonlyMap<string,string>){
 if(!ids.some(id=>{const other=partner.get(id);return other!==undefined&&ids.includes(other)}))return undefined;
 const [a,b,c,d]=ids;
 return [[[a,b],[c,d]],[[a,c],[b,d]],[[a,d],[b,c]]].filter(split=>keepsLocks(split.flat(),partner));
}
