import type {RatedGame} from './realm-rating';

/** 赛季积分, separate from 修为: the loser of a rated game gets `loss`, the winner `win`, plus an upset bonus when
 * the winners' average 修为 before the game was at least `gap` below the opponents'. */
export const seasonPointsPolicy={win:3,loss:-1,upsets:[{gap:150,bonus:2},{gap:50,bonus:1}]} as const;
export function upsetBonus(g:Pick<RatedGame,'won'|'team'|'opponent'>){if(!g.won)return 0;const gap=g.opponent-g.team;return seasonPointsPolicy.upsets.find(u=>gap>=u.gap)?.bonus??0}
export function gamePoints(g:Pick<RatedGame,'won'|'team'|'opponent'>){return (g.won?seasonPointsPolicy.win:seasonPointsPolicy.loss)+upsetBonus(g)}
