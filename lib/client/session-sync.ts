type SessionMessageEvent={data:unknown};
export type SessionChannel={
 postMessage:(message:unknown)=>void;
 addEventListener:(type:'message',listener:(event:SessionMessageEvent)=>void)=>void;
 removeEventListener:(type:'message',listener:(event:SessionMessageEvent)=>void)=>void;
 close:()=>void;
};
const channelName='yulin-session-change';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Separate channel objects in one tab also receive each other's broadcasts.
// Remember our random event IDs so only other tabs invalidate their state.
const ownEvents=new Set<string>();
const remember=(set:Set<string>,id:string)=>{set.add(id);if(set.size>128)set.delete(set.values().next().value!)};
function isSessionChange(value:unknown):value is {type:'session-change';id:string}{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const message=value as Record<string,unknown>;
 return Object.keys(message).length===2&&message.type==='session-change'&&typeof message.id==='string'&&uuid.test(message.id);
}
function browserChannel():SessionChannel|null{
 try{return typeof BroadcastChannel==='undefined'?null:new BroadcastChannel(channelName)}catch{return null}
}

/** Messages only invalidate local state. Identity is always rechecked by the
 * server; no account identifiers, credentials, or cached profiles cross tabs. */
export function createSessionSync({channel,onChange,createId=()=>crypto.randomUUID()}:{channel:SessionChannel|null;onChange:()=>void;createId?:()=>string}){
 let stopped=false;
 const seen=new Set<string>();
 const receive=(event:SessionMessageEvent)=>{
  if(stopped||!isSessionChange(event.data)||seen.has(event.data.id)||ownEvents.has(event.data.id))return;
  remember(seen,event.data.id);onChange();
 };
 channel?.addEventListener('message',receive);
 return {
  notify(){
   if(stopped||!channel)return;
   try{const id=createId();if(!uuid.test(id))return;remember(seen,id);remember(ownEvents,id);channel.postMessage({type:'session-change',id})}catch{/* Unavailable channels must not interrupt successful authentication. */}
  },
  stop(){
   if(stopped)return;stopped=true;seen.clear();
   try{channel?.removeEventListener('message',receive)}catch{}finally{try{channel?.close()}catch{}}
  },
 };
}
export function listenForSessionChanges(onChange:()=>void){return createSessionSync({channel:browserChannel(),onChange})}
export function notifySessionChange(){const sync=createSessionSync({channel:browserChannel(),onChange:()=>{}});sync.notify();sync.stop()}
