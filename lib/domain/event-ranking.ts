import {isClubOwner} from './ownership';
import {isPractice} from './match-format';
import {fail,type Account,type Event,type Match,type State} from './types';

/** Missing flags describe the previously ranked activity history. */
export const eventRankingEnabled=(e:Pick<Event,'matchFormat'|'ranked'>)=>!isPractice(e)&&e.ranked!==false;
/** Viewer flags come from the server projection. Testers manage ranking only for their own activities. */
export function canManageRankedEvent(a:Pick<Account,'id'|'role'|'simulationTester'>&{isOwner?:boolean},e?:Pick<Event,'creatorId'>){
 return a.role==='admin'||a.isOwner===true||(a.simulationTester===true&&(!e||e.creatorId===a.id));
}
/** Server callers supply the authenticated stored account; never trust a payload's owner/tester flags. */
export const canEnableEventRanking=(s:State,a:Pick<Account,'id'|'role'|'simulationTester'>,e?:Pick<Event,'creatorId'>)=>canManageRankedEvent({...a,isOwner:isClubOwner(s,a)},e);
export const eventHasStartedMatches=(s:Pick<State,'matches'>,e:Pick<Event,'id'>)=>s.matches.some(m=>m.eventId===e.id&&(m.start!==null||m.games.length>0||m.scoreA!==null||m.scoreB!==null||['complete','forfeit'].includes(m.status)));
export function setMatchRanking(m:Pick<Match,'monthly'|'elo'|'handicap'>,e?:Pick<Event,'matchFormat'|'ranked'>){
 const enabled=!e||eventRankingEnabled(e);m.monthly=enabled;m.elo=enabled&&!m.handicap?.applied;
}
/** Upgrade only activities that have not begun; preserve played/history results. */
export function enableRoleRankedEvents(s:State,now:number){
 if(!s.settings.initialized||s.settings.rankedEventsVersion==='admins-v1')return false;
 if(!s.events.some(e=>e.ranked===undefined))return false;
 const changed:{eventId:string;ranked:boolean}[]=[];
 for(const e of s.events){
  if(e.ranked!==undefined)continue;
  const creator=s.accounts.find(a=>a.id===e.creatorId);
  e.ranked=!isPractice(e)&&(e.end<=now||eventHasStartedMatches(s,e)||!creator||creator.role==='admin'||isClubOwner(s,creator));
  if(!eventHasStartedMatches(s,e))for(const m of s.matches.filter(m=>m.eventId===e.id))setMatchRanking(m,e);
  changed.push({eventId:e.id,ranked:e.ranked});
 }
 s.settings.rankedEventsVersion='admins-v1';
 s.audits.push({id:crypto.randomUUID(),at:now,actor:'system:ranked-events',action:'enableRoleRankedEvents',reason:'积分赛由管理员或群主开启；尚未开打的成员活动改为普通活动，历史赛果保留',changes:{events:changed}});
 return true;
}
export function changeEventRanking(s:State,a:Account,e:Event,ranked:boolean,expected:boolean,now:number){
 if(!canEnableEventRanking(s,a,e))fail('403: 只有群主、管理员或本活动的测试员创建者可以开启或关闭积分赛');
 if(eventRankingEnabled(e)!==expected)fail('409: 活动计分方式已更新，请刷新');
 if(isPractice(e)&&ranked)fail('练球活动不能开启积分赛');
 if(e.deletedAt!==undefined||e.end<=now||['ended','cancelled'].includes(e.status)||eventHasStartedMatches(s,e))fail('活动已开打或结束，不能变更计分方式');
 e.ranked=ranked;
 for(const m of s.matches.filter(m=>m.eventId===e.id))setMatchRanking(m,e);
}
