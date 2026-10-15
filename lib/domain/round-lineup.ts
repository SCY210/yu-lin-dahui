import {readyIds,validateRound} from './grouping';
import {decorateMatch} from './play';
import {eventStatusAt} from './event-lifecycle';
import {bookingAllowsPlayer,venueParticipation} from './booking-signups';
import {fail,type State,type Event,type Round,type Match} from './types';

export const isPlannedLineup=(e:Pick<Event,'schedulingMode'>,r:Pick<Round,'pointsSlot'>)=>e.schedulingMode==='planned'||r.pointsSlot!==undefined;
export type RoundLineup=Array<{id:string;a:string[];b:string[]}>;
export function pendingMatchLineup(m:Pick<Match,'status'|'start'|'games'|'scoreA'|'scoreB'>){
 return ['draft','published'].includes(m.status)&&m.start===null&&!m.games.length&&m.scoreA===null&&m.scoreB===null;
}
export function roundLineupSnapshot(matches:Pick<Match,'id'|'a'|'b'|'status'>[]):RoundLineup{
 return matches.filter(m=>m.status!=='cancelled').map(m=>({id:m.id,a:[...m.a],b:[...m.b]})).sort((a,b)=>a.id.localeCompare(b.id));
}
/** Editing an unstarted lineup is a plan, not an attempt to put somebody on court now.
 * Planned editing has no clock or participation-window gate; actual starts validate attendance and occupancy. */
function plannedAvailability(s:State):State{return {...s,matches:s.matches.filter(m=>m.status!=='playing')}}
function roundAvailableIds(s:State,e:Event,r:Round,now=r.start){
 const courts=s.matches.filter(m=>m.roundId===r.id&&m.status!=='cancelled').map(m=>m.courtId);
 if(isPlannedLineup(e,r)){
  const venues=new Set(s.bookings.filter(b=>courts.includes(b.id)).map(b=>b.venue??e.venue)),enabled=new Set(s.players.filter(p=>p.enabled).map(p=>p.id));
  return [...new Set(s.registrations.filter(reg=>reg.eventId===e.id&&reg.status==='confirmed'&&enabled.has(reg.playerId)&&venueParticipation(s,e,reg).some(span=>venues.has(span.venue))).map(reg=>reg.playerId))];
 }
 const at=r.status==='playing'?now:r.start,duration=r.status==='playing'?0:r.duration;
 return readyIds(plannedAvailability(s),e.id,at,duration).filter(id=>courts.some(court=>bookingAllowsPlayer(s,e.id,court,id,at,at+duration*60000)));
}
export function roundBenchIds(s:State,e:Event,r:Round,now=r.start){
 const assigned=new Set(s.matches.filter(m=>m.roundId===r.id&&m.status!=='cancelled').flatMap(m=>[...m.a,...m.b]));
 return roundAvailableIds(s,e,r,now).filter(id=>!assigned.has(id));
}
/** Stage every change before validation; a rejected substitution cannot partially rewrite a team. */
export function swapRoundPlayers(s:State,r:Round,p1:string,p2:string,now:number,expected?:RoundLineup){
 const e=s.events.find(e=>e.id===r.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 if(e.pointsChoice?.selectedMode==='fixed')fail('固定搭档不能单轮交换成员，请在开打前重新分配搭档');
 if(!['draft','published','playing'].includes(r.status))fail('只可调整尚未开始的对局');
 if(!isPlannedLineup(e,r)&&['draft','ended','cancelled'].includes(eventStatusAt(e,now)))fail('活动未开放或已经结束，不能调整排场');
 const matches=s.matches.filter(m=>m.roundId===r.id&&m.status!=='cancelled');
 if(expected&&JSON.stringify(roundLineupSnapshot(expected.map(m=>({...m,status:'published'}))))!==JSON.stringify(roundLineupSnapshot(matches)))fail('409: 本轮人员已更新，请重新选择要交换的球友');
 if(p1===p2)fail('请选择两位不同的球友');
 const has=(m:Match,id:string)=>m.a.includes(id)||m.b.includes(id),touched=matches.filter(m=>has(m,p1)||has(m,p2));
 if(!touched.length)fail('请选择至少一位本轮已排上场的球友');
 if(touched.some(m=>!pendingMatchLineup(m)))fail('已开始或已录分的对局不能换人');
 if(touched.some(m=>m.locked))fail('请先解除锁定');
 const ready=roundAvailableIds(s,e,r,now),known=new Set([...ready,...matches.flatMap(m=>[...m.a,...m.b])]);
 if(!known.has(p1)||!known.has(p2))fail('选手不在本轮可用名单');
 const swap=(id:string)=>id===p1?p2:id===p2?p1:id;
 const next=touched.map(m=>({...structuredClone(m),a:m.a.map(swap),b:m.b.map(swap)}));
 const all=matches.map(m=>next.find(n=>n.id===m.id)??m),ids=all.flatMap(m=>[...m.a,...m.b]);
 if(new Set(ids).size!==ids.length)fail('同一轮有重复选手');
 if(isPlannedLineup(e,r)){
  for(const m of next){
   const booking=s.bookings.find(b=>b.id===m.courtId&&b.eventId===e.id),venue=booking?.venue??e.venue;
   if(!booking||[...m.a,...m.b].some(id=>!s.registrations.some(reg=>reg.eventId===e.id&&reg.playerId===id&&reg.status==='confirmed'&&venueParticipation(s,e,reg).some(span=>span.venue===venue))))fail('请选择已正式报名该球馆的球友');
  }
 }else validateRound(plannedAvailability(s),e.id,r.status==='playing'?now:r.start,r.status==='playing'?0:r.duration,next);
 for(const m of next)decorateMatch(s,e,m);
 for(const m of next)Object.assign(matches.find(original=>original.id===m.id)!,m);
 r.eligible=[...new Set([...ready,...ids])];r.rest=ready.filter(id=>!ids.includes(id));
}
