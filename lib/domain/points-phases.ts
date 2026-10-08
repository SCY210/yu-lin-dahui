import {registrationSpans,bookingAllowsPlayer} from './booking-signups';
import {fail,type Event,type State} from './types';
const minute=60000;

/** Stable attendance / court windows, shared by the planner and its explanation. */
export function pointsPhases(s:State,e:Event,start:number,end:number){
 if(end<=start)return [];
 const regs=s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed'&&s.players.some(p=>p.id===r.playerId&&p.enabled));
 const spans=regs.flatMap(r=>registrationSpans(s,e,r)),bookings=s.bookings.filter(b=>b.eventId===e.id);
 const cuts=[...new Set([start,end,...bookings.flatMap(b=>[b.start,b.end]),...spans.flatMap(a=>[a.start,a.end??e.end])])].filter(t=>t>=start&&t<=end).sort((a,b)=>a-b);
 return cuts.slice(0,-1).map((at,i)=>{
  const until=cuts[i+1],courts=bookings.filter(b=>b.start<=at&&b.end>=until).filter((b,j,all)=>all.findIndex(x=>x.name===b.name&&(x.venue??e.venue)===(b.venue??e.venue))===j);
  const players=[...new Set(courts.flatMap(b=>regs.filter(r=>bookingAllowsPlayer(s,e.id,b.id,r.playerId,at,until)).map(r=>r.playerId)))];
  const used=new Set<string>();let usedCourts=0;
  for(const b of courts){const pool=players.filter(id=>!used.has(id)&&bookingAllowsPlayer(s,e.id,b.id,id,at,until));if(pool.length<4)continue;pool.slice(0,4).forEach(id=>used.add(id));usedCourts++}
  courts.sort((a,b)=>(a.venue??e.venue).localeCompare(b.venue??e.venue)||a.name.localeCompare(b.name,'zh-CN',{numeric:true}));
  return {start:at,end:until,courts:courts.map(b=>({id:b.id,name:b.name,venue:b.venue??e.venue})),players,usedCourts,playing:usedCourts*4,rest:players.length-usedCourts*4};
 });
}

export function pointsRoundWindows(s:State,e:Event,start:number,end:number,roundMinutes:number){
 const rounds:{start:number;duration:number}[]=[];
 for(const phase of pointsPhases(s,e,start,end)){
  const durations:number[]=[];let remaining=(phase.end-phase.start)/minute;
  if(remaining<5)fail('参加人数或场地变化产生不足5分钟的时段，请调整积分赛起止时间');
  while(remaining>0){const length=Math.min(roundMinutes,remaining);if(length<5&&durations.length){durations[durations.length-1]+=length;break}durations.push(length);if(durations.length>48)fail('积分赛最多预排48轮，请增加每轮预计时长');remaining-=length}
  let at=phase.start;for(const duration of durations){rounds.push({start:at,duration});if(rounds.length>48)fail('积分赛最多预排48轮，请增加每轮预计时长');at+=duration*minute}
 }
 if(rounds.length>48)fail('积分赛最多预排48轮，请增加每轮预计时长');
 return rounds;
}
