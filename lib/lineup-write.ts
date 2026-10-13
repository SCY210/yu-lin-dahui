/** Only commands with a displayed-lineup snapshot can safely rebase on unrelated writes.
 * A score carries the lineup and the games its form opened with, so scores on other courts never block it. */
export function canRebaseLineupWrite(action:string,payload:unknown){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return false;
 const value=payload as Record<string,unknown>;
 return action==='liveLineup'?Array.isArray(value.expectedA)&&Array.isArray(value.expectedB)
  :action==='score'?Array.isArray(value.expectedA)&&Array.isArray(value.expectedB)&&Array.isArray(value.expectedGames)
  :action==='swap'&&Array.isArray(value.expectedLineup);
}
