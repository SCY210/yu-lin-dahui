import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {canManageEvent,canReportNoShow} from './permissions';
import {eventStatusAt} from './event-lifecycle';
import {fillLiveCourts,livePresentIds} from './live-play';
import {isPractice} from './match-format';
import {replayRating} from './ranking';
import {fail,type State,type Account} from './types';

const id=z.string().min(1).max(100);
const schemas={
 noShow:z.object({matchId:id,playerIds:z.array(id).min(1).max(4),reason:z.string().max(200).optional()}),
 noShowArrived:z.object({eventId:id,playerId:id}),
};

/** A started match whose players did not all show up becomes a forfeit: it counts as one loss (修为 and season points)
 * for the absent players only. The others gain or lose nothing and keep their turn in the rotation. Absent players are
 * held out of scheduling until they, their registrant or an organiser confirms they have arrived. */
export async function applyNoShow(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 if(command.action==='noShow'){
  const p=command.payload;
  const m=s.matches.find(m=>m.id===p.matchId)??fail('比赛不存在');
  const e=s.events.find(e=>e.id===m.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
  if(e.tournament)fail('赛事请在对战表中处理弃权');
  if(isPractice(e))fail('练球活动不记录缺席败场');
  if(['draft','ended','cancelled'].includes(eventStatusAt(e,now))||now<e.start)fail('请在活动进行时标记缺席');
  // A second absent player of the same match can be added to an existing no-show.
  const adding=m.status==='forfeit'&&!!m.noShow?.length;
  if(!adding&&(m.status!=='playing'||m.start===null||m.start>now||m.games.length||m.scoreA!==null||m.scoreB!==null))fail('只能在比赛开始后、录入比分前标记没到场');
  const players=[...m.a,...m.b],absent=[...new Set([...(adding?m.noShow!:[]),...p.playerIds])];
  if(absent.some(id=>!players.includes(id)))fail('只能标记本场比赛的选手');
  if(absent.length>=players.length)fail('至少要有一位选手到场；全部没到请由活动创建者取消本局');
  if(adding&&absent.length===m.noShow!.length)fail('这些选手已标记为没到场');
  if(!canReportNoShow(a,e,m,absent))fail('403: 只有同场到场的选手、活动创建者或管理员可以标记没到场');
  if(!canManageEvent(a,e)&&!livePresentIds(s,e,now).includes(a.playerId))fail('403: 只有当前参加时段内的到场选手可以报告缺席');
  const newlyAbsent=absent.filter(id=>!m.noShow?.includes(id));
  if(adding&&s.matches.some(x=>x.id!==m.id&&x.status==='complete'&&(x.start??0)>=(m.end??0)&&[...x.a,...x.b].some(id=>newlyAbsent.includes(id))))fail('该球友已有后续赛果，不能再追加本场缺席，请核对原记录');
  const refills=s.matches.filter(x=>x.id!==m.id&&x.eventId===e.id&&x.status==='playing'&&[...x.a,...x.b].some(id=>newlyAbsent.includes(id)));
  if(refills.some(x=>x.games.length||x.scoreA!==null||x.scoreB!==null))fail('后续对局已有比分，不能撤销，请先核对记录');
  m.status='forfeit';m.noShow=absent;if(!adding)m.end=now;m.enteredBy=a.id;
  const r=s.rounds.find(r=>r.id===m.roundId);
  if(r&&s.matches.filter(x=>x.roundId===r.id).every(x=>['complete','cancelled','forfeit'].includes(x.status)))r.status='complete';
  e.noShowHold=[...new Set([...(e.noShowHold??[]),...absent])];
  // A previous report may have refilled a court with someone now also reported absent.
  // Withdraw only unscored attempts; nobody else loses a game or a rotation turn.
  for(const refill of refills){refill.status='cancelled';refill.end=now;const round=s.rounds.find(r=>r.id===refill.roundId);if(round&&s.matches.filter(x=>x.roundId===round.id).every(x=>x.status==='cancelled'))round.status='cancelled'}
  replayRating(s,now);
  fillLiveCourts(s,e,now);
  s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'比赛开始后选手没到场，判负',changes:{eventId:e.id,matchId:m.id,absent,cancelledRefills:refills.map(m=>m.id)}});
  return true;
 }
 const p=command.payload;
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 if(e.tournament||isPractice(e))fail('本活动不使用缺席恢复排场');
 if(['draft','ended','cancelled'].includes(eventStatusAt(e,now)))fail('请在活动进行时确认到场');
 const player=s.players.find(x=>x.id===p.playerId)??fail('球友不存在');
 if(!canManageEvent(a,e)&&player.id!==a.playerId&&player.ownerId!==a.id)fail('403: 只能确认自己或代报名朋友到场');
 if(!e.noShowHold?.includes(player.id))fail('该球友没有被标记为没到场');
 e.noShowHold=e.noShowHold.filter(id=>id!==player.id);if(!e.noShowHold.length)delete e.noShowHold;
 const late=e.pointsSession?.attendance.find(row=>row.playerId===player.id);if(late)late.available=true;
 fillLiveCourts(s,e,now);
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'没到场的选手已到场，恢复排场',changes:{eventId:e.id,playerId:player.id}});
 return true;
}
