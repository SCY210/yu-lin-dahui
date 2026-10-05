type RefreshPort={refresh:()=>Promise<unknown>;available:()=>boolean;schedule:(callback:()=>void,delay:number)=>unknown;cancel:(timer:unknown)=>void};

/** One request at a time, with a quiet background and one refresh on returning. */
export function createClubRefresh(port:RefreshPort,interval=15000){
 let stopped=false,running=false,pending=false,timer:unknown=null;
 const clear=()=>{if(timer!==null)port.cancel(timer);timer=null};
 const run=async()=>{
  if(stopped)return;
  if(running){pending=true;return}
  clear();running=true;
  try{await port.refresh()}catch{/* The caller displays the connection status. */}
  finally{
   running=false;
   if(stopped||!port.available()){pending=false;return}
   if(pending){pending=false;void run()}else timer=port.schedule(()=>{timer=null;if(port.available())void run()},interval);
  }
 };
 void run(); // Load once even when opened in the background.
 return {
  wake(){clear();if(port.available())void run();else pending=false},
  stop(){stopped=true;pending=false;clear()},
 };
}
