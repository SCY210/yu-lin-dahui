import {z} from 'zod';
import {eventRankingEnabled} from './event-ranking';
import {parseDomainCommand} from './command-contract';
import {authorizeEventAction,canManageEvent} from './permissions';
import {eventStatusAt} from './event-lifecycle';
import {eventFormat} from './match-format';
import {schedulingMode,pendingSchedulingIds} from './scheduling';
import {pointsSession} from './points-attendance';
import {livePresentIds,liveResting,liveAppearances} from './live-play';
import {bookingAllowsPlayer} from './booking-signups';
import {propose,validateRound} from './grouping';
import {proposeFixed} from './fixed-partners';
import {decorateMatch} from './play';
import {fail,month,type State,type Account,type Match,type Event} from './types';
const id=z.string().min(1).max(100),mode=z.enum(['planned','round','live']),replacement=z.enum(['player','group']);
const schemas={
 pointsStart:z.object({eventId:id,expectedMode:mode,expectedPendingIds:z.array(id).max(1000)}),
 pointsLate:z.object({matchId:id,playerId:id,replacement,expectedA:z.array(id).min(1).max(2),expectedB:z.array(id).min(1).max(2)}),
 pointsReplace:z.object({eventId:id,matchId:id,replacement}),
 pointsPresence:z.object({eventId:id,playerId:id,status:z.enum(['on-time','arrived','clear-late'])}),
};
type Runner=(s:State,a:Account,action:string,input:unknown,now:number)=>Promise<unknown>;
function replace(s:State,e:Event,m:Match,playerId:string,replacement:'player'|'group',now:number){
 const r=s.rounds.find(r=>r.id===m.roundId)??fail('轮次不存在'),court=s.bookings.find(b=>b.id===m.courtId)??fail('场地不存在');
 if(now<court.start||now>=court.end)fail('当前不在场地预约时间内');
 if(s.matches.some(x=>x.id!==m.id&&x.status==='playing'&&s.bookings.some(b=>b.id===x.courtId&&b.name===court.name&&(b.venue??s.events.find(e=>e.id===b.eventId)?.venue)===(court.venue??e.venue))))fail('这片场地已有其他比赛，请刷新');
 const originalStatus=m.status,wasPlaying=m.start!==null,before={a:[...m.a],b:[...m.b]};
 m.status='cancelled';if(m.start!==null)m.end=now;
 let teams:{a:string[];b:string[]}|undefined;
 if(replacement==='player'){
  const busy=new Set(s.matches.filter(x=>x.status==='playing').flatMap(x=>[...x.a,...x.b])),original=new Set([...m.a,...m.b]),venue=court.venue??e.venue;
  const candidates=livePresentIds(s,e,now).filter(id=>(!original.has(id)||id===playerId&&e.pointsSession?.attendance.some(row=>row.playerId===playerId&&row.available))&&!busy.has(id)&&!liveResting(e,id,venue)&&bookingAllowsPlayer(s,e.id,court.id,id,now,now+1)).sort((a,b)=>liveAppearances(s,e.id,a)-liveAppearances(s,e.id,b)||Math.max(0,...s.matches.filter(m=>m.status==='complete'&&[...m.a,...m.b].includes(a)).map(m=>m.end??m.start??0))-Math.max(0,...s.matches.filter(m=>m.status==='complete'&&[...m.a,...m.b].includes(b)).map(m=>m.end??m.start??0))||a.localeCompare(b));
  if(candidates.length)teams={a:m.a.map(id=>id===playerId?candidates[0]:id),b:m.b.map(id=>id===playerId?candidates[0]:id)};
 }else{
  const copy=structuredClone(s),out=new Set([...m.a,...m.b]);copy.players.forEach(p=>{if(out.has(p.id))p.enabled=false});copy.matches.push(...copy.bookings.filter(b=>b.id!==court.id).map(b=>({...structuredClone(m),id:'blocked:'+b.id,courtId:b.id,a:[],b:[],status:'playing' as const,start:now})));
  const venue=court.venue??e.venue;copy.players.forEach(p=>{if(liveResting(e,p.id,venue))p.enabled=false});
  try{teams=(e.pointsChoice?.selectedMode==='fixed'&&e.pointsChoice.teams?proposeFixed(copy,e,now,0,1,e.pointsChoice.teams):propose(copy,e,now,0,1)).courts[0]}catch{teams=undefined}
 }
 const session=e.pointsSession!;session.waiting=session.waiting.filter(row=>row.matchId!==m.id);
 if(teams){
  const next:Match={...structuredClone(m),...teams,id:crypto.randomUUID(),status:wasPlaying?'playing':originalStatus==='published'?'published':'draft',start:wasPlaying?now:null,end:null,scoreA:null,scoreB:null,games:[],enteredBy:null,locked:false};
  validateRound(s,e.id,now,0,[next]);decorateMatch(s,e,next);s.matches.push(next);r.status=wasPlaying?'playing':next.status==='published'?'published':'draft';r.eligible=[...new Set([...r.eligible,...next.a,...next.b])];r.rest=livePresentIds(s,e,now).filter(id=>![...next.a,...next.b].includes(id)&&!s.matches.some(x=>x.status==='playing'&&[...x.a,...x.b].includes(id)));
  return {before,after:{a:next.a,b:next.b},replacementMatchId:next.id,waiting:false};
 }
 session.waiting.push({matchId:m.id,playerId,replacement});
 if(s.matches.filter(x=>x.roundId===r.id).every(x=>x.status==='cancelled'))r.status='cancelled';
 return {before,waiting:true};
}
export async function applyPointsSession(s:State,a:Account,action:string,input:unknown,now:number,run:Runner){
 const c=parseDomainCommand(schemas,action,input);if(!c)return false;
 const p=c.payload;authorizeEventAction(s,a,action,p);
 const work=structuredClone(s),eventId=c.action==='pointsLate'?work.matches.find(m=>m.id===c.payload.matchId)?.eventId:c.payload.eventId;
 const e=work.events.find(e=>e.id===eventId)??fail('活动不存在');
 if(['draft','ended','cancelled'].includes(eventStatusAt(e,now))||now<e.start||now>=e.end)fail('请在活动进行时管理积分赛');
 e.pointsSession??=pointsSession();const session=e.pointsSession;
 let changes:Record<string,unknown>={eventId:e.id};
 switch(c.action){
  case 'pointsStart':{
   const p=c.payload;if(session.startedAt)return true;
   if(schedulingMode(work,e)!==p.expectedMode||JSON.stringify(pendingSchedulingIds(work,e.id))!==JSON.stringify([...p.expectedPendingIds].sort()))fail('409: 排场已更新，请刷新后再开始');
   if(!work.matches.some(m=>m.eventId===e.id&&m.status==='playing')){
    if(p.expectedMode==='live')await run(work,a,'liveStart',{eventId:e.id},now);
    else{
     let r=work.rounds.filter(r=>r.eventId===e.id&&['draft','published'].includes(r.status)).sort((a,b)=>a.start-b.start)[0];
     if(!r){if(p.expectedMode==='planned')fail('请先预排赛程，再开始积分赛');const duration=Math.min(15,Math.floor((e.end-now)/60000));if(duration<5)fail('剩余活动时间不足5分钟');await run(work,a,'generate',{eventId:e.id,at:now,duration,seed:1},now);r=work.rounds.find(r=>r.eventId===e.id&&r.status==='draft')!}
     if(now<r.start)fail('尚未到预排赛程的开始时间');
     if(r.status==='draft')await run(work,a,'publish',{roundId:r.id},now);
     await run(work,a,'start',{roundId:r.id,at:now,monthly:true,elo:true},now);
    }
   }
   if(!work.matches.some(m=>m.eventId===e.id&&m.status==='playing'))fail('目前没有完整可上场队伍，积分赛尚未开始');
   session.startedAt=now;break;
  }
  case 'pointsLate':{
   const p=c.payload,m=work.matches.find(m=>m.id===p.matchId)??fail('对局不存在');
   if(!['draft','published','playing'].includes(m.status)||m.games.length||m.scoreA!==null||m.scoreB!==null)fail('只能标记尚未录分的当前对局；已完成比分不能改动');
   if(!session.startedAt&&!work.matches.some(m=>m.eventId===e.id&&m.status==='playing'))fail('请先开始积分赛');
   const r=work.rounds.find(r=>r.id===m.roundId)!;if(r.start>now)fail('尚未到这轮开赛时间，不能标记迟到');
   if(JSON.stringify(m.a)!==JSON.stringify(p.expectedA)||JSON.stringify(m.b)!==JSON.stringify(p.expectedB))fail('409: 上场人员已更新，请刷新');
   if(![...m.a,...m.b].includes(p.playerId))fail('只能标记这场已排上场的球友');
   if(!canManageEvent(a,e)&&!livePresentIds(work,e,now).includes(a.playerId))fail('403: 只有当前参加时段内的到场球友可以报告迟到');
   const row=session.attendance.find(row=>row.playerId===p.playerId),delta=!eventRankingEnabled(e)||row?.late?0:-1;
   session.attendance=session.attendance.filter(row=>row.playerId!==p.playerId);session.attendance.push({playerId:p.playerId,late:true,available:false,at:now});
   changes={...changes,...replace(work,e,m,p.playerId,p.replacement,now),playerId:p.playerId,matchId:m.id,period:month(e.start),format:eventFormat(e),delta,replacement:p.replacement};break;
  }
  case 'pointsReplace':{
   const p=c.payload,m=work.matches.find(m=>m.id===p.matchId&&m.eventId===e.id)??fail('对局不存在'),pending=session.waiting.find(row=>row.matchId===m.id)??fail('409: 这场已经补排，请刷新');
   changes={...changes,...replace(work,e,m,pending.playerId,p.replacement,now),matchId:m.id};break;
  }
  case 'pointsPresence':{
   const p=c.payload;if(!work.registrations.some(r=>r.eventId===e.id&&r.playerId===p.playerId&&r.status==='confirmed'))fail('仅可确认本活动正式报名球友');
   const row=session.attendance.find(row=>row.playerId===p.playerId);
   if(p.status==='on-time'&&row?.late)fail('已标记迟到，请使用已到场或撤销误标');
   const delta=eventRankingEnabled(e)&&p.status==='clear-late'&&row?.late?1:0;
   if(e.noShowHold){e.noShowHold=e.noShowHold.filter(id=>id!==p.playerId);if(!e.noShowHold.length)delete e.noShowHold}
   session.attendance=session.attendance.filter(row=>row.playerId!==p.playerId);session.attendance.push({playerId:p.playerId,late:p.status==='clear-late'?false:row?.late??false,available:true,at:now});
   changes={...changes,playerId:p.playerId,period:month(e.start),format:eventFormat(e),delta,status:p.status};break;
  }
 }
 work.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'积分赛开赛与到场确认',changes});Object.assign(s,work);return true;
}
