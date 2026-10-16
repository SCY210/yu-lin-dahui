import {eventStatusAt} from './event-lifecycle';
import {eventFormat,isPractice} from './match-format';
import {canEnableEventRanking,eventRankingEnabled} from './event-ranking';
import {pointsSession} from './points-attendance';
import {automaticPlanInput,pointsWindow} from './points-window';
import {schedulingMode} from './scheduling';
import {fillLiveCourts,hasEmptyLiveCourt,livePresentIds} from './live-play';
import {advanceScheduledCourts,scheduledCourtProgress} from './scheduled-courts';
import type {State,Account,Round,Event} from './types';

type Runner=(s:State,a:Account,action:string,input:unknown,now:number)=>Promise<unknown>;
/** What automatic planning depends on: who is present now, the confirmed signups and the courts. A planned activity
 * without a schedule is planned again only when one of them changed, so a failed attempt (too few players) does not
 * repeat its work on every read. */
function autoPlanKey(s:State,e:Event,now:number){
 return JSON.stringify([livePresentIds(s,e,now),s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed').map(r=>[r.playerId,r.arrival,r.departure,r.bookingSignups?.map(x=>[x.bookingId,x.status,x.arrival,x.departure])??null]),s.bookings.filter(b=>b.eventId===e.id).map(b=>[b.id,b.start,b.end]),e.start,e.end]);
}
// Only an activity that never had any round: cancelling a schedule on purpose is not undone by a new signup.
const awaitsPlan=(s:State,e:Event,mode:string)=>mode==='planned'&&e.playMode!=='arena'&&!s.rounds.some(r=>r.eventId===e.id);
/** Reconcile only an ongoing activity on a server read/write. Never replay
 * ended history, publish an unconfirmed draft, or restart paused live play. */
export async function startDuePointsSessions(s:State,now:number,run:Runner){
 let changed=false;
 for(const original of s.events){
  const window=pointsWindow(original);
  if(original.deletedAt!==undefined||isPractice(original)||original.tournament||!['open','locked','live'].includes(eventStatusAt(original,now))||now<Math.max(original.start,window.start)||now>=original.end)continue;
  const actor=eventRankingEnabled(original)?s.accounts.find(a=>canEnableEventRanking(s,a)):s.accounts.find(a=>a.id===original.creatorId)??s.accounts.find(a=>a.role==='admin');
  if(!actor)continue;
  const mode=schedulingMode(s,original),planKey=awaitsPlan(s,original,mode)?autoPlanKey(s,original,now):null;
  // Cloning the complete history twice on every unchanged poll can itself exceed the free CPU budget.
  // First activation still records its audit; later polls clone only when a clock action can actually run.
  if(original.pointsSession?.startedAt){
   if(mode==='live'){
    if(original.livePlay?.paused||(original.livePlay?.enabled&&!hasEmptyLiveCourt(s,original,now)))continue;
   }else{
    const rounds=s.rounds.filter(r=>r.eventId===original.id);
    const progress=scheduledCourtProgress(s,original,now);
    if(!progress.ready.length&&!progress.expired.length&&!progress.gap&&!(mode==='round'&&!rounds.length&&original.end-now>=5*60000)&&(planKey===null||planKey===original.pointsSession.autoPlanKey))continue;
   }
  }
  const work=structuredClone(s),e=work.events.find(e=>e.id===original.id)!;
  e.pointsSession??=pointsSession();
  const first=!e.pointsSession.startedAt;
  if(first){
   e.pointsSession.startedAt=Math.max(e.start,window.start);
   work.audits.push({id:crypto.randomUUID(),at:now,actor:'system:points-clock',action:'pointsAutoStart',reason:'积分赛时段到达，自动开始',changes:{eventId:e.id,startedAt:e.pointsSession.startedAt}});
  }
  // Remember this attempt even if it fails; the next one waits for a change in signups, presence or courts.
  const planNow=planKey!==null&&(first||planKey!==e.pointsSession.autoPlanKey);if(planNow)e.pointsSession.autoPlanKey=planKey;
  let started=false;
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
   }else{
    // A planned activity that nobody planned before it started is planned and published on the clock.
    let planned=false;
    if(planNow){
     const plan=automaticPlanInput(event,eventFormat(event)==='singles',now);
     if(plan){await run(attempt,actor,'planPoints',plan,now);await run(attempt,actor,'publishPoints',{eventId:e.id},now);planned=true}
    }
    let next:Round|undefined=attempt.rounds.filter(r=>r.eventId===e.id&&['draft','published'].includes(r.status)).sort((a,b)=>(a.pointsSlot??0)-(b.pointsSlot??0)||a.start-b.start)[0];
    if(mode==='round'&&!next&&!attempt.rounds.some(r=>r.eventId===e.id)){
     const duration=Math.min(15,Math.floor((e.end-now)/60000));
     if(duration>=5){
      await run(attempt,actor,'generate',{eventId:e.id,at:now,duration,seed:1},now);
      next=attempt.rounds.find(r=>r.eventId===e.id&&r.status==='draft');
      if(next)await run(attempt,actor,'publish',{roundId:next.id},now);
     }
    }
    started=advanceScheduledCourts(attempt,event,now)||planned;
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
  }else if(first||planNow){Object.assign(s,work);changed=true}
 }
 return changed;
}
