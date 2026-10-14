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
export type AvatarStreak={winningStreak:WinningStreaks;losingStreak:WinningStreaks};
/** One pass for the avatar signs: the current-quarter winning and losing runs per format, kept only for the format
 * of the player's most recent rated game (the live state). Same rated sequence, order and quarter scope as the
 * season-point streaks; a win resets the losing run and a loss resets the winning run. */
export function activeAvatarStreaks(games:RatedGame[],matches:Map<string,Match>,quarter:string){
 const runs=new Map<string,{singles:{wins:number;losses:number};doubles:{wins:number;losses:number};latest:'singles'|'doubles'}>();
 for(const game of [...games].sort(replayOrder)){
  const scope=seasonGameScope(game,matches.get(game.matchId)!);
  if(!scope.startsWith(quarter+':'))continue;
  const format=scope.endsWith(':singles')?'singles':scope.endsWith(':doubles')?'doubles':null;
  if(!format)continue;
  const run=runs.get(game.playerId)??{singles:{wins:0,losses:0},doubles:{wins:0,losses:0},latest:format};
  const current=run[format];if(game.won){current.wins++;current.losses=0}else{current.losses++;current.wins=0}
  run.latest=format;runs.set(game.playerId,run);
 }
 const result=new Map<string,AvatarStreak>();
 for(const [playerId,run] of runs){
  const only=(count:number):WinningStreaks=>run.latest==='singles'?{singles:count,doubles:0}:{singles:0,doubles:count};
  result.set(playerId,{winningStreak:only(run[run.latest].wins),losingStreak:only(run[run.latest].losses)});
 }
 return result;
}
