import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {isClubOwner} from './ownership';
import {fail,type Account,type State} from './types';

/** Hidden pairing odds for one future activity, set by the owner and administrators (docs/PAIRING_ODDS.md).
 * defaults: when one of `players` and one of `targets` share a court, they are partners with `percent` chance.
 * conditions: when both of `pair` share a court and one or two of `members` are the other two players, `pair` are
 * partners with `one` or `two` percent chance. A condition takes precedence over the defaults for the same two. */
export type PairingDefault={players:string[];targets:string[];percent:number};
export type PairingCondition={pair:[string,string];members:string[];one:number;two:number};
export type PairingOdds={eventId:string;defaults:PairingDefault[];conditions:PairingCondition[]};

const id=z.string().min(1).max(100),ids=z.array(id).min(1).max(60),percent=z.number().int().min(0).max(100);
const schemas={pairingOdds:z.object({eventId:id,
 defaults:z.array(z.object({players:ids,targets:ids,percent})).max(30),
 conditions:z.array(z.object({pair:z.tuple([id,id]),members:ids,one:percent,two:percent})).max(30)})};

export function eventPairingOdds(s:Pick<State,'settings'>,eventId:string){return s.settings.pairingOdds?.find(o=>o.eventId===eventId)}

/** Only the owner and administrators receive the odds, and only for activities that have not ended. */
export function pairingOddsView(s:State,a:Account,now:number){
 if(a.role!=='admin'&&!isClubOwner(s,a))return undefined;
 const open=new Set(s.events.filter(e=>e.deletedAt===undefined&&e.end>now&&!['ended','cancelled'].includes(e.status)).map(e=>e.id));
 const list=(s.settings.pairingOdds??[]).filter(o=>open.has(o.eventId));
 return list.length?list:undefined;
}

export function applyPairingOdds(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 if(a.role!=='admin'&&!isClubOwner(s,a))fail('403: 仅管理员可以执行此操作');
 const p=command.payload,e=s.events.find(x=>x.id===p.eventId&&x.deletedAt===undefined)??fail('活动不存在或已删除');
 if(e.end<=now||['ended','cancelled'].includes(e.status))fail('活动已结束');
 const known=new Set(s.players.map(x=>x.id)),check=(list:string[])=>{if(list.some(x=>!known.has(x)))fail('球友不存在')};
 const unique=(list:string[])=>[...new Set(list)];
 const defaults=p.defaults.map(d=>({players:unique(d.players),targets:unique(d.targets),percent:d.percent}));
 const conditions=p.conditions.map(c=>({pair:c.pair,members:unique(c.members),one:c.one,two:c.two}));
 for(const d of defaults){check(d.players);check(d.targets)}
 for(const c of conditions){check(c.pair);check(c.members);if(c.pair[0]===c.pair[1])fail('请选择两位不同的球友');if(c.members.some(x=>c.pair.includes(x)))fail('条件成员不能是选定的两人')}
 // Entries of activities that are over no longer matter.
 const open=new Set(s.events.filter(x=>x.deletedAt===undefined&&x.end>now).map(x=>x.id));
 const rest=(s.settings.pairingOdds??[]).filter(o=>o.eventId!==e.id&&open.has(o.eventId));
 const next=defaults.length||conditions.length?[...rest,{eventId:e.id,defaults,conditions}]:rest;
 if(next.length)s.settings.pairingOdds=next;else delete s.settings.pairingOdds;
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'更新临时排场',changes:{eventId:e.id}});
 return true;
}

type Wish={x:string;y:string;percent:number};
/** The odds that apply to two players of these four, strongest rule first. */
export function courtWishes(odds:PairingOdds|undefined,four:string[]){
 const wishes:Wish[]=[],seen=new Set<string>();
 if(!odds)return wishes;
 const add=(x:string,y:string,percent:number)=>{const key=x<y?x+'|'+y:y+'|'+x;if(x===y||seen.has(key)||!four.includes(x)||!four.includes(y))return;seen.add(key);wishes.push({x,y,percent})};
 for(const c of odds.conditions){
  const [x,y]=c.pair;if(!four.includes(x)||!four.includes(y))continue;
  const count=four.filter(v=>v!==x&&v!==y&&c.members.includes(v)).length;
  if(count)add(x,y,count===2?c.two:c.one);
 }
 for(const d of odds.defaults)for(const x of d.players)for(const y of d.targets)add(x,y,d.percent);
 return wishes;
}

/** The ways these four may split into two teams once the odds are drawn: each rule in turn keeps the splits where the
 * two are partners (with its chance) or opponents, unless no split is left. With no rule all three splits remain. */
export function oddsSplits(odds:PairingOdds|undefined,four:string[],rand:()=>number){
 const [a,b,c,d]=four;
 let splits=[[[a,b],[c,d]],[[a,c],[b,d]],[[a,d],[b,c]]];
 for(const w of courtWishes(odds,four)){
  const together=rand()*100<w.percent;
  const next=splits.filter(split=>split.some(team=>team.includes(w.x)&&team.includes(w.y))===together);
  if(next.length)splits=next;
 }
 return splits;
}

/** A random stream for the draws, apart from the seeded lineup search so that search is unchanged. */
export function oddsRandom(seed:number){
 // Mix the seed first: neighbouring seeds (one per planned round) must not give neighbouring draws.
 let rng=seed>>>0;rng=Math.imul(rng^rng>>>16,0x85ebca6b);rng=Math.imul(rng^rng>>>13,0xc2b2ae35);rng=(rng^rng>>>16)>>>0;
 return ()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296}}
