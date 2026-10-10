import {canRecordScore} from '../domain/permissions';
import type {Account,Player,State,Match} from '../domain/types';

export type ScoreReminderData=Pick<State,'events'|'rounds'|'matches'|'registrations'> & {me:Account;players:Pick<Player,'id'|'enabled'>[]};
/** Only the signed-in account's own on-court games can request score entry. */
export function pendingOwnScores(data:ScoreReminderData,now=Date.now()):Match[]{
 if(!data.me||!data.players.some(p=>p.id===data.me.playerId&&p.enabled))return [];
 const events=new Map(data.events.map(e=>[e.id,e])),rounds=new Map(data.rounds.map(r=>[r.id,r]));
 return data.matches.filter(m=>{
  const e=events.get(m.eventId),r=rounds.get(m.roundId);
  return m.status==='playing'&&m.start!==null&&Number.isFinite(m.start)&&m.start>=0&&m.start<=now&&
   [...m.a,...m.b].includes(data.me.playerId)&&!!e&&!!r&&r.eventId===e.id&&r.status==='playing'&&
   e.deletedAt===undefined&&!['draft','cancelled'].includes(e.status)&&canRecordScore(data,data.me,e);
 }).sort((a,b)=>b.start!-a.start!||a.id.localeCompare(b.id));
}

/** Window event asking the score reminder to open the form for one pending game (detail: match id). */
export const scoreEntryRequest='yulin:score-entry';
export function requestScoreEntry(matchId:string){window.dispatchEvent(new CustomEvent(scoreEntryRequest,{detail:matchId}))}

/** A visit is consumed even when it has no pending games. Polling or the next
 * live assignment must not produce another popup in the middle of a game. */
export function createScorePromptGate(owner:string){
 let visit=0,ready=false,handled=false;
 return {
  begin(){ready=false;handled=false;return ++visit},
  ready(token:number,accountId:string){if(token===visit&&accountId===owner)ready=true},
  suppress(){handled=true},
  next(accountId:string,ids:string[],blocked:boolean){
   if(accountId!==owner||!ready||handled||blocked)return null;
   handled=true;return ids[0]??null;
  },
 };
}

export type ScoreDraft={a:number|'';b:number|''};
export function initialScoreDrafts(m:Pick<Match,'games'>):ScoreDraft[]{return [0,1,2].map(i=>m.games[i]?{...m.games[i]}:{a:'',b:''})}
export function scoreEntryPayload(m:Pick<Match,'id'|'status'|'end'>,drafts:ScoreDraft[],count:number,reason:string){
 if(!Number.isInteger(count)||count<1||count>3||drafts.length<count)throw new Error('比赛局数无效');
 const games=drafts.slice(0,count).map(g=>{
  if(g.a===''||g.b===''||!Number.isInteger(g.a)||!Number.isInteger(g.b)||g.a<0||g.b<0)throw new Error('请填写双方实际比分');
  return {a:g.a,b:g.b};
 });
 return {matchId:m.id,a:games[0].a,b:games[0].b,games,reason,...(m.status==='complete'&&m.end!==null?{end:m.end}:{})};
}
