/** 40 average Elo points corresponds to roughly a 56/44 expected result.
 * Within this band prefer variety; outside it balance takes priority.
 * Profile declarations and ranking points never enter this calculation.
 */
export const BALANCE_TOLERANCE = 40;
export type BalanceCost = { worstExcess:number; totalExcess:number; variety:number };
export function balanceCost(gaps:number[],variety:number):BalanceCost {
 const excess=gaps.map(gap=>Math.max(0,gap-BALANCE_TOLERANCE));
 return {worstExcess:Math.max(0,...excess),totalExcess:excess.reduce((sum,n)=>sum+n,0),variety};
}
export function compareBalance(a:BalanceCost,b:BalanceCost) {
 return a.worstExcess-b.worstExcess || a.totalExcess-b.totalExcess || a.variety-b.variety;
}
