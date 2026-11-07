/** 40 average Elo points corresponds to roughly a 56/44 expected result.
 * Within this band prefer variety. An exact rematch carries a bounded extra
 * 80-point cost, as does reusing the same group of players: modest strength
 * differences must not force the same game or four-player cohort forever.
 * Ranking points never enter this calculation. Declared gender supplies `genderMismatches`, which outranks every
 * other preference. Live play then rotates the mixed-v-men role after two consecutive individual appearances;
 * other scheduling modes leave `liveMixedRepeats` at zero and keep their existing balance order.
 */
export const BALANCE_TOLERANCE = 40;
/** Live rotating doubles may trade a small strength difference for new partners, never an unlimited one. */
export const LIVE_PARTNER_PENALTY_LIMIT = 40;
/** Planned rounds: each court whose next game must also wait for another court's previous game costs this much. */
export const COURT_WAIT_COST = 40;
/** Planned rounds: an immediate partner repeat costs more than a court wait, so avoiding waits never re-pairs partners. */
export const RECENT_PARTNER_COST = 60;
/** Planned rounds: a court taking three or more players straight from one earlier game costs more than any court wait. */
export const BLOCK_COST = 120;
export type BalanceCost = { mismatches:number; liveMixedRepeats:number; worstExcess:number; totalExcess:number; variety:number; rematches:number; cohorts:number; partnerPenalty:number; courtWaits:number; blocks:number; recentPartners:number };
export function balanceCost(gaps:number[],variety:number,mismatches=0,rematches=0,cohorts=0,partnerPenalty=0,courtWaits=0,blocks=0,recentPartners=0,liveMixedRepeats=0):BalanceCost {
 const excess=gaps.map(gap=>Math.max(0,gap-BALANCE_TOLERANCE));
 // An impossible line-up (infinite gap) must never win because it happens to have no gender mismatch.
 return {mismatches:excess.some(n=>n===Infinity)?Infinity:mismatches,liveMixedRepeats,worstExcess:Math.max(0,...excess),totalExcess:excess.reduce((sum,n)=>sum+n,0),variety,rematches,cohorts,partnerPenalty:Math.max(0,Math.min(LIVE_PARTNER_PENALTY_LIMIT,partnerPenalty)),courtWaits,blocks,recentPartners};
}
export function compareBalance(a:BalanceCost,b:BalanceCost) {
 const adjusted=(c:BalanceCost)=>c.worstExcess+c.partnerPenalty+(c.rematches>0?80:0)+(c.cohorts>0?80:0)+c.courtWaits*COURT_WAIT_COST+c.blocks*BLOCK_COST+c.recentPartners*RECENT_PARTNER_COST;
 return (a.mismatches===b.mismatches?0:a.mismatches-b.mismatches) || a.liveMixedRepeats-b.liveMixedRepeats || adjusted(a)-adjusted(b) || a.totalExcess-b.totalExcess || a.cohorts-b.cohorts || a.rematches-b.rematches || a.variety-b.variety;
}
