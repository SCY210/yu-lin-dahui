/** A one-shot request to open one match's score form once its card renders (docs/JUMP_TO_MATCH.md). It is kept out of the
 * URL and browser history on purpose: a score form pushes its own history entry, so a request stored there would come
 * back when the form closes, and on every refresh. */
let pending='',expiry:ReturnType<typeof setTimeout>|undefined;
const listeners=new Set<()=>void>();
const notify=()=>{for(const f of listeners)f()};
/** A request no card picks up (the match is gone, or this account may not score it) lapses after a few seconds, so it
 * never opens a form later by surprise. */
export function requestMatchScore(matchId:string){pending=matchId;notify();clearTimeout(expiry);expiry=setTimeout(()=>clearMatchScore(matchId),8000);(expiry as {unref?:()=>void}).unref?.()}
export function clearMatchScore(matchId:string){if(pending===matchId){pending='';notify()}}
export const pendingMatchScore=()=>pending;
export function subscribeMatchScore(f:()=>void){listeners.add(f);return()=>{listeners.delete(f)}}
