import type {Rules} from './types';

/** Points to win a game at a points match or ordinary activity: 21 (the club's season rules) or 15. A 15-point game
 * still needs a two-point lead after 14:14 and ends at 21 (21:20), as a competition's 15-point rule does
 * (scoringCap in lib/domain/tournament.ts). Competitions keep their own scoring rule (docs/GAME_POINTS.md). */
export type GamePoints=15|21;
export const gamePointsOptions:[string,string][]=[['21','21 分制 · 封顶 30 分'],['15','15 分制 · 封顶 21 分']];
export const eventGamePoints=(e:{gamePoints?:GamePoints}|undefined):GamePoints=>e?.gamePoints===15?15:21;
/** Half rewards apply to fifteen-point activities ending at or after this moment (owner's instruction, 2026-11-10).
 * Activities that ended earlier keep their original points and coins; nothing is recalculated for them. */
export const fifteenPointHalfFrom=Date.parse('2026-11-10T11:00:00+01:00');
/** Fifteen-point ranked activities earn half positive rewards; deductions and Elo are unchanged. */
export const positiveRewardFactor=(e:{gamePoints?:GamePoints;tournament?:unknown;ranked?:boolean;end?:number}|undefined):1|0.5=>e?.gamePoints===15&&!e.tournament&&e.ranked!==false&&(e.end===undefined||e.end>=fifteenPointHalfFrom)?0.5:1;
/** The season's rules, with the target and cap of a 15-point activity. */
export function eventScoreRules(rules:Rules,e:{gamePoints?:GamePoints}|undefined):Rules{
 return eventGamePoints(e)===15?{...rules,target:15,ceiling:21}:rules;
}
