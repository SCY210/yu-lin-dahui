import type {RatedGame} from './realm-rating';
import {month,type Match} from './types';
import {rankingQuarter} from '../ranking-quarter';

/** 赛季积分, separate from 修为: the loser of a rated game gets `loss`, the winner `win`, plus an upset bonus when
 * the winners' average 修为 before the game was at least `gap` below the opponents'. */
export const seasonPointsPolicy={win:3,loss:-1,upsets:[{gap:150,bonus:2},{gap:50,bonus:1}],streak:{start:2,cap:3}} as const;
export function upsetBonus(g:Pick<RatedGame,'won'|'team'|'opponent'>){if(!g.won)return 0;const gap=g.opponent-g.team;return seasonPointsPolicy.upsets.find(u=>gap>=u.gap)?.bonus??0}
export function winningStreakBonus(wins:number){return Number.isSafeInteger(wins)?Math.max(0,Math.min(seasonPointsPolicy.streak.cap,wins-seasonPointsPolicy.streak.start+1)):0}
export function gamePoints(g:Pick<RatedGame,'won'|'team'|'opponent'>,consecutiveWins=0){return (g.won?seasonPointsPolicy.win:seasonPointsPolicy.loss)+upsetBonus(g)+(g.won?winningStreakBonus(consecutiveWins):0)}

const replayOrder=(a:RatedGame,b:RatedGame)=>a.end-b.end||a.matchId.localeCompare(b.matchId)||a.gameIndex-b.gameIndex;
/** Replay the same canonical order as Elo without changing its values. Scope is
 * quarter + format, independent of the selected monthly/quarterly/annual view. */
export function scoreSeasonGames(games:RatedGame[],scope:(game:RatedGame)=>string){
 const streaks=new Map<string,number>();
 return [...games].sort(replayOrder).map(game=>{
  const key=JSON.stringify([game.playerId,scope(game)]),wins=game.won?(streaks.get(key)??0)+1:0;
  streaks.set(key,wins);
  return {game,consecutiveWins:wins,streakPoints:game.won?winningStreakBonus(wins):0,points:gamePoints(game,wins)};
 });
}

export function seasonGameScope(game:RatedGame,match:Pick<Match,'a'|'b'>){
 const format=match.a.length===1&&match.b.length===1?'singles':match.a.length===2&&match.b.length===2?'doubles':'other';
 return rankingQuarter(month(game.start))+':'+format;
}
export type WinningStreaks={singles:number;doubles:number};
/** Current-quarter avatar state, from exactly the ranking's rated sequence. */
export function activeWinningStreaks(games:RatedGame[],matches:Map<string,Match>,quarter:string){
 const active=new Map<string,WinningStreaks>();
 for(const {game,consecutiveWins} of scoreSeasonGames(games,g=>seasonGameScope(g,matches.get(g.matchId)!))){
  const scope=seasonGameScope(game,matches.get(game.matchId)!);
  if(!scope.startsWith(quarter+':'))continue;
  const format=scope.endsWith(':singles')?'singles':scope.endsWith(':doubles')?'doubles':null;
  if(!format)continue;
  const streak=active.get(game.playerId)??{singles:0,doubles:0};streak[format]=consecutiveWins;active.set(game.playerId,streak);
 }
 return active;
}
/** Current-quarter consecutive rated losses per format, for the avatar's losing-streak sign only; season points
 * and Elo are unaffected. Same rated sequence, order and scope as the winning streak: a win resets it. */
export function activeLosingStreaks(games:RatedGame[],matches:Map<string,Match>,quarter:string){
 const runs=new Map<string,number>(),active=new Map<string,WinningStreaks>();
 for(const game of [...games].sort(replayOrder)){
  const scope=seasonGameScope(game,matches.get(game.matchId)!),key=JSON.stringify([game.playerId,scope]);
  const losses=game.won?0:(runs.get(key)??0)+1;runs.set(key,losses);
  if(!scope.startsWith(quarter+':'))continue;
  const format=scope.endsWith(':singles')?'singles':scope.endsWith(':doubles')?'doubles':null;
  if(!format)continue;
  const streak=active.get(game.playerId)??{singles:0,doubles:0};streak[format]=losses;active.set(game.playerId,streak);
 }
 return active;
}

/** The avatar shows the player's live state: only the format of their most recent rated game this quarter counts,
 * so a run in the other format that has since gone quiet is not shown. Season-point streak bonuses stay per format. */
export function latestRatedFormats(games:RatedGame[],matches:Map<string,Match>,quarter:string){
 const latest=new Map<string,'singles'|'doubles'>();
 for(const game of [...games].sort(replayOrder)){
  const scope=seasonGameScope(game,matches.get(game.matchId)!);
  if(!scope.startsWith(quarter+':'))continue;
  const format=scope.endsWith(':singles')?'singles':scope.endsWith(':doubles')?'doubles':null;
  if(format)latest.set(game.playerId,format);
 }
 return latest;
}
/** Keep only the live format's count, so the avatar never mixes a fresh loss with an older win in another format. */
export function liveStreak(streak:WinningStreaks|undefined,format:'singles'|'doubles'|undefined):WinningStreaks{
 if(!streak||!format)return {singles:0,doubles:0};
 return format==='singles'?{singles:streak.singles,doubles:0}:{singles:0,doubles:streak.doubles};
}
