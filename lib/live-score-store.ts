import {raw} from './store';
import {applyLiveOp,canRefereeMatch,type LiveOp,type LiveScore} from './domain/live-score';
import {defaultScoring} from './domain/tournament';
import {eventStatusAt} from './domain/event-lifecycle';
import type {Account,Event,Match} from './domain/types';

/** Live scores live in their own table (docs/LIVE_SCORING.md): a tap reads and writes one row plus the match and its
 * activity, never the whole club, so scoring a busy competition stays within the Worker CPU budget. */
export async function liveScores(eventId:string){
 const rows=(await raw().prepare('SELECT payload FROM live_scores WHERE event_id=?').bind(eventId).all<{payload:string}>()).results;
 return rows.map(row=>JSON.parse(row.payload) as LiveScore);
}

export class LiveScoreError extends Error{constructor(message:string,readonly status=400){super(message)}}

/** One referee operation. Concurrent taps from two devices retry against the latest row, so none is lost. */
export async function applyLiveScore(account:Pick<Account,'id'|'role'|'playerId'>,op:LiveOp,now=Date.now()){
 const db=raw();
 for(let attempt=0;attempt<8;attempt++){
  if(attempt)await new Promise(resolve=>setTimeout(resolve,Math.random()*20*attempt));
  const [matchRow,liveRow]=await db.batch<{payload:string;version?:number}>([
   db.prepare('SELECT payload FROM matches WHERE id=?').bind(op.matchId),
   db.prepare('SELECT payload,version FROM live_scores WHERE match_id=?').bind(op.matchId),
  ]);
  const match=matchRow.results[0]?JSON.parse(matchRow.results[0].payload) as Match:null;
  if(!match)throw new LiveScoreError('比赛不存在',404);
  const eventRow=await db.prepare('SELECT payload FROM events WHERE id=?').bind(match.eventId).first<{payload:string}>();
  const event=eventRow?JSON.parse(eventRow.payload) as Event:null;
  if(!event?.tournament||event.deletedAt!==undefined||!event.tournament.fixtures.some(f=>f.matchId===match.id))throw new LiveScoreError('这场比赛不属于比赛对战表',404);
  if(!canRefereeMatch(account,event,match.id))throw new LiveScoreError('只有指定裁判、比赛创建者、群主和管理员可以记分',403);
  if(['cancelled','draft'].includes(eventStatusAt(event,now)))throw new LiveScoreError('比赛未开放或已取消',409);
  const prior=liveRow.results[0]?JSON.parse(liveRow.results[0].payload) as LiveScore:null;
  if(!prior&&match.status!=='playing')throw new LiveScoreError('请先在对战表中安排开赛',409);
  if(match.status==='complete'&&op.op!=='swap')throw new LiveScoreError('比分已经提交，如需修改请在对战表中修正比分',409);
  let next:LiveScore;
  try{next=applyLiveOp(prior,op,event.tournament.scoring??defaultScoring,{matchId:match.id,eventId:event.id},now)}catch(error){throw new LiveScoreError(error instanceof Error?error.message:'操作无效',409)}
  const write=prior
   ?await db.prepare('UPDATE live_scores SET payload=?,version=?,updated_at=? WHERE match_id=? AND version=?').bind(JSON.stringify(next),next.version,now,match.id,prior.version).run()
   :await db.prepare('INSERT INTO live_scores(match_id,event_id,payload,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(match_id) DO NOTHING').bind(match.id,event.id,JSON.stringify(next),next.version,now).run();
  if(write.meta.changes)return next;
 }
 throw new LiveScoreError('记分太快，请重试',409);
}
