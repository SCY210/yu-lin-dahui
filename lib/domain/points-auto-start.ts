import {eventStatusAt} from './event-lifecycle';
import {isPractice} from './match-format';
import {canEnableEventRanking,eventRankingEnabled} from './event-ranking';
import {pointsSession} from './points-attendance';
import {pointsWindow} from './points-window';
import {schedulingMode} from './scheduling';
import {fillLiveCourts} from './live-play';
import type {State,Account,Round} from './types';

type Runner=(s:State,a:Account,action:string,input:unknown,now:number)=>Promise<unknown>;
/** Reconcile only an ongoing activity on a server read/write. Never replay
 * ended history, publish an unconfirmed draft, or restart paused live play. */
export async function startDuePointsSessions(s:State,now:number,run:Runner){
 let changed=false;
 for(const original of s.events){
  const window=pointsWindow(original);
  if(original.deletedAt!==undefined||isPractice(original)||original.tournament||!['open','locked','live'].includes(eventStatusAt(original,now))||now<Math.max(original.start,window.start)||now>=original.end)continue;
  const actor=eventRankingEnabled(original)?s.accounts.find(a=>canEnableEventRanking(s,a)):s.accounts.find(a=>a.id===original.creatorId)??s.accounts.find(a=>a.role==='admin');
  if(!actor)continue;
  const work=structuredClone(s),e=work.events.find(e=>e.id===original.id)!;
  e.pointsSession??=pointsSession();
  const first=!e.pointsSession.startedAt;
  if(first){
   e.pointsSession.startedAt=Math.max(e.start,window.start);
   work.audits.push({id:crypto.randomUUID(),at:now,actor:'system:points-clock',action:'pointsAutoStart',reason:'积分赛时段到达，自动开始',changes:{eventId:e.id,startedAt:e.pointsSession.startedAt}});
  }
  let started=false;
  const mode=schedulingMode(work,e),playing=work.matches.some(m=>m.eventId===e.id&&m.status==='playing');
  const attempt=structuredClone(work),event=attempt.events.find(x=>x.id===e.id)!;
  const beforeAudits=attempt.audits.length;
  try{
   if(mode==='live'){
    // Respect an explicit pause; live mode selection otherwise enables itself.
    // Refill empty courts as booking/arrival times advance, even without a write.
    if(!event.livePlay?.enabled&&!event.livePlay?.paused){
     await run(attempt,actor,'liveStart',{eventId:e.id},now);started=true;
    }else if(event.livePlay?.enabled&&!event.livePlay.paused){
     const count=attempt.matches.length;fillLiveCourts(attempt,event,now);
     if(attempt.matches.length>count){
      started=true;attempt.audits.push({id:crypto.randomUUID(),at:now,actor:'system:points-clock',action:'pointsAutoFill',reason:'到场或场地时段开始，自动补排空场',changes:{eventId:e.id,matchIds:attempt.matches.slice(count).map(m=>m.id)}});
     }
    }
   }else if(!playing){
    let next:Round|undefined=attempt.rounds.filter(r=>r.eventId===e.id&&['draft','published'].includes(r.status)).sort((a,b)=>(a.pointsSlot??0)-(b.pointsSlot??0)||a.start-b.start)[0];
    if(mode==='round'&&!next&&!attempt.rounds.some(r=>r.eventId===e.id)){
     const duration=Math.min(15,Math.floor((e.end-now)/60000));
     if(duration>=5){
      await run(attempt,actor,'generate',{eventId:e.id,at:now,duration,seed:1},now);
      next=attempt.rounds.find(r=>r.eventId===e.id&&r.status==='draft');
      if(next)await run(attempt,actor,'publish',{roundId:next.id},now);
     }
    }
    if(next?.status==='published'&&next.start<=now){
     await run(attempt,actor,'start',{roundId:next.id,at:now,monthly:true,elo:true},now);started=true;
    }
   }
  }catch{
   // Availability can change after publication (late arrivals, stopped players,
   // expired bookings). Keep the confirmed lineup for adjustment/early scoring;
   // do not partially generate, publish or falsify a match result.
   started=false;
  }
  if(started){
   attempt.audits.slice(beforeAudits).forEach(a=>{a.actor='system:points-clock'});
   Object.assign(s,attempt);changed=true;
  }else if(first){Object.assign(s,work);changed=true}
 }
 return changed;
}
