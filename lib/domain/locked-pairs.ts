import type {Event} from './types';

/** 锁组 (docs/LOCKED_PAIRS.md): an organiser locks two players of a doubles activity together. Whenever both play, they
 * are partners. Fair turns come first: the two come on court together when both are due (or as good as due); when only
 * one of them is due, that one plays this turn without the other, so neither plays more or fewer games than everyone
 * else, and they are together again once their turns line up. Hand-made swaps and lineup edits are not restricted. */

/** Partner of each locked player for the players given (both must be among them). */
export function lockedPartners(e:Pick<Event,'lockedPairs'>,available:Iterable<string>){
 const ids=new Set(available),partner=new Map<string,string>();
 for(const [a,b] of e.lockedPairs??[])if(ids.has(a)&&ids.has(b)){partner.set(a,b);partner.set(b,a)}
 return partner;
}

const pairKey=(a:string,b:string)=>a<b?a+'|'+b:b+'|'+a;
/** How many of each locked pair a lineup has (0, 1 or 2), for every pair in `partner`. */
export function lockCounts(list:readonly string[],partner:ReadonlyMap<string,string>){
 const counts=new Map<string,number>(),chosen=new Set(list);
 for(const [id,other] of partner){const key=pairKey(id,other);counts.set(key,(counts.get(key)??0)+Number(chosen.has(id)))}
 return counts;
}

/** Whether a lineup (teams of two in order) keeps its locks: two locked players who both play are on the same team.
 * With `required` (from lockCounts of the chosen players), each pair must also keep the number of its players chosen,
 * so a search that swaps players can neither split a pair nor bring in the other half of one that sits out. */
export function keepsLocks(list:readonly string[],partner:ReadonlyMap<string,string>,required?:ReadonlyMap<string,number>){
 for(let i=0;i<list.length;i++){
  const other=partner.get(list[i]);if(other===undefined)continue;
  const j=list.indexOf(other);if(j>=0&&Math.floor(i/2)!==Math.floor(j/2))return false;
 }
 if(required){const counts=lockCounts(list,partner);for(const [key,n] of required)if((counts.get(key)??0)!==n)return false}
 return true;
}

/** The next four from a fair queue (most due first). Turns come first: when only one of a locked pair is among the
 * first four, their partner takes the place of someone as due (`swappable(out,incoming)`), or else the locked player
 * gives their seat to someone as due; when neither is possible, the locked player plays this turn without their
 * partner. Complete pairs come first in the result, so positions 0-1 are a team. Without locks this is the first four. */
export function pickFour(order:readonly string[],partner:ReadonlyMap<string,string>,swappable:(out:string,incoming:string)=>boolean=()=>false):string[]|undefined{
 if(order.length<4)return undefined;
 const four=order.slice(0,4),complete=(id:string)=>{const other=partner.get(id);return other!==undefined&&four.includes(other)};
 for(const id of order.slice(0,4)){
  const other=partner.get(id);
  if(other===undefined||!four.includes(id)||four.includes(other)||!order.includes(other))continue;
  // Bring the partner in for the least due player who is not half of a complete pair.
  const out=[...four].reverse().find(x=>x!==id&&!complete(x)&&swappable(x,other));
  if(out){four[four.indexOf(out)]=other;continue}
  // Or let the next player as due take this seat; a player whose own partner is waiting is not pulled in alone.
  const next=order.slice(4).find(x=>!four.includes(x)&&x!==other&&!(partner.has(x)&&order.includes(partner.get(x)!))&&swappable(id,x));
  if(next)four[four.indexOf(id)]=next;
 }
 const pairs=order.filter(id=>four.includes(id)&&complete(id)),rest=four.filter(id=>!complete(id));
 const ordered:string[]=[];for(const id of pairs)if(!ordered.includes(id))ordered.push(id,partner.get(id)!);
 return [...ordered,...rest];
}

/** The team splits of four players that keep their locked pairs; undefined when no complete locked pair is among them. */
export function lockSplits(ids:readonly string[],partner:ReadonlyMap<string,string>){
 if(!ids.some(id=>{const other=partner.get(id);return other!==undefined&&ids.includes(other)}))return undefined;
 const [a,b,c,d]=ids;
 return [[[a,b],[c,d]],[[a,c],[b,d]],[[a,d],[b,c]]].filter(split=>keepsLocks(split.flat(),partner));
}
