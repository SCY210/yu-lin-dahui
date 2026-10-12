/** Only commands with a displayed-lineup snapshot can safely rebase on unrelated writes. */
export function canRebaseLineupWrite(action:string,payload:unknown){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return false;
 const value=payload as Record<string,unknown>;
 return action==='liveLineup'?Array.isArray(value.expectedA)&&Array.isArray(value.expectedB)
  :action==='swap'&&Array.isArray(value.expectedLineup);
}
