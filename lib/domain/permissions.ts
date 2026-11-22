import {fail,type Account,type Event,type State} from './types';
import {isPractice} from './match-format';
import {canEnableEventRanking,canManageRankedEvent,eventRankingEnabled} from './event-ranking';
import {canRecoverEvent} from './event-privacy';
import {isClubOwner} from './ownership';

/** UI callers use the projected owner flag; server callers reconstruct it from stored ownership below. */
export function canCancelEventCourt(account:Pick<Account,'id'>&{isOwner?:boolean},event:Pick<Event,'creatorId'>){
 return account.isOwner===true||!!event.creatorId&&event.creatorId===account.id;
}

/** The club owner and administrators manage every activity, its creator their own. `isOwner` comes with the projected
 * `me`; server callers also pass authorizeEventAction, which lets the owner through. */
export function canManageEvent(account:Pick<Account,'id'|'role'>&{isOwner?:boolean},event:Pick<Event,'creatorId'>){
 return account.role==='admin'||account.isOwner===true||event.creatorId===account.id;
}

/** 上场意愿 for everyone signed up: 宗主, 副宗主, 长老 and the activity's organiser. */
export function canManageParticipation(account:Pick<Account,'id'|'role'|'simulationTester'>&{isOwner?:boolean},event:Pick<Event,'creatorId'>){return canManageEvent(account,event)||account.simulationTester===true}

export function canScheduleEvent(account:Pick<Account,'id'|'role'|'simulationTester'>&{isOwner?:boolean},event:Event){return (canManageEvent(account,event)||!!account.isOwner)&&(!eventRankingEnabled(event)||canManageRankedEvent(account,event))}

/** Score entry is shared by the event's signed-up accounts, not just its host.
 * Resolve the account's own player and active signup from stored data. A proxy
 * signup, match team or client-supplied eventId never grants account authority.
 */
/** The player assigned to referee this competition match. */
export function isMatchReferee(a:Pick<Account,'playerId'>,e:Event,matchId:unknown){return typeof matchId==='string'&&!!e.tournament?.fixtures.some(f=>f.matchId===matchId&&f.referee===a.playerId)}
export function canRecordScore(s:Pick<State,'registrations'>,a:Pick<Account,'id'|'role'|'playerId'>,event:Event){
 if(event.deletedAt!==undefined||isPractice(event))return false;
 if(canManageEvent(a,event))return true;
 // A competition's scores come from its referees (isMatchReferee, checked per match) and its organisers, never the players.
 if(event.tournament)return false;
 if(['draft','cancelled'].includes(event.status))return false;
 return s.registrations.some(r=>r.eventId===event.id&&r.playerId===a.playerId&&
  (r.bookingSignups?r.bookingSignups.some(row=>['confirmed','waitlist'].includes(row.status)):['confirmed','waitlist'].includes(r.status)));
}

/** 交换上场人员 in live play: only 宗主, 副宗主, 长老 and the activity's creator (November 2026: members swapping
 * themselves produced lopsided games, docs/LIVE_PLAY.md). */
export function canSwapLivePlayers(a:Pick<Account,'id'|'role'|'simulationTester'>&{isOwner?:boolean},event:Event){
 if(event.deletedAt!==undefined||isPractice(event)||event.tournament||['draft','cancelled'].includes(event.status))return false;
 return canManageEvent(a,event)||a.simulationTester===true;
}
/** Reporting a late player is shared with the event's confirmed accounts. Proxy guests and waitlisting do not grant
 * their registrant additional authority. */
export function canReportLate(s:Pick<State,'registrations'|'players'>,a:Pick<Account,'id'|'role'|'playerId'>,event:Event){
 if(event.deletedAt!==undefined||isPractice(event)||event.tournament||['draft','cancelled'].includes(event.status))return false;
 if(canManageEvent(a,event))return true;
 return s.players.some(p=>p.id===a.playerId&&p.enabled)&&s.registrations.some(r=>r.eventId===event.id&&r.playerId===a.playerId&&r.status==='confirmed'&&(!r.bookingSignups||r.bookingSignups.some(slot=>slot.status==='confirmed')));
}

const rankedManagementActions=new Set(['pointsStart','pointsNext','liveStart','livePause','generate','planPoints','publishPoints','publish','start','schedulingMode','playSettings','tournamentDraw','tournamentKnockout','tournamentReopen','tournamentStart']);
const eventActions=new Set(['pairLock','pairUnlock','eventRanking','pointsParticipation','pointsStart','pointsPlay','pointsLate','pointsPresence','pointsReplace','tournamentSettings','tournamentReferee','tournamentArchive','tournamentArrange','tournamentDraw','tournamentKnockout','tournamentReopen','tournamentStart','schedulingMode','liveLineup','liveSwap','liveNext','liveStart','livePause','livePreference','liveReady','pointsModeVoting','pointsModeSelect','pointsNext','planPoints','publishPoints','shuttleOption','shuttleRemove','shuttleConfirm','shuttleVoting','deleteEvent','restoreEvent','eventStatus','eventEdit','booking','bookingEdit','bookingCancel','moveQueue','attendance','attendanceEdit','generate','swap','moveCourt','lock','publish','start','cancelRound','score','matchScoring','void','cost','costOverride','bookingBearer','deleteCost','modes','exemption','feeRecipient','feeAdvance','notifyFees','settle','settleRevoke','feeUpdateIgnore','playSettings','handicap','challengeMatch']);

// Resolve nested IDs from persisted state: a supplied eventId cannot grant access
// to a booking, attendance record, round, match or cost belonging to another event.
export function authorizeEventAction(s:State,a:Account,action:string,p:Record<string,unknown>){
 if(!eventActions.has(action))return false;
 let eventId:unknown=p.eventId;
 if(['bookingEdit','bookingBearer','bookingCancel'].includes(action))eventId=s.bookings.find(b=>b.id===p.bookingId)?.eventId;
 else if(action==='attendanceEdit')eventId=s.attendance.find(at=>at.id===p.attendanceId)?.eventId;
 else if(['swap','publish','start','cancelRound'].includes(action))eventId=s.rounds.find(r=>r.id===p.roundId)?.eventId;
 else if(['pointsLate','liveLineup','moveCourt','lock','score','matchScoring','void','handicap','challengeMatch'].includes(action))eventId=s.matches.find(m=>m.id===p.matchId)?.eventId;
 else if(['costOverride','deleteCost'].includes(action))eventId=s.costs.find(c=>c.id===p.costId)?.eventId;
 const event=s.events.find(e=>e.id===eventId)??fail('活动或关联记录不存在');
 if(action==='bookingCancel'&&!canCancelEventCourt({id:a.id,isOwner:isClubOwner(s,a)},event))fail('403: 只有活动发起人和宗主可以取消场地');
 if(event.deletedAt!==undefined&&rankedManagementActions.has(action))fail('活动已删除，请先恢复活动');
 if(action==='eventRanking'){if(!canEnableEventRanking(s,a,event))fail('403: 只有宗主、副宗主或本活动的长老创建者可以开启积分赛');return true;}
 if(eventRankingEnabled(event)&&rankedManagementActions.has(action)&&!canEnableEventRanking(s,a,event))fail('403: 只有宗主、副宗主或本活动的长老创建者可以开启积分赛');
 if(event.tournament&&['pointsParticipation','pointsStart','pointsPlay','pointsLate','pointsPresence','pointsReplace','schedulingMode','liveLineup','liveSwap','liveNext','liveStart','livePause','livePreference','liveReady','pointsModeVoting','pointsModeSelect','pointsModeVote','planPoints','publishPoints','generate','swap','moveCourt','lock','publish','start','cancelRound','playSettings','handicap','challengeMatch'].includes(action))fail('赛事请使用对战表安排比赛');
 if(isPractice(event)&&['pointsParticipation','pointsStart','pointsPlay','pointsLate','pointsPresence','pointsReplace','schedulingMode','liveLineup','liveSwap','liveNext','liveStart','livePause','livePreference','liveReady','pointsModeVoting','pointsModeSelect','planPoints','publishPoints','generate','swap','moveCourt','lock','publish','start','cancelRound','score','matchScoring','void','playSettings','handicap','challengeMatch'].includes(action))fail('练球活动不生成比赛或积分，请使用活动接龙和费用功能');
 if((action==='restoreEvent'||event.deletedAt!==undefined&&action==='deleteEvent')&&!canRecoverEvent(s,a,event))fail('403: 只有活动创建者或宗主可以恢复已删除活动');
 if(action==='score'||action==='liveNext'||action==='pointsPlay'){
  if(!canRecordScore(s,a,event)&&!(action==='score'&&isMatchReferee(a,event,p.matchId)))fail(action==='score'?'403: 只有本活动已接龙的球友、创建者或副宗主可以录入比分':action==='liveNext'?'403: 只有本活动已接龙的球友、创建者或副宗主可以开始组队':'403: 只有本活动已接龙的球友、创建者或副宗主可以开始比赛');
 }else if(action==='liveSwap'){
  if(!canSwapLivePlayers({...a,isOwner:isClubOwner(s,a)},event))fail('403: 只有宗主、副宗主、长老或活动创建者可以交换上场人员');
 }else if(action==='pointsLate'){
  // Anyone confirmed for the activity may report a late player on any current match (the command also requires them
  // to be in their signup time now), not just the others in that match; only organisers may mark themselves.
  if(!canReportLate(s,a,event))fail('403: 只有本活动正式接龙的球友、创建者或副宗主可以报告迟到');
  if(!canManageEvent(a,event)&&a.playerId===p.playerId)fail('403: 不能给自己报告迟到，请让场上球友或组织者操作');
 }else if(action==='pointsParticipation'){
  const player=s.players.find(x=>x.id===p.playerId);
  // 宗主, 副宗主 and 长老 may change anyone's; others only their own and their signed-up friends (docs/COMPACT_MOBILE_LAYOUT.md).
  if(!canManageParticipation(a,event)&&!(player&&(player.id===a.playerId||player.ownerId===a.id)))fail('403: 只能调整自己或代报名朋友的上场意愿');
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
