import {z} from 'zod';
import {canManageEvent,isMatchReferee} from './permissions';
import {finishedGame,scoringCap,type ScoringRule} from './tournament';
import type {Account,Event} from './types';

/** Live referee scoring of a competition match (docs/LIVE_SCORING.md). The referee's phone sends one operation per tap
 * to a light endpoint; the state is a log of points and cards from which games and the winner are derived, so an undo
 * or a late correction never leaves a stored total out of step. The final games are then saved once as an ordinary
 * score, which updates standings, rankings and 修为. */
export type Side='a'|'b';
export type CardKind='warning'|'yellow'|'red'|'black';
export type LiveEvent={type:'point';side:Side;at:number}|{type:'card';side:Side;kind:CardKind;playerId?:string;at:number};
export type LiveScore={matchId:string;eventId:string;status:'ready'|'playing'|'paused'|'finished';startedAt?:number;pausedAt?:number;pausedMs:number;swapped:boolean;events:LiveEvent[];version:number;updatedAt:number};

/** Badminton misconduct cards, with what each one does here. Only red and black change the score. */
export const cardRules:Record<CardKind,{label:string;effect:string;detail:string}>={
 warning:{label:'警告',effect:'口头警告，不影响比分',detail:'用于轻微失当行为，例如拖延时间、未经允许离场、对裁判或对手不礼貌的言语。提醒选手注意，比分不变。'},
 yellow:{label:'黄牌',effect:'正式警告，不影响比分',detail:'第一次正式警告。适用于故意拖延、干扰对方、故意损坏球或球拍、不当行为等。同一场比赛再次违规应出示红牌。'},
 red:{label:'红牌',effect:'对方得 1 分',detail:'已有警告后再次违规，或严重的不当行为。被判罚一方的对手直接得 1 分，比分自动加上。'},
 black:{label:'黑牌',effect:'取消资格，本场判负',detail:'严重或屡次违规，例如暴力、辱骂、拒不服从裁判。被判罚一方取消本场比赛资格，对方直接获胜，比赛结束。'},
};

export type LiveTally={games:{a:number;b:number}[];current:{a:number;b:number};wins:{a:number;b:number};winner?:Side;disqualified?:Side;
 /** Prompts for the referee: the interval at 11 in a game to 21, and changing ends at 11 in the deciding game. */interval:boolean;changeEnds:boolean;
 /** Every interval so far: when a side first reached the midpoint (11 of 21) in a game. Each one is a 60-second break
  * and the players change ends, so the sides on the referee page and the board swap with it. */breaks:{game:number;at:number}[]};
/** How long the break at the midpoint of a game lasts. */
export const breakMs=60000;
/** The break running now, if any: the latest midpoint within the last 60 seconds of an unfinished match. */
export function currentBreak(t:LiveTally,now:number){const last=t.breaks.at(-1);return !t.winner&&last&&now<last.at+breakMs?{...last,until:last.at+breakMs}:null}
/** Whether the display is mirrored: a referee's own change (legacy) and each midpoint break swap the ends. */
export const sidesSwapped=(s:Pick<LiveScore,'swapped'>|undefined,t:LiveTally)=>!!s?.swapped!==(t.breaks.length%2===1);
const other=(side:Side):Side=>side==='a'?'b':'a';

/** Replays the log under the rule: a game ends once it is finished (finishedGame), the match once a side has won the
 * majority of games, or at a black card. Points after the end are ignored. */
export function liveTally(rule:ScoringRule,events:LiveEvent[]):LiveTally{
 const games:{a:number;b:number}[]=[],wins={a:0,b:0},need=Math.ceil(rule.games/2),mid=Math.ceil(rule.points/2),breaks:{game:number;at:number}[]=[];let current={a:0,b:0},winner:Side|undefined,disqualified:Side|undefined,last:Side|undefined;
 for(const e of events){
  if(winner)break;
  if(e.type==='card'&&e.kind==='black'){disqualified=e.side;winner=other(e.side);break}
  const side=e.type==='point'?e.side:e.kind==='red'?other(e.side):null;if(!side)continue;
  current={...current,[side]:current[side]+1};last=side;
  if(current[side]===mid&&current[other(side)]<mid&&!finishedGame(rule,current.a,current.b))breaks.push({game:games.length,at:e.at});
  if(finishedGame(rule,current.a,current.b)){games.push(current);wins[side]++;current={a:0,b:0};if(wins[side]>=need)winner=side}
 }
 const deciding=rule.games===3&&games.length===2;
 const reached=!winner&&!!last&&Math.max(current.a,current.b)===mid&&current[last]===mid&&Math.min(current.a,current.b)<mid;
 return {games,current,wins,winner,disqualified,interval:reached&&rule.points===21,changeEnds:reached&&deciding,breaks};
}
/** The games to save when the match ends. After a black card the opponent is recorded as winning the unfinished game
 * with the fewest points that finish it, and any further games it still needed 21:0 (or 15:0, 11:0), so the saved
 * result is a valid match under the rule. */
export function finalGames(rule:ScoringRule,t:LiveTally){
 if(!t.disqualified)return t.games;
 const w=other(t.disqualified),l=t.disqualified,games=[...t.games],wins={...t.wins},need=Math.ceil(rule.games/2);
 const game=(winner:number,loser:number)=>({[w]:winner,[l]:loser}) as {a:number;b:number};
 if(t.current.a||t.current.b){const lost=t.current[l],won=lost<=rule.points-2?rule.points:Math.min(lost+2,scoringCap(rule));games.push(game(won,won===scoringCap(rule)?Math.min(lost,won-1):lost));wins[w]++}
 while(wins[w]<need){games.push(game(rule.points,0));wins[w]++}
 return games;
}

/** A walkover: the side that did not withdraw wins every game it needs 21:0 (15:0, 11:0), a valid result under the
 * rule, so standings and the bracket move on as for any score. */
export function walkoverGames(rule:ScoringRule,winner:Side){const loser=other(winner);return Array.from({length:Math.ceil(rule.games/2)},()=>({[winner]:rule.points,[loser]:0}) as {a:number;b:number})}

/** Playing time: from the start, without pauses. */
export function liveElapsed(s:Pick<LiveScore,'startedAt'|'pausedAt'|'pausedMs'>,now:number){
 if(!s.startedAt)return 0;return Math.max(0,(s.pausedAt??now)-s.startedAt-s.pausedMs);
}

export const liveOpInput=z.discriminatedUnion('op',[
 z.object({op:z.enum(['start','pause','resume','swap','uncard']),matchId:z.string().min(1).max(100)}).strict(),
 z.object({op:z.enum(['point','undo']),matchId:z.string().min(1).max(100),side:z.enum(['a','b'])}).strict(),
 z.object({op:z.literal('card'),matchId:z.string().min(1).max(100),side:z.enum(['a','b']),kind:z.enum(['warning','yellow','red','black']),playerId:z.string().min(1).max(100).optional()}).strict(),
]);
export type LiveOp=z.infer<typeof liveOpInput>;
/** An operation as the referee page builds it, before the match id is added. */
export type LiveOpBody=LiveOp extends infer T?T extends LiveOp?Omit<T,'matchId'>:never:never;

/** The owner and administrators, the competition's creator, and the referee assigned to the fixture. */
export function canRefereeMatch(a:Pick<Account,'id'|'role'|'playerId'>,e:Event,matchId:string){return canManageEvent(a,e)||isMatchReferee(a,e,matchId)}

/** Applies one referee operation; returns the new state or throws a message for the referee. */
export function applyLiveOp(prior:LiveScore|null,op:LiveOp,rule:ScoringRule,base:{matchId:string;eventId:string},now:number):LiveScore{
 const s:LiveScore=prior?structuredClone(prior):{...base,status:'ready',pausedMs:0,swapped:false,events:[],version:0,updatedAt:now};
 const tally=()=>liveTally(rule,s.events),settle=()=>{if(tally().winner){s.status='finished';if(s.pausedAt===undefined)s.pausedAt=now}};
 switch(op.op){
  case 'start':if(s.status!=='ready')throw new Error('比赛已经开始');s.status='playing';s.startedAt=now;break;
  case 'pause':if(s.status!=='playing')throw new Error('比赛没有在进行');s.status='paused';s.pausedAt=now;break;
  case 'resume':if(s.status!=='paused')throw new Error('比赛没有暂停');s.pausedMs+=now-(s.pausedAt??now);delete s.pausedAt;s.status='playing';break;
  case 'swap':s.swapped=!s.swapped;break;
  case 'point':if(s.status!=='playing')throw new Error(s.status==='ready'?'请先点“开始比赛”':s.status==='paused'?'比赛暂停中，请先继续':'比赛已经结束');s.events.push({type:'point',side:op.side,at:now});settle();break;
  case 'card':if(s.status==='ready'||s.status==='finished')throw new Error('只能在比赛进行或暂停时判罚');s.events.push({type:'card',side:op.side,kind:op.kind,...(op.playerId?{playerId:op.playerId}:{}),at:now});settle();break;
  case 'undo':case 'uncard':{
   // undo: the last point this side scored, including one from a red card against the other side. uncard: the last card.
   const side=op.op==='undo'?op.side:null,index=s.events.findLastIndex(e=>!side?e.type==='card':e.type==='point'?e.side===side:e.kind==='red'&&other(e.side)===side);
   if(index<0)throw new Error(op.op==='uncard'?'没有可撤销的判罚':'这一方没有可撤销的得分');
   s.events.splice(index,1);
   if(s.status==='finished'&&!tally().winner){s.status='playing';if(s.pausedAt!==undefined){s.pausedMs+=now-s.pausedAt;delete s.pausedAt}}
   break;
  }
 }
 s.version++;s.updatedAt=now;return s;
}
