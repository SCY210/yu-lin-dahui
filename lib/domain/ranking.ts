import {pointGrants,ratingAdjustments} from './point-grants';
import {realmLedger,replayRealmScores,isRatedMatch,realmPolicy,type RealmLedger} from './realm-rating';
import {gameFacts} from './game-facts';
import {defaultRules,month,type State,type Rules,type Match} from './types';
import {quarterMonths} from '../ranking-quarter';
import {gamePoints,upsetBonus} from './season-points';
/** Website rounds are 2v2. Singles means exactly one different player on each side. */
export function isSinglesMatch(m:Pick<Match,'a'|'b'>){return m.a.length===1&&m.b.length===1&&m.a[0]!==m.b[0]}
/** Website rounds are 2v2: exactly two different players on each side. */
export function isDoublesMatch(m:Pick<Match,'a'|'b'>){return m.a.length===2&&m.b.length===2}
/** all: the established board (every recorded website match plus owner grants). singles: 1v1 matches only, same rules, no grants. */
export type RankingFormat='all'|'singles'|'doubles';
export function validScore(a:number,b:number,r:Rules=defaultRules){if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a===b)return false;const hi=Math.max(a,b),lo=Math.min(a,b);return hi<=r.ceiling&&((hi===r.target&&lo<=hi-r.lead)||(hi>r.target&&hi<r.ceiling&&hi-lo===r.lead)||(hi===r.ceiling&&lo>=r.ceiling-r.lead&&lo<hi))}
/** Grouping strength: the same 段位分 formula (per game, team average, novice K, long-break restart) replayed over
 * doubles games only, live including running activities. Automatic grouping, partner modes and handicap suggestions
 * read it; singles never move it, the owner's 段位分 grants do. For doubles-only players it equals their 段位分. Owner-set initial ratings and
 * season K values no longer change it. */
export const strengthAlgorithm='realm-elo-v2';
export function replayRating(s:State,now=Date.now()){
 const {rows,games}=replayRealmScores(s,m=>isDoublesMatch(m)&&isRatedMatch(m,now),()=>true,realmPolicy.doubles,now,ratingAdjustments(s));
 for(const p of s.players){const r=rows.get(p.id)!;p.rating=r.score;p.ratedGames=r.games}
 const changes=games.map(g=>({id:g.matchId+':'+g.gameIndex+':'+g.playerId,matchId:g.matchId,playerId:g.playerId,before:g.before,after:g.after,delta:g.delta,algorithm:strengthAlgorithm,k:g.k}));
 s.ratingChanges=changes;return changes;
}
/** One-time switch from the separate hidden grouping rating to 段位分. */
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
/** Ranking points are the 赛季积分 of the period's rated games (plus owner grants on the combined board), never 段位分.
 * Points stay live: games of a running activity count at once (shown as pending) while realms wait for the activity to end.
 * `leaderboard` (one month) only backs the owner's history-rules preview; members see quarterly and annual boards. */
export function leaderboard(s:State,season:string,now=Date.now(),ledger?:RealmLedger){return aggregateLeaderboard(s,[season],now,'all',ledger)}
function aggregateLeaderboard(s:State,periods:string[],now=Date.now(),format:RankingFormat='all',ledger=realmLedger(s,now)){
 const singles=format==='singles',accept=(m:Match)=>format==='all'||(singles?isSinglesMatch(m):isDoublesMatch(m)),chosen=new Set(periods),grants=singles?[]:pointGrants(s),bonus=new Map<string,number>(),matches=new Map(s.matches.map(m=>[m.id,m]));
 for(const g of grants)if(chosen.has(g.period))bonus.set(g.playerId,(bonus.get(g.playerId)??0)+g.points);
 const members=new Set(s.accounts.map(account=>account.playerId));
 const rows=s.players.filter(p=>p.enabled&&members.has(p.id)).map(p=>{
  const all=s.matches.filter(m=>m.status==='complete'&&m.start!==null&&chosen.has(month(m.start))&&[...m.a,...m.b].includes(p.id)&&accept(m)&&gameFacts(m).length>0);
  const rated=(ledger.byPlayer.get(p.id)??[]).filter(g=>chosen.has(month(g.start))&&accept(matches.get(g.matchId)!));
  const games=rated.length,wins=rated.filter(g=>g.won).length,net=rated.reduce((n,g)=>n+g.margin,0),score=rated.reduce((n,g)=>n+gamePoints(g),0),upsets=rated.reduce((n,g)=>n+upsetBonus(g),0),pending=rated.filter(g=>!g.settled);
  const realm=ledger.snapshot.get(p.id)!;
  return {playerId:p.id,name:p.name,rating:p.rating,realm:realm.realm,realmScore:realm,provisional:realm.placement,total:all.reduce((n,m)=>n+gameFacts(m).length,0),totalMatches:all.length,games,wins,losses:games-wins,points:score+(bonus.get(p.id)??0),matchPoints:score,upsetPoints:upsets,manualPoints:bonus.get(p.id)??0,pendingPoints:pending.reduce((n,g)=>n+gamePoints(g),0),pendingGames:pending.length,rate:games?wins/games:0,margin:games?net/games:0,qualified:true,rank:0};
 }).filter(row=>!singles||row.totalMatches>0).sort((a,b)=>b.points-a.points||b.rate-a.rate||b.margin-a.margin||a.playerId.localeCompare(b.playerId));
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
