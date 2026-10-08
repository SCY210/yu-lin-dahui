type Fetcher=(input:string,init?:RequestInit)=>Promise<Response>;
type Wait=(ms:number)=>Promise<void>;
const pause:Wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** iOS home-screen apps often fail the first request after waking from the
 * background ("Load failed"). Retry a network failure once; HTTP responses are
 * returned as they are. The server de-duplicates writes per account and
 * requestId, so a write may only be resent while `canRetry` confirms the same
 * signed-in account is still on this page; it is checked before and after the pause. */
export async function fetchWithWakeRetry(input:string,init?:RequestInit,{retries=1,delay=700,fetcher=(...args:Parameters<Fetcher>)=>fetch(...args),wait=pause,canRetry=()=>true}:{retries?:number;delay?:number;fetcher?:Fetcher;wait?:Wait;canRetry?:()=>boolean}={}){
 const allowed=()=>!init?.signal?.aborted&&canRetry();
 for(let attempt=0;;attempt++){
  try{return await fetcher(input,init)}
  catch(error){
   if(attempt>=retries||!allowed())throw error;
   await wait(delay);
   if(!allowed())throw error;
  }
 }
}

/** A lazily loaded screen whose file disappeared because a new version was deployed. */
export function isChunkLoadError(error:unknown){
 const message=error instanceof Error?error.message:String(error??'');
 return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(message);
}

type Store={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void};
const reloadKey='yulin-version-reload';

/** Reload into the new version at most once a minute, so a broken deployment never loops.
 * Without storage the guard cannot hold, so the caller shows a manual refresh instead. */
export function reloadOnceForNewVersion(storage:Store|null,reload:()=>void,now=Date.now()){
 try{
  if(!storage)return false;
  const last=Number(storage.getItem(reloadKey));
  if(Number.isFinite(last)&&now-last<60000)return false;
  storage.setItem(reloadKey,String(now));
 }catch{return false}
 reload();
 return true;
}

export function sessionStore():Store|null{try{return window.sessionStorage}catch{return null}}
