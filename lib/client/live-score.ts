'use client';
import {useEffect,useRef,useState} from 'react';
import type {LiveOp,LiveScore} from '../domain/live-score';

async function parse(response:Response):Promise<{error?:unknown;score:LiveScore;scores:LiveScore[]}>{
 type Body={error?:unknown;score:LiveScore;scores:LiveScore[]};const data=await response.json().catch(()=>({})) as Body;
 if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:'暂时无法连接，请重试');
 return data;
}
/** One referee operation (app/api/live-score/route.ts). */
export async function sendLiveOp(op:LiveOp):Promise<LiveScore>{
 return (await parse(await fetch('/api/live-score',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(op),signal:AbortSignal.timeout(8000)}))).score;
}
export async function fetchLiveScores(eventId:string):Promise<LiveScore[]>{
 return (await parse(await fetch('/api/live-score?eventId='+encodeURIComponent(eventId),{cache:'no-store',signal:AbortSignal.timeout(8000)}))).scores;
}

/** Live scores of a competition, refreshed every `every` ms while the page is visible. `put` merges a newer score
 * from the referee's own operations without waiting for the next poll. */
export function useLiveScores(eventId:string,every=2000){
 const [scores,setScores]=useState<Record<string,LiveScore>>({}),[error,setError]=useState('');
 const alive=useRef(true);
 const put=(score:LiveScore)=>setScores(current=>(current[score.matchId]?.version??-1)>=score.version?current:{...current,[score.matchId]:score});
 useEffect(()=>{
  alive.current=true;let timer:ReturnType<typeof setTimeout>|undefined;
  const tick=async()=>{
   if(document.visibilityState==='visible'){
    try{const list=await fetchLiveScores(eventId);if(!alive.current)return;setError('');setScores(current=>{const next={...current};for(const s of list)if((next[s.matchId]?.version??-1)<=s.version)next[s.matchId]=s;return next})}
    catch(e){if(alive.current)setError(e instanceof Error?e.message:'比分暂时无法更新')}
   }
   if(alive.current)timer=setTimeout(tick,every);
  };
  void tick();
  return ()=>{alive.current=false;if(timer)clearTimeout(timer)};
 },[eventId,every]);
 return {scores,error,put};
}

/** Ticks once a second, for match clocks. */
export function useSecondClock(){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(id)},[]);
 return now;
}
export const clock=(ms:number)=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
