import {fail,type Account,type Event,type State} from './types';
import {isPractice} from './match-format';
import {canEnableEventRanking,canManageRankedEvent,eventRankingEnabled} from './event-ranking';
import {canRecoverEvent} from './event-privacy';

export function canManageEvent(account:Pick<Account,'id'|'role'>,event:Pick<Event,'creatorId'>){
 return account.role==='admin'||event.creatorId===account.id;
}

export function canScheduleEvent(account:Pick<Account,'id'|'role'|'simulationTester'>&{isOwner?:boolean},event:Event){return (canManageEvent(account,event)||!!account.isOwner)&&(!eventRankingEnabled(event)||canManageRankedEvent(account,event))}

/** Score entry is shared by the event's signed-up accounts, not just its host.
 * Resolve the account's own player and active signup from stored data. A proxy
 * signup, match team or client-supplied eventId never grants account authority.
 */
export function canRecordScore(s:Pick<State,'registrations'>,a:Pick<Account,'id'|'role'|'playerId'>,event:Event){
 if(event.deletedAt!==undefined||isPractice(event))return false;
 if(canManageEvent(a,event))return true;
 if(['draft','cancelled'].includes(event.status))return false;
 return s.registrations.some(r=>r.eventId===event.id&&r.playerId===a.playerId&&
  (r.bookingSignups?r.bookingSignups.some(row=>['confirmed','waitlist'].includes(row.status)):['confirmed','waitlist'].includes(r.status)));
}

/** Two-person live swaps are shared with the event's confirmed accounts. Proxy
 * guests and waitlisting do not grant their registrant additional authority. */
export function canSwapLivePlayers(s:Pick<State,'registrations'|'players'>,a:Pick<Account,'id'|'role'|'playerId'>,event:Event){
 if(event.deletedAt!==undefined||isPractice(event)||event.tournament||['draft','cancelled'].includes(event.status))return false;
 if(canManageEvent(a,event))return true;
 return s.players.some(p=>p.id===a.playerId&&p.enabled)&&s.registrations.some(r=>r.eventId===event.id&&r.playerId===a.playerId&&r.status==='confirmed'&&(!r.bookingSignups||r.bookingSignups.some(slot=>slot.status==='confirmed')));
}

const rankedManagementActions=new Set(['pointsStart','pointsNext','liveStart','livePause','generate','planPoints','publishPoints','publish','start','schedulingMode','playSettings','tournamentDraw','tournamentKnockout','tournamentReopen','tournamentStart']);
const eventActions=new Set(['eventRanking','pointsParticipation','pointsStart','pointsLate','pointsPresence','pointsReplace','tournamentDraw','tournamentKnockout','tournamentReopen','tournamentStart','schedulingMode','liveLineup','liveSwap','liveNext','liveStart','livePause','livePreference','liveReady','pointsModeVoting','pointsModeSelect','pointsNext','planPoints','publishPoints','shuttleOption','shuttleRemove','shuttleConfirm','shuttleVoting','deleteEvent','restoreEvent','eventStatus','eventEdit','booking','bookingEdit','moveQueue','attendance','attendanceEdit','generate','swap','moveCourt','lock','publish','start','cancelRound','score','matchScoring','void','cost','costOverride','bookingBearer','deleteCost','modes','exemption','feeRecipient','feeAdvance','notifyFees','settle','playSettings','handicap','challengeMatch']);

// Resolve nested IDs from persisted state: a supplied eventId cannot grant access
// to a booking, attendance record, round, match or cost belonging to another event.
export function authorizeEventAction(s:State,a:Account,action:string,p:Record<string,unknown>){
 if(!eventActions.has(action))return false;
 let eventId:unknown=p.eventId;
 if(['bookingEdit','bookingBearer'].includes(action))eventId=s.bookings.find(b=>b.id===p.bookingId)?.eventId;
 else if(action==='attendanceEdit')eventId=s.attendance.find(at=>at.id===p.attendanceId)?.eventId;
 else if(['swap','publish','start','cancelRound'].includes(action))eventId=s.rounds.find(r=>r.id===p.roundId)?.eventId;
 else if(['pointsLate','liveLineup','moveCourt','lock','score','matchScoring','void','handicap','challengeMatch'].includes(action))eventId=s.matches.find(m=>m.id===p.matchId)?.eventId;
 else if(['costOverride','deleteCost'].includes(action))eventId=s.costs.find(c=>c.id===p.costId)?.eventId;
 const event=s.events.find(e=>e.id===eventId)??fail('活动或关联记录不存在');
 if(event.deletedAt!==undefined&&rankedManagementActions.has(action))fail('活动已删除，请先恢复活动');
 if(action==='eventRanking'){if(!canEnableEventRanking(s,a,event))fail('403: 只有群主、管理员或本活动的测试员创建者可以开启积分赛');return true;}
 if(eventRankingEnabled(event)&&rankedManagementActions.has(action)&&!canEnableEventRanking(s,a,event))fail('403: 只有群主、管理员或本活动的测试员创建者可以开启积分赛');
 if(event.tournament&&['pointsParticipation','pointsStart','pointsLate','pointsPresence','pointsReplace','schedulingMode','liveLineup','liveSwap','liveNext','liveStart','livePause','livePreference','liveReady','pointsModeVoting','pointsModeSelect','pointsModeVote','planPoints','publishPoints','generate','swap','moveCourt','lock','publish','start','cancelRound','playSettings','handicap','challengeMatch'].includes(action))fail('赛事请使用对战表安排比赛');
 if(isPractice(event)&&['pointsParticipation','pointsStart','pointsLate','pointsPresence','pointsReplace','schedulingMode','liveLineup','liveSwap','liveNext','liveStart','livePause','livePreference','liveReady','pointsModeVoting','pointsModeSelect','planPoints','publishPoints','generate','swap','moveCourt','lock','publish','start','cancelRound','score','matchScoring','void','playSettings','handicap','challengeMatch'].includes(action))fail('练球活动不生成比赛或积分，请使用活动接龙和费用功能');
 if((action==='restoreEvent'||event.deletedAt!==undefined&&action==='deleteEvent')&&!canRecoverEvent(s,a,event))fail('403: 只有活动创建者或群主可以恢复已删除活动');
 if(action==='score'||action==='liveNext'){
  if(!canRecordScore(s,a,event))fail(action==='score'?'403: 只有本活动已接龙的球友、创建者或管理员可以录入比分':'403: 只有本活动已接龙的球友、创建者或管理员可以开始组队');
 }else if(action==='liveSwap'){
  if(!canSwapLivePlayers(s,a,event))fail('403: 只有本活动正式接龙的球友、创建者或管理员可以交换上场人员');
 }else if(action==='pointsLate'){
  const m=s.matches.find(m=>m.id===p.matchId);
  if(!canManageEvent(a,event)&&!(m&&[...m.a,...m.b].includes(a.playerId)&&a.playerId!==p.playerId))fail('403: 只有同场到场的球友、创建者或管理员可以报告迟到');
 }else if(action==='pointsParticipation'){
  const player=s.players.find(x=>x.id===p.playerId);
  if(!canManageEvent(a,event)&&!(player&&(player.id===a.playerId||player.ownerId===a.id)))fail('403: 只能调整自己或代报名朋友的上场意愿');
 }else if(action==='pointsPresence'&&p.status==='arrived'){
  const player=s.players.find(x=>x.id===p.playerId);
  if(!canManageEvent(a,event)&&!(player&&(player.id===a.playerId||player.ownerId===a.id)))fail('403: 只能确认自己或代报名朋友已到场');
 }else if(!canManageEvent(a,event)&&!canEnableEventRanking(s,a,event))fail('403: 只能管理自己创建的活动');
 if(event.deletedAt!==undefined&&!['deleteEvent','restoreEvent'].includes(action))fail('活动已删除，请先恢复活动');
 return true;
}

export function isEventAction(action:string){return eventActions.has(action)}
/** Who may report an absence: the activity's managers, or a player of the same match who is there. */
export function canReportNoShow(a:Pick<Account,'id'|'role'|'playerId'>,e:Parameters<typeof canManageEvent>[1],m:{a:string[];b:string[]},absent:string[]){
 return canManageEvent(a,e)||([...m.a,...m.b].includes(a.playerId)&&!absent.includes(a.playerId));
}
