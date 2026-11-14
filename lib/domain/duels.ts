import {z} from 'zod';
import {eventRankingEnabled} from './event-ranking';
import {eventFormat,isPractice} from './match-format';
import {isGuest} from './guests';
import {fail,month,type Account,type Event,type Match,type State} from './types';

/** 天机战帖 (docs/DUELS.md): before a doubles points match starts, a member challenges two named players with their own
 * partner, "甲乙 对 丙丁", for the same number of season points each. It holds once all four accept before the start.
 * The schedule then brings the four on court together, within the usual fair-turn margin, and the first game between the
 * two teams settles it: each loser gives the stake and each winner gets it. A forfeited game, or no such game by the end,
 * moves no points. */
export type Duel={id:string;a:[string,string];b:[string,string];stake:number;by:string;accepted:string[];at:number;declinedBy?:string;withdrawn?:true};
export type DuelState='pending'|'expired'|'declined'|'withdrawn'|'locked'|'void'|'won-a'|'won-b';
export const duelMaxStake=20;

const same=(x:readonly string[],y:readonly string[])=>x.length===y.length&&[...x].sort().join()===[...y].sort().join();
const players=(d:Pick<Duel,'a'|'b'>)=>[...d.a,...d.b];
/** A game between the duel's two teams, on either side. */
export const duelGame=(d:Pick<Duel,'a'|'b'>,m:Pick<Match,'a'|'b'>)=>(same(d.a,m.a)&&same(d.b,m.b))||(same(d.a,m.b)&&same(d.b,m.a));
const accepted=(d:Duel)=>players(d).every(id=>d.accepted.includes(id));
/** The duel's game: the first one between its teams in the activity (drafts and published games included, so a plan that
 * already has it does not place it again). */
export function duelGameOf(d:Duel,e:Pick<Event,'id'>,matches:readonly Match[]){
 return matches.filter(m=>m.eventId===e.id&&m.status!=='cancelled'&&duelGame(d,m)).sort((x,y)=>(x.start??Infinity)-(y.start??Infinity))[0];
}
/** The side that won a scored game: more games won, or the higher score of a one-game match (as lib/domain/social.ts). */
const winner=(m:Match)=>m.games?.length>1?(m.games.filter(g=>g.a>g.b).length>m.games.filter(g=>g.b>g.a).length?'a':'b'):(m.scoreA!>m.scoreB!?'a':'b');

/** Where a duel stands, from the activity's games as they are now. */
export function duelState(d:Duel,e:Pick<Event,'id'|'start'|'end'>,matches:readonly Match[],now:number):DuelState{
 if(d.withdrawn)return 'withdrawn';
 if(d.declinedBy)return 'declined';
 if(!accepted(d))return now<e.start?'pending':'expired';
 const m=duelGameOf(d,e,matches);
 if(m?.status==='complete'&&(m.scoreA!==null||m.games?.length)){const side=winner(m);return (side==='a')===same(d.a,m.a)?'won-a':'won-b'}
 if(m&&(m.status==='forfeit'||m.noShow?.length))return 'void';
 return now>=e.end&&!m?.start?'void':'locked';
}
/** Accepted duels whose game is not on the schedule yet: the ones the schedule should still bring together. */
export function pendingDuels(s:Pick<State,'matches'>,e:Event):Duel[]{
 return (e.duels??[]).filter(d=>!d.withdrawn&&!d.declinedBy&&accepted(d)&&!duelGameOf(d,e,s.matches));
}
/** Pending duels the schedule may arrange: not in an arena (the court keeps its holders), not with fixed partners (the
 * confirmed teams play), and agreeing with every 锁组 of their players. */
export function schedulableDuels(s:Pick<State,'matches'>,e:Event,partner:ReadonlyMap<string,string>){
 if(e.playMode==='arena'||e.pointsChoice?.selectedMode==='fixed'||eventFormat(e)!=='doubles')return [];
 const agrees=([x,y]:readonly [string,string])=>(!partner.has(x)||partner.get(x)===y)&&(!partner.has(y)||partner.get(y)===x);
 return pendingDuels(s,e).filter(d=>agrees(d.a)&&agrees(d.b));
}
/** The four from a fair queue, made into a pending duel when one of its players is among them and the others can take the
 * places of players as due (`swappable(out,incoming)`, the same margin as 锁组). Teams in order: positions 0-1 against
 * 2-3. Undefined when no duel can be formed; the queue is then used as it is. */
export function duelFour(order:readonly string[],four:readonly string[],duels:readonly Duel[],swappable:(out:string,incoming:string)=>boolean):string[]|undefined{
 const available=new Set(order);
 for(const d of [...duels].sort((x,y)=>players(y).filter(id=>four.includes(id)).length-players(x).filter(id=>four.includes(id)).length)){
  const ids=players(d);if(!ids.some(id=>four.includes(id))||!ids.every(id=>available.has(id)))continue;
  const outs=[...four].reverse().filter(id=>!ids.includes(id)),incoming=ids.filter(id=>!four.includes(id)),used=new Set<string>();
  if(incoming.every(id=>{const out=outs.find(x=>!used.has(x)&&swappable(x,id));if(out)used.add(out);return !!out}))return [...d.a,...d.b];
 }
 return undefined;
}
/** Season point changes of settled duels: the stake from each loser to each winner, in the month of the game. */
export function duelPointAdjustments(s:Pick<State,'events'|'matches'>,now:number){
 return s.events.flatMap(e=>(e.duels??[]).flatMap(d=>{
  const state=duelState(d,e,s.matches,now);if(state!=='won-a'&&state!=='won-b')return [];
  const m=duelGameOf(d,e,s.matches)!,period=month(m.start??e.start),[won,lost]=state==='won-a'?[d.a,d.b]:[d.b,d.a];
  return [...won.map(playerId=>({playerId,eventId:e.id,period,format:'doubles' as const,delta:d.stake})),...lost.map(playerId=>({playerId,eventId:e.id,period,format:'doubles' as const,delta:-d.stake}))];
 }));
}
/** A doubles points match that has not started: the only kind a duel can be sent for. */
export function duelEvent(e:Event,now:number){
 return eventRankingEnabled(e)&&!e.tournament&&!isPractice(e)&&e.deletedAt===undefined&&!['draft','cancelled','ended'].includes(e.status)&&eventFormat(e)==='doubles'&&now<e.start;
}

const id=z.string().min(1).max(100),reason=z.string().trim().max(500).optional();
// Forms always send a reason (the dialog title when left empty); it only labels the audit.
const schemas={
 duelCreate:z.object({eventId:id,partner:id,opponents:z.tuple([id,id]),stake:z.number().int().min(1).max(duelMaxStake),reason}).strict(),
 duelRespond:z.object({eventId:id,duelId:id,accept:z.boolean(),reason}).strict(),
 duelWithdraw:z.object({eventId:id,duelId:id,reason}).strict(),
};
export const duelActions=Object.keys(schemas);
/** Command entry: true when the action was a duel command. Only the four act, each for their own player, and only before
 * the activity starts. */
export function applyDuels(s:State,a:Account,action:string,input:unknown,now:number){
 if(!(action in schemas))return false;
 const p=schemas[action as keyof typeof schemas].parse(input) as {eventId:string;partner?:string;opponents?:[string,string];stake?:number;duelId?:string;accept?:boolean};
 const e=s.events.find(e=>e.id===p.eventId)??fail('活动不存在');
 if(!duelEvent(e,now))fail('天机战帖只能在积分赛双打活动开始前下、应战或撤回');
 const me=a.playerId;
 if(action==='duelCreate'){
  const four=[me,p.partner!,...p.opponents!];
  if(new Set(four).size!==4)fail('请选四位不同的道友：自己、搭档和两位对手');
  const confirmed=(id:string)=>s.registrations.some(r=>r.eventId===e.id&&r.playerId===id&&r.status==='confirmed');
  if(!four.every(id=>confirmed(id)&&!isGuest(s,id)&&s.accounts.some(x=>x.playerId===id)))fail('四位都要是本活动已正式接龙的道友（来宾没有积分）');
  const busy=new Set((e.duels??[]).filter(d=>['pending','locked'].includes(duelState(d,e,s.matches,now))).flatMap(players));
  if(four.some(id=>busy.has(id)))fail('其中有道友已经有一张未了结的天机战帖了');
  const locked=new Map((e.lockedPairs??[]).flatMap(([x,y])=>[[x,y],[y,x]] as [string,string][]));
  const teams:[string,string][]=[[me,p.partner!],[p.opponents![0],p.opponents![1]]];
  if(teams.some(([x,y])=>(locked.has(x)&&locked.get(x)!==y)||(locked.has(y)&&locked.get(y)!==x)))fail('有道友被锁组和别人锁在一起了，战帖的队伍要和锁组一致');
  (e.duels??=[]).push({id:crypto.randomUUID(),a:teams[0],b:teams[1],stake:p.stake!,by:me,accepted:[me],at:now});
 }else{
  const d=(e.duels??[]).find(x=>x.id===p.duelId)??fail('天机战帖不存在');
  if(!players(d).includes(me))fail('403: 只有战帖上的四位道友可以回应');
  if(duelState(d,e,s.matches,now)!=='pending')fail('这张天机战帖已经成立、作废或过期，不能再更改');
  if(action==='duelWithdraw'){if(d.by!==me)fail('403: 只有下战帖的道友可以撤回');d.withdrawn=true}
  else if(p.accept){if(!d.accepted.includes(me))d.accepted.push(me)}
  else d.declinedBy=me;
 }
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'天机战帖',changes:{eventId:p.eventId,...(p.duelId?{duelId:p.duelId}:{}),...(p.stake!==undefined?{stake:p.stake,partner:p.partner,opponents:p.opponents}:{}),...(p.accept!==undefined?{accept:p.accept}:{})}});
 return true;
}
