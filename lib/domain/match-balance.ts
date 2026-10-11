/** 40 average Elo points corresponds to roughly a 56/44 expected result.
 * Within this band prefer variety; outside it balance takes priority.
 * Ranking points never enter this calculation. The only profile field used is a declared gender, and only to avoid
 * a pair of much stronger men facing a woman (`genderMismatches`), which outranks every other preference.
 */
export const BALANCE_TOLERANCE = 40;
export type BalanceCost = { mismatches:number; worstExcess:number; totalExcess:number; variety:number };
export function balanceCost(gaps:number[],variety:number,mismatches=0):BalanceCost {
 const excess=gaps.map(gap=>Math.max(0,gap-BALANCE_TOLERANCE));
 // An impossible line-up (infinite gap) must never win because it happens to have no gender mismatch.
 return {mismatches:excess.some(n=>n===Infinity)?Infinity:mismatches,worstExcess:Math.max(0,...excess),totalExcess:excess.reduce((sum,n)=>sum+n,0),variety};
}
export function compareBalance(a:BalanceCost,b:BalanceCost) {
 return (a.mismatches===b.mismatches?0:a.mismatches-b.mismatches) || a.worstExcess-b.worstExcess || a.totalExcess-b.totalExcess || a.variety-b.variety;
}
