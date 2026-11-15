/** 40 average Elo points corresponds to roughly a 56/44 expected result.
 * Within this band prefer variety. An exact rematch carries a bounded extra
 * 80-point cost, as does reusing the same group of players: modest strength
 * differences must not force the same game or four-player cohort forever.
 * Ranking points never enter this calculation. Declared gender supplies `genderMismatches`, which outranks every
 * other preference. Live doubles compares the gap outside this band before preferring the same doubles category and rotating roles.
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
export type BalanceCost = { mismatches:number; newbieExposure:number; liveMixedRepeats:number; liveTypeMismatch:number; worstExcess:number; totalExcess:number; variety:number; rematches:number; cohorts:number; partnerPenalty:number; courtWaits:number; blocks:number; recentPartners:number };
/** 萌新 (docs/MATCH_GROUPING_NEWBIES.md): a player whose strength is below 850, 炼气 members and friends signed up as 萌新. */
export const NEWBIE_BELOW=850;
/** What one step of newbieExposure costs, in rating points like the other costs: a 萌新 with a 1500 player (13 steps)
 * outweighs a rematch (80) or a block (120), so it is avoided first, but repeats still count against it. */
export const NEWBIE_COST=10;
/** The whole lineup's 萌新 cost stays below this, under a block (BLOCK_COST 120): keeping 萌新 away from the strong never
 * brings three players straight back from one game. It still grows with every step, so less is always better. */
export const NEWBIE_MAX_COST=110;
const newbieCost=(steps:number)=>NEWBIE_MAX_COST*(1-Math.exp(-steps*NEWBIE_COST/NEWBIE_MAX_COST));
/** How much a game puts 萌新 with stronger players: for each 萌新, every other player at 850 or above adds one per 50
 * points above 850, so the stronger they are the more it costs. A women's doubles game costs half: a 萌新 woman may go
 * there. Zero without a 萌新. Weighed with the strength gap and repeat costs (NEWBIE_COST) after gender, so 萌新 play
 * the lower-rated players and the strong play each other; it never decides who plays (AGENTS.md B1-B3). */
export function newbieExposure(ids:readonly string[],rating:(id:string)=>number,female?:(id:string)=>boolean){
 let sum=0;
 for(const n of ids)if(rating(n)<NEWBIE_BELOW)for(const o of ids)if(o!==n&&rating(o)>=NEWBIE_BELOW)sum+=Math.round((rating(o)-NEWBIE_BELOW)/50);
 return sum&&female&&ids.length===4&&ids.every(female)?sum/2:sum;
}
export function balanceCost(gaps:number[],variety:number,mismatches=0,rematches=0,cohorts=0,partnerPenalty=0,courtWaits=0,blocks=0,recentPartners=0,liveMixedRepeats=0,liveTypeMismatch=0,newbieExposure=0):BalanceCost {
 const excess=gaps.map(gap=>Math.max(0,gap-BALANCE_TOLERANCE));
 // An impossible line-up (infinite gap) must never win because it happens to have no gender mismatch.
 return {mismatches:excess.some(n=>n===Infinity)?Infinity:mismatches,newbieExposure,liveMixedRepeats,liveTypeMismatch,worstExcess:Math.max(0,...excess),totalExcess:excess.reduce((sum,n)=>sum+n,0),variety,rematches,cohorts,partnerPenalty:Math.max(0,Math.min(LIVE_PARTNER_PENALTY_LIMIT,partnerPenalty)),courtWaits,blocks,recentPartners};
}
export function compareBalance(a:BalanceCost,b:BalanceCost) {
 const adjusted=(c:BalanceCost)=>newbieCost(c.newbieExposure)+c.worstExcess+c.partnerPenalty+(c.rematches>0?80:0)+(c.cohorts>0?80:0)+c.courtWaits*COURT_WAIT_COST+c.blocks*BLOCK_COST+c.recentPartners*RECENT_PARTNER_COST;
 return (a.mismatches===b.mismatches?0:a.mismatches-b.mismatches) || adjusted(a)-adjusted(b) || a.totalExcess-b.totalExcess || a.cohorts-b.cohorts || a.rematches-b.rematches || a.variety-b.variety;
}

/** The priorities a live doubles partner draw must also respect. */
export function compareLiveDoublesPriority(a:BalanceCost,b:BalanceCost) {
 return (a.mismatches===b.mismatches?0:a.mismatches-b.mismatches)
  || (a.worstExcess===b.worstExcess?0:a.worstExcess-b.worstExcess)
  || a.liveTypeMismatch-b.liveTypeMismatch
  || a.liveMixedRepeats-b.liveMixedRepeats;
}

export function compareLiveDoublesBalance(a:BalanceCost,b:BalanceCost) {
 return compareLiveDoublesPriority(a,b) || compareBalance(a,b);
}
