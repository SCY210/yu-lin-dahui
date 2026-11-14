import {z} from 'zod';
import {eventRankingEnabled} from './event-ranking';
import {eventFormat,isPractice} from './match-format';
import {gameFacts} from './game-facts';
import {isGuest} from './guests';
import {fail,month,type Account,type Event,type Match,type State} from './types';

/** 趣味赛 (docs/FUN_BETS.md): the four players of a doubles game in a points match stake the same number of season points
 * on it. Any of the four proposes before the game starts; it holds only once all four accept. When the game is scored,
 * each loser gives the stake and each winner gets it; a cancelled, forfeited or changed game, or a missing acceptance,
 * moves no points. */
export type FunBet={id:string;matchId:string;a:string[];b:string[];stake:number;by:string;accepted:string[];at:number;declinedBy?:string;withdrawn?:true};
export type FunBetState='pending'|'locked'|'expired'|'declined'|'withdrawn'|'void'|'won-a'|'won-b';
export const funBetMaxStake=20;
/** A playing game stays open to a proposal and its answers for this long after it starts, with no score yet: live play
 * starts a game when someone presses 开始组队, before the four have stepped on court. */
export const funBetGraceMinutes=5;

/** The side that won the game: more games won, or the higher score of a one-game match (as lib/domain/social.ts). */
const winner=(m:Match)=>m.games?.length>1?(m.games.filter(g=>g.a>g.b).length>m.games.filter(g=>g.b>g.a).length?'a':'b'):(m.scoreA!>m.scoreB!?'a':'b');
const same=(x:string[],y:string[])=>x.length===y.length&&[...x].sort().join()===[...y].sort().join();
/** The game still has the four it was proposed for, on the same sides. */
const lineupKept=(bet:Pick<FunBet,'a'|'b'>,m:Match)=>same(bet.a,m.a)&&same(bet.b,m.b);
/** Whether a game can still take a proposal or an answer: not started, or just started and not scored. */
export function funBetOpen(m:Match,now:number){
 if(m.status==='published')return true;
 return m.status==='playing'&&m.start!==null&&now<m.start+funBetGraceMinutes*60000&&m.scoreA===null&&m.scoreB===null&&!m.games?.length;
}
/** A doubles game of a points match whose four are all members (friends have no points). `member` says who is one: the
 * server knows the accounts, a member's browser only each player's guest flag. */
export function funBetEligible(e:Event,m:Match,member:(playerId:string)=>boolean){
 if(!eventRankingEnabled(e)||e.tournament||isPractice(e)||e.deletedAt!==undefined||['draft','cancelled'].includes(e.status))return false;
 if(eventFormat(e)!=='doubles'||m.a.length!==2||m.b.length!==2)return false;
 return [...m.a,...m.b].every(member);
}
/** Where a proposal stands, from the game as it is now. */
export function funBetState(bet:FunBet,m:Match|undefined,now:number):FunBetState{
 if(bet.withdrawn)return 'withdrawn';
 if(bet.declinedBy)return 'declined';
 if(!m||!lineupKept(bet,m)||['cancelled','forfeit'].includes(m.status)||m.noShow?.length)return 'void';
 const all=[...bet.a,...bet.b].every(id=>bet.accepted.includes(id));
 if(!all)return funBetOpen(m,now)?'pending':'expired';
 if(m.status==='complete'&&gameFacts(m).length)return winner(m)==='a'?'won-a':'won-b';
 return 'locked';
}
/** Season point changes of settled 趣味赛: the stake from each loser to each winner, in the month the game started. */
export function funBetPointAdjustments(s:Pick<State,'events'|'matches'>,now:number){
 const matches=new Map(s.matches.map(m=>[m.id,m]));
 return s.events.flatMap(e=>(e.funBets??[]).flatMap(bet=>{
  const m=matches.get(bet.matchId),state=funBetState(bet,m,now);
  if(!m||m.start===null||(state!=='won-a'&&state!=='won-b'))return [];
  const [won,lost]=state==='won-a'?[bet.a,bet.b]:[bet.b,bet.a],period=month(m.start);
  return [...won.map(playerId=>({playerId,eventId:e.id,period,format:'doubles' as const,delta:bet.stake})),...lost.map(playerId=>({playerId,eventId:e.id,period,format:'doubles' as const,delta:-bet.stake}))];
 }));
}

const id=z.string().min(1).max(100),reason=z.string().trim().max(500).optional();
// Forms always send a reason (the dialog title when left empty); it only labels the audit.
const schemas={
 funBetCreate:z.object({eventId:id,matchId:id,stake:z.number().int().min(1).max(funBetMaxStake),reason}).strict(),
 funBetRespond:z.object({eventId:id,betId:id,accept:z.boolean(),reason}).strict(),
 funBetWithdraw:z.object({eventId:id,betId:id,reason}).strict(),
};
export const funBetActions=Object.keys(schemas);
/** Command entry: true when the action was a 趣味赛 command. Only the four players themselves act, each for their own
 * player; nobody accepts or declines for someone else. */
export function applyFunBets(s:State,a:Account,action:string,input:unknown,now:number){
 if(!(action in schemas))return false;
 const p=schemas[action as keyof typeof schemas].parse(input) as {eventId:string;matchId?:string;betId?:string;stake?:number;accept?:boolean};
 const e=s.events.find(e=>e.id===p.eventId)??fail('活动不存在');
 const me=a.playerId;
 if(action==='funBetCreate'){
  const m=s.matches.find(m=>m.id===p.matchId&&m.eventId===e.id)??fail('对局不存在');
  if(![...m.a,...m.b].includes(me))fail('403: 只有这局的四位球友可以发起趣味赛');
  if(!funBetEligible(e,m,id=>!isGuest(s,id)&&s.accounts.some(a=>a.playerId===id)))fail('只有积分赛里四位都是正式成员的双打对局可以发起趣味赛');
  if(!funBetOpen(m,now))fail('这局已经开打，不能再发起趣味赛');
  if((e.funBets??[]).some(b=>b.matchId===m.id&&['pending','locked'].includes(funBetState(b,m,now))))fail('这局已经有趣味赛了');
  (e.funBets??=[]).push({id:crypto.randomUUID(),matchId:m.id,a:[...m.a],b:[...m.b],stake:p.stake!,by:me,accepted:[me],at:now});
 }else{
  const bet=(e.funBets??[]).find(b=>b.id===p.betId)??fail('趣味赛不存在');
  const m=s.matches.find(m=>m.id===bet.matchId);
  if(![...bet.a,...bet.b].includes(me))fail('403: 只有这局的四位球友可以回应趣味赛');
  if(funBetState(bet,m,now)!=='pending')fail('这场趣味赛已经成立、作废或过期，不能再更改');
  if(action==='funBetWithdraw'){if(bet.by!==me)fail('403: 只有发起人可以撤回');bet.withdrawn=true}
  else if(p.accept){if(!bet.accepted.includes(me))bet.accepted.push(me)}
  else bet.declinedBy=me;
 }
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'趣味赛',changes:{eventId:p.eventId,...(p.matchId?{matchId:p.matchId}:{}),...(p.betId?{betId:p.betId}:{}),...(p.stake!==undefined?{stake:p.stake}:{}),...(p.accept!==undefined?{accept:p.accept}:{})}});
 return true;
}
