/** Anchor the one-time policy to the deployed version, never a browser-supplied time. */
export function coinRewardStart(timestamp:unknown,now:number){
 const parsed=typeof timestamp==='string'?Date.parse(timestamp):NaN;
 return Number.isFinite(parsed)&&parsed>0&&parsed<=now?parsed:now;
}
