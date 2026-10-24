/** 40 average Elo points corresponds to roughly a 56/44 expected result.
 * Within this band prefer variety. An exact rematch carries a bounded extra
 * 80-point cost, as does reusing the same group of players: modest strength
 * differences must not force the same game or four-player cohort forever.
 * Ranking points never enter this calculation. The only profile field used is a declared gender, and only to avoid
 * a pair of men facing a pair of women or a much weaker woman (`genderMismatches`), which outranks every other preference.
 */
export const BALANCE_TOLERANCE = 40;
/** Live rotating doubles may trade a small strength difference for new partners, never an unlimited one. */
export const LIVE_PARTNER_PENALTY_LIMIT = 40;
export type BalanceCost = { mismatches:number; worstExcess:number; totalExcess:number; variety:number; rematches:number; cohorts:number; partnerPenalty:number };
export function balanceCost(gaps:number[],variety:number,mismatches=0,rematches=0,cohorts=0,partnerPenalty=0):BalanceCost {
 const excess=gaps.map(gap=>Math.max(0,gap-BALANCE_TOLERANCE));
 // An impossible line-up (infinite gap) must never win because it happens to have no gender mismatch.
 return {mismatches:excess.some(n=>n===Infinity)?Infinity:mismatches,worstExcess:Math.max(0,...excess),totalExcess:excess.reduce((sum,n)=>sum+n,0),variety,rematches,cohorts,partnerPenalty:Math.max(0,Math.min(LIVE_PARTNER_PENALTY_LIMIT,partnerPenalty))};
}
export function compareBalance(a:BalanceCost,b:BalanceCost) {
 const adjusted=(c:BalanceCost)=>c.worstExcess+c.partnerPenalty+(c.rematches>0?80:0)+(c.cohorts>0?80:0);
 return (a.mismatches===b.mismatches?0:a.mismatches-b.mismatches) || adjusted(a)-adjusted(b) || a.totalExcess-b.totalExcess || a.cohorts-b.cohorts || a.rematches-b.rematches || a.variety-b.variety;
}
