import {notificationPointEntries} from './notification-points';
import {attendancePointAdjustments} from './points-attendance';
import {mvpPointAdjustments} from './activity-voting';
import {bountyPointAdjustments} from './bounties';
import {duelPointAdjustments} from './duels';
import {eventRankingEnabled} from './event-ranking';
import {pointGrants,ratingAdjustments} from './point-grants';
import {realmLedger,replayRealmScores,isRatedMatch,realmPolicy,expectedScore,kFactor,roundDelta,type RealmLedger} from './realm-rating';
import {guestRatings} from './guests';
import {settledMatchFilter} from './event-lifecycle';
import {gameFacts} from './game-facts';
import {defaultRules,month,type State,type Rules,type Match} from './types';
import {quarterMonths} from '../ranking-quarter';
import {scoreSeasonGames,seasonGameScope} from './season-points';
import {seasonGamePointsFactor} from './game-points';
/** Website rounds are 2v2. Singles means exactly one different player on each side. */
export function isSinglesMatch(m:Pick<Match,'a'|'b'>){return m.a.length===1&&m.b.length===1&&m.a[0]!==m.b[0]}
/** Website rounds are 2v2: exactly two different players on each side. */
export function isDoublesMatch(m:Pick<Match,'a'|'b'>){return m.a.length===2&&m.b.length===2}
/** all: the established board (every recorded website match plus owner grants). singles: 1v1 matches only, same rules, no grants. */
export type RankingFormat='all'|'singles'|'doubles';
export function validScore(a:number,b:number,r:Rules=defaultRules){if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a===b)return false;const hi=Math.max(a,b),lo=Math.min(a,b);return hi<=r.ceiling&&((hi===r.target&&lo<=hi-r.lead)||(hi>r.target&&hi<r.ceiling&&hi-lo===r.lead)||(hi===r.ceiling&&lo>=r.ceiling-r.lead&&lo<hi))}
/** Grouping strength is the 修为 score itself (the club, November 2026: one score, not a doubles-only one): the same
 * replay as the shown 修为, doubles and singles rated games and the owner's 修为 grants, live including running
 * activities. Automatic grouping, partner modes and handicap suggestions read it. The realm's demotion buffer only
 * changes the shown realm name; grouping uses the score. Owner-set initial ratings and season K values do not change it. */
export const strengthAlgorithm='realm-elo-v3';
export function replayRating(s:Pick<State,'players'|'matches'|'events'|'accounts'|'audits'|'ratingChanges'>,now=Date.now()){
 const {rows,games}=replayRealmScores(s,m=>isRatedMatch(m,now),()=>true,realmPolicy.doubles,now,ratingAdjustments(s));
 for(const p of s.players){const r=rows.get(p.id)!;p.rating=r.score;p.ratedGames=r.games}
 // A friend's grouping strength follows their results through the running activity (the club, November 2026), from
 // the level picked for them; once the activity is over they start again at that level. Members' 修为 is unchanged.
 for(const [id,score] of guestNightRatings(s,games,now)){const p=s.players.find(x=>x.id===id);if(p)p.rating=score}
 const changes=games.map(g=>({id:g.matchId+':'+g.gameIndex+':'+g.playerId,matchId:g.matchId,playerId:g.playerId,before:g.before,after:g.after,delta:g.delta,algorithm:strengthAlgorithm,k:g.k}));
 s.ratingChanges=changes;return changes;
}
/** 来宾当晚水平: each friend's grouping strength after the rated games of activities still running, starting from their
 * level at each game and moving by the same Elo step as a new member (K 32, team averages). Members' scores are taken
 * from the replay at each game. Only grouping reads it; friends never enter 修为 or any board. */
export function guestNightRatings(s:Pick<State,'players'|'matches'|'events'|'accounts'>,games:{matchId:string;gameIndex:number;playerId:string;before:number}[],now:number){
 const guests=guestRatings(s),settled=settledMatchFilter(s,now),result=new Map<string,number>();
 if(!guests.size)return result;
 const before=new Map(games.map(g=>[g.matchId+':'+g.gameIndex+':'+g.playerId,g.before]));
 const changed=new Map(s.players.filter(p=>guests.has(p.id)).map(p=>[p.id,Math.max(-Infinity,...(p.guestLevels??[]).map(x=>x.at))]));
 // As in the 修为 replay, practice activities (no ranking) do not count.
 const practice=new Set(s.events.filter(e=>!eventRankingEnabled(e)).map(e=>e.id));
 const ordered=s.matches.filter(m=>!settled(m)&&!practice.has(m.eventId)&&isRatedMatch(m,now)&&[...m.a,...m.b].some(id=>guests.has(id))).sort((a,b)=>(a.end??Infinity)-(b.end??Infinity)||a.id.localeCompare(b.id));
 for(const m of ordered)for(const g of gameFacts(m)){
  const at=m.start??m.end??now,score=(id:string)=>guests.has(id)?(at>=(changed.get(id)??-Infinity)?result.get(id):undefined)??guests.get(id)!(at):before.get(m.id+':'+g.index+':'+id)??s.players.find(p=>p.id===id)?.rating??1000;
  const average=(ids:string[])=>ids.reduce((n,id)=>n+score(id),0)/ids.length,a=average(m.a),b=average(m.b);
  const moves=new Map<string,number>();
  // A level set during the activity starts the friend again from it: only their games after the change move it.
  for(const [team,own,other] of [[m.a,a,b],[m.b,b,a]] as const)for(const id of team)if(guests.has(id)&&at>=(changed.get(id)??-Infinity))moves.set(id,roundDelta(kFactor(0)*((g.winner===(team===m.a?'a':'b')?1:0)-expectedScore(own,other))));
  for(const [id,delta] of moves)result.set(id,score(id)+delta);
 }
 return result;
}
/** One-time switch of the grouping strength to 修为 (realm-elo-v2: doubles only; realm-elo-v3: the full 修为). */
export function mergeStrengthRating(s:State,now=Date.now()){
 if(!s.settings.initialized)return null;
 const before=new Map(s.players.map(p=>[p.id,p.rating]));replayRating(s,now);
 // Clock-driven restarts must reach grouping on every authoritative load.
 // Only the first rollout writes a migration marker and audit; later loads
 // refresh the in-memory strength without creating a new revision.
 if(s.settings.strengthVersion===strengthAlgorithm)return null;
 s.settings.strengthVersion=strengthAlgorithm;
 return {version:strengthAlgorithm,players:s.players.map(p=>({playerId:p.id,before:before.get(p.id)??null,after:p.rating}))};
}
export {seasonPointsPolicy,upsetBonus,gamePoints} from './season-points';
/** Ranking points are the 赛季积分 of the period's rated games (plus owner grants on the combined board), never 修为.
 * Points stay live: games of a running activity count at once (shown as pending) while realms wait for the activity to end.
 * `leaderboard` (one month) only backs the owner's history-rules preview; members see quarterly and annual boards. */
export function leaderboard(s:State,season:string,now=Date.now(),ledger?:RealmLedger){return aggregateLeaderboard(s,[season],now,'all',ledger)}
function aggregateLeaderboard(s:State,periods:string[],now=Date.now(),format:RankingFormat='all',ledger=realmLedger(s,now)){
 const events=new Map(s.events.map(e=>[e.id,e]));
 const practice=new Set(s.events.filter(e=>!eventRankingEnabled(e)).map(e=>e.id));
 const singles=format==='singles',accept=(m:Match)=>!practice.has(m.eventId)&&(format==='all'||(singles?isSinglesMatch(m):isDoublesMatch(m))),chosen=new Set(periods),grants=singles?[]:pointGrants(s),bonus=new Map<string,number>(),matches=new Map(s.matches.map(m=>[m.id,m]));
 for(const g of grants)if(chosen.has(g.period))bonus.set(g.playerId,(bonus.get(g.playerId)??0)+g.points);
 const notification=new Map<string,number>();if(!singles)for(const g of notificationPointEntries(s))if(chosen.has(g.period))notification.set(g.playerId,(notification.get(g.playerId)??0)+g.points);
 const attendance=new Map<string,number>();for(const g of attendancePointAdjustments(s))if(chosen.has(g.period)&&(format==='all'||g.format===format))attendance.set(g.playerId,(attendance.get(g.playerId)??0)+g.delta);
 const mvp=new Map<string,number>();for(const g of mvpPointAdjustments(s,now))if(chosen.has(g.period)&&(format==='all'||g.format===format))mvp.set(g.playerId,(mvp.get(g.playerId)??0)+g.delta);
 // Completed (positive) and failed (negative) bounties stay apart so the breakdown can show both (docs/RANKING_POINTS_BREAKDOWN.md).
 const bountyWon=new Map<string,number>(),bountyLost=new Map<string,number>();
 for(const g of bountyPointAdjustments(s,now,id=>ledger.byPlayer.get(id)??[]))if(chosen.has(g.period)&&(format==='all'||g.format===format)){const side=g.delta>0?bountyWon:bountyLost;side.set(g.playerId,(side.get(g.playerId)??0)+g.delta)}
 const bounty=new Map<string,number>();for(const id of new Set([...bountyWon.keys(),...bountyLost.keys()]))bounty.set(id,(bountyWon.get(id)??0)+(bountyLost.get(id)??0));
 // 天机战帖 (lib/domain/duels.ts): stakes won and lost apart, like bounties, for the breakdown. Doubles only.
 const duelWon=new Map<string,number>(),duelLost=new Map<string,number>();
 for(const g of duelPointAdjustments(s,now))if(chosen.has(g.period)&&(format==='all'||g.format===format)){const side=g.delta>0?duelWon:duelLost;side.set(g.playerId,(side.get(g.playerId)??0)+g.delta)}
 const members=new Set(s.accounts.map(account=>account.playerId));
 // One pass over the matches, grouped by player in match order (a filter per player was players × matches).
 const played=new Map<string,{match:Match;games:number}[]>();
 for(const m of s.matches){
  if(m.status!=='complete'||m.start===null||!chosen.has(month(m.start))||!accept(m))continue;
  const games=gameFacts(m).length;if(!games)continue;
  for(const id of new Set([...m.a,...m.b])){const list=played.get(id);if(list)list.push({match:m,games});else played.set(id,[{match:m,games}])}
 }
 const rows=s.players.filter(p=>p.enabled&&members.has(p.id)).map(p=>{
  const all=played.get(p.id)??[];
  const scored=scoreSeasonGames((ledger.byPlayer.get(p.id)??[]).filter(g=>accept(matches.get(g.matchId)!)),g=>{
   return seasonGameScope(g,matches.get(g.matchId)!);
  },g=>seasonGamePointsFactor(events.get(g.eventId))).filter(row=>chosen.has(month(row.game.start)));
  const rated=scored.map(row=>row.game);
  const games=rated.length,wins=rated.filter(g=>g.won).length,halfRewardWins=scored.filter(row=>row.game.won&&row.rewardFactor===0.5).length,halfRewardLosses=scored.filter(row=>!row.game.won&&row.rewardFactor===0.5).length,net=rated.reduce((n,g)=>n+g.margin,0),score=scored.reduce((n,row)=>n+row.points,0),upsets=scored.reduce((n,row)=>n+row.upsetPoints,0),streakPoints=scored.reduce((n,row)=>n+row.streakPoints,0),pending=scored.filter(row=>!row.game.settled);
  const realm=ledger.snapshot.get(p.id)!;
  return {playerId:p.id,name:p.name,rating:p.rating,realm:realm.realm,realmScore:realm,provisional:realm.placement,total:all.reduce((n,row)=>n+row.games,0),totalMatches:all.length,games,wins,...(halfRewardWins?{halfRewardWins}:{}),...(halfRewardLosses?{halfRewardLosses}:{}),losses:games-wins,notificationPoints:notification.get(p.id)??0,points:score+(notification.get(p.id)??0)+(bonus.get(p.id)??0)+(attendance.get(p.id)??0)+(mvp.get(p.id)??0)+(bounty.get(p.id)??0)+(duelWon.get(p.id)??0)+(duelLost.get(p.id)??0),attendancePoints:attendance.get(p.id)??0,mvpPoints:mvp.get(p.id)??0,bountyPoints:bounty.get(p.id)??0,bountyWonPoints:bountyWon.get(p.id)??0,bountyLostPoints:bountyLost.get(p.id)??0,duelWonPoints:duelWon.get(p.id)??0,duelLostPoints:duelLost.get(p.id)??0,matchPoints:score,upsetPoints:upsets,streakPoints,manualPoints:bonus.get(p.id)??0,pendingPoints:pending.reduce((n,row)=>n+row.points,0),pendingGames:pending.length,rate:games?wins/games:0,margin:games?net/games:0,qualified:true,rank:0};
 }).filter(row=>!singles||row.totalMatches>0||row.games>0||row.attendancePoints!==0||row.mvpPoints!==0||row.bountyPoints!==0).sort((a,b)=>b.points-a.points||b.rate-a.rate||b.margin-a.margin||a.playerId.localeCompare(b.playerId));
 rows.forEach((row,i)=>{const prev=rows[i-1];row.rank=prev&&prev.points===row.points&&prev.rate===row.rate&&prev.margin===row.margin?prev.rank:i+1});return rows;
}
const yearMonths=(year:number)=>Array.from({length:12},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));
export function quarterlyLeaderboard(s:State,quarter:string,now=Date.now(),ledger?:RealmLedger){return aggregateLeaderboard(s,quarterMonths(quarter),now,'all',ledger)}
export function annualLeaderboard(s:State,year:number,now=Date.now(),ledger?:RealmLedger){return aggregateLeaderboard(s,yearMonths(year),now,'all',ledger)}
/** Singles boards list only members with a completed singles match in the period; the main boards stay unchanged.
 * Points are the singles games' 赛季积分, live like the combined board; realms on the rows settle per activity. */
export function singlesLeaderboard(s:State,season:string,now=Date.now(),ledger?:RealmLedger){return aggregateLeaderboard(s,[season],now,'singles',ledger)}
export function singlesQuarterlyLeaderboard(s:State,quarter:string,now=Date.now(),ledger?:RealmLedger){return aggregateLeaderboard(s,quarterMonths(quarter),now,'singles',ledger)}
export function singlesAnnualLeaderboard(s:State,year:number,now=Date.now(),ledger?:RealmLedger){return aggregateLeaderboard(s,yearMonths(year),now,'singles',ledger)}
export function doublesLeaderboard(s:State,season:string,now=Date.now(),ledger?:RealmLedger){return aggregateLeaderboard(s,[season],now,'doubles',ledger)}
export function doublesQuarterlyLeaderboard(s:State,quarter:string,now=Date.now(),ledger?:RealmLedger){return aggregateLeaderboard(s,quarterMonths(quarter),now,'doubles',ledger)}
export function doublesAnnualLeaderboard(s:State,year:number,now=Date.now(),ledger?:RealmLedger){return aggregateLeaderboard(s,yearMonths(year),now,'doubles',ledger)}
