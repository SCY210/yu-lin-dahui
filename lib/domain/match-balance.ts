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
/** 实力碾压 (November 2026, docs/MATCH_GROUPING.md): a game whose two teams' average ratings differ by more than this
 * (about 61/39 expected) is avoided before every preference but gender protection, unless no line-up avoids it. */
export const CRUSH_GAP = 80;
/** 同一批人: each earlier game of this activity that two players of a court shared costs this much per pair, so people
 * who keep landing on one court are split up after crush avoidance (docs/MATCH_GROUPING.md). */
export const TOGETHER_COST = 8;
/** Planned rounds: each court whose next game must also wait for another court's previous game costs this much. */
export const COURT_WAIT_COST = 40;
/** Planned rounds: an immediate partner repeat costs more than a court wait, so avoiding waits never re-pairs partners. */
export const RECENT_PARTNER_COST = 60;
/** Planned rounds: a court taking three or more players straight from one earlier game costs more than any court wait. */
export const BLOCK_COST = 120;
export type BalanceCost = { mismatches:number; crush:number; together:number; newbieExposure:number; liveMixedRepeats:number; liveTypeMismatch:number; worstExcess:number; totalExcess:number; variety:number; rematches:number; cohorts:number; partnerPenalty:number; courtWaits:number; blocks:number; recentPartners:number };
/** 萌新 (docs/MATCH_GROUPING_NEWBIES.md): a player whose strength is below 850, 炼气 members and friends signed up as 萌新. */
export const NEWBIE_BELOW=850;
/** How much a game puts 萌新 with stronger players: for each 萌新, every other player at 850 or above adds one per 50
 * points above 850, so the stronger they are the more it costs. A women's doubles game costs half: a 萌新 woman may go
 * there. Zero without a 萌新. Since November 2026 it is the last preference (the club: 「其他条件满足的前提下尽量满足」): only
 * between line-ups equal in crush avoidance, repeats, who meets whom and balance do 萌新 play the lower-rated players;
 * it never decides who plays (AGENTS.md B1-B3). */
export function newbieExposure(ids:readonly string[],rating:(id:string)=>number,female?:(id:string)=>boolean){
 let sum=0;
 for(const n of ids)if(rating(n)<NEWBIE_BELOW)for(const o of ids)if(o!==n&&rating(o)>=NEWBIE_BELOW)sum+=Math.round((rating(o)-NEWBIE_BELOW)/50);
 return sum&&female&&ids.length===4&&ids.every(female)?sum/2:sum;
}
export function balanceCost(gaps:number[],variety:number,mismatches=0,rematches=0,cohorts=0,partnerPenalty=0,courtWaits=0,blocks=0,recentPartners=0,liveMixedRepeats=0,liveTypeMismatch=0,newbieExposure=0,together=0):BalanceCost {
 const excess=gaps.map(gap=>Math.max(0,gap-BALANCE_TOLERANCE));
 const crush=gaps.reduce((sum,gap)=>sum+Math.max(0,gap-CRUSH_GAP),0);
 // An impossible line-up (infinite gap) must never win because it happens to have no gender mismatch.
 return {mismatches:excess.some(n=>n===Infinity)?Infinity:mismatches,crush,together,newbieExposure,liveMixedRepeats,liveTypeMismatch,worstExcess:Math.max(0,...excess),totalExcess:excess.reduce((sum,n)=>sum+n,0),variety,rematches,cohorts,partnerPenalty:Math.max(0,Math.min(LIVE_PARTNER_PENALTY_LIMIT,partnerPenalty)),courtWaits,blocks,recentPartners};
}
/** Order (the club, November 2026): gender protection, then no 实力碾压 (gaps above CRUSH_GAP), then repeats, the same
 * people on one court, court waits and the gap above the 40-point band together, then the total gap, partner and
 * opponent variety, and last keeping 萌新 away from the strong. Who plays is decided before, by fair turns. */
export function compareBalance(a:BalanceCost,b:BalanceCost) {
 const adjusted=(c:BalanceCost)=>c.worstExcess+c.partnerPenalty+(c.rematches>0?80:0)+(c.cohorts>0?80:0)+c.courtWaits*COURT_WAIT_COST+c.blocks*BLOCK_COST+c.recentPartners*RECENT_PARTNER_COST+c.together*TOGETHER_COST;
 return (a.mismatches===b.mismatches?0:a.mismatches-b.mismatches) || (a.crush===b.crush?0:a.crush-b.crush) || adjusted(a)-adjusted(b) || a.totalExcess-b.totalExcess || a.cohorts-b.cohorts || a.rematches-b.rematches || a.variety-b.variety || a.newbieExposure-b.newbieExposure;
}

/** The priorities a live doubles partner draw must also respect. */
export function compareLiveDoublesPriority(a:BalanceCost,b:BalanceCost) {
 return (a.mismatches===b.mismatches?0:a.mismatches-b.mismatches)
  || (a.crush===b.crush?0:a.crush-b.crush)
  || (a.worstExcess===b.worstExcess?0:a.worstExcess-b.worstExcess)
  || a.liveTypeMismatch-b.liveTypeMismatch
  || a.liveMixedRepeats-b.liveMixedRepeats;
}

export function compareLiveDoublesBalance(a:BalanceCost,b:BalanceCost) {
 return compareLiveDoublesPriority(a,b) || compareBalance(a,b);
}
