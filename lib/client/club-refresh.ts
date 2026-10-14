type RefreshPort={refresh:()=>Promise<unknown>;available:()=>boolean;schedule:(callback:()=>void,delay:number)=>unknown;cancel:(timer:unknown)=>void};
export type RefreshPolicy={base:number;maximum:number;version:(result:unknown)=>string|null};

/** A live match stays at 3 seconds. Quiet browsing backs off only after successful unchanged reads. */
export function createRefreshDelay(policy:RefreshPolicy){
 let previous:string|null=null,quiet=0,failures=0;
 return {
  reset(){previous=null;quiet=0;failures=0},
  next(result:unknown,failed=false){
   if(failed||result===undefined){quiet=0;return Math.min(60000,policy.base*2**Math.min(++failures,6))}
   failures=0;const version=policy.version(result);
   quiet=version!==null&&version===previous?quiet+1:0;previous=version;
   return Math.min(policy.maximum,policy.base*2**Math.min(Math.floor(quiet/2),3));
  },
 };
}

/** One request at a time, with a quiet background and one refresh on returning. */
export function createClubRefresh(port:RefreshPort,interval:number|RefreshPolicy=15000){
 let stopped=false,running=false,pending=false,timer:unknown=null;
 const adaptive=typeof interval==='number'?null:createRefreshDelay(interval);
 const clear=()=>{if(timer!==null)port.cancel(timer);timer=null};
 const run=async()=>{
  if(stopped)return;
  if(running){pending=true;return}
  clear();running=true;
  let result:unknown,failed=false;
  try{result=await port.refresh()}catch{failed=true;/* The caller displays the connection status. */}
  finally{
   running=false;
   if(stopped||!port.available()){pending=false;return}
   if(pending){pending=false;void run()}else timer=port.schedule(()=>{timer=null;if(port.available())void run()},adaptive?adaptive.next(result,failed):interval as number);
  }
 };
 void run(); // Load once even when opened in the background.
 return {
  wake(){clear();adaptive?.reset();if(port.available())void run();else pending=false},
  stop(){stopped=true;pending=false;clear()},
 };
}
