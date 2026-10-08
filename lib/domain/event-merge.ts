import {clubOwnerId,isClubOwner} from './ownership';
import {cancellationDeadline} from './cancellation';
import {bookingCapacity,syncRegistration} from './booking-signups';
import {fail,type Account,type BookingSignup,type Event,type Registration,type State} from './types';
const day=(at:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(at);

/** Convert an unambiguous original roster without resetting its place or timestamps. */
export function upgradeActivitySignups(s:State,e:Event){
 const bookings=s.bookings.filter(b=>b.eventId===e.id);
 for(const r of s.registrations.filter(r=>r.eventId===e.id&&!r.bookingSignups)){
  const options=bookings.filter(b=>r.arrival>=b.start&&r.departure<=b.end);
  if(options.length!==1)fail('原报名无法唯一对应场地，请先指定对应场地');
  const b=options[0];r.bookingSignups=[{bookingId:b.id,status:r.status,sequence:r.sequence,arrival:r.arrival,departure:r.departure,note:r.note,cancelRequested:r.cancelRequested,registeredAt:r.registeredAt??e.start,joinedAsWaitlist:r.joinedAsWaitlist??false,...(r.promotedAt!==undefined?{promotedAt:r.promotedAt}:{})}];
  syncRegistration(r);
 }
 for(const b of bookings){const formal=s.registrations.flatMap(r=>r.eventId===e.id?r.bookingSignups??[]:[]).filter(x=>x.bookingId===b.id&&x.status==='confirmed').length;b.signupCapacity=Math.max(bookingCapacity(b,e),formal)}
}

/** Upcoming activities only. Originals stay in the recoverable archive. */
export function mergeUpcomingActivities(s:State,a:Account,targetId:string,sourceIds:string[],now:number,reason:string){
 if(!isClubOwner(s,a)||a.role!=='admin')fail('403: 只有群主可以合并活动');
 if(!sourceIds.length||sourceIds.length>10||new Set([targetId,...sourceIds]).size!==sourceIds.length+1)fail('请选择不同的活动');
 const work=structuredClone(s),target=work.events.find(e=>e.id===targetId&&e.deletedAt===undefined)??fail('保留的活动不存在');
 const sources=sourceIds.map(id=>work.events.find(e=>e.id===id&&e.deletedAt===undefined)??fail('待合并活动不存在'));
 const ids=new Set([targetId,...sourceIds]);
 for(const e of [target,...sources]){
  if(e.creatorId!==clubOwnerId(work))fail('只能迁移群主创建的活动');
  if(e.start<=now||!['open','draft','locked'].includes(e.status))fail('只能合并尚未开始的活动');
  if(e.courtMode!==target.courtMode||e.ballMode!==target.ballMode)fail('费用模式不同，不能直接合并');
  if(e.venue!==target.venue||day(e.start)!==day(target.start))fail('只能合并同一天、同一球馆的活动');
 }
 if(work.matches.some(m=>ids.has(m.eventId)&&['playing','complete','forfeit'].includes(m.status))||work.settlements.some(x=>ids.has(x.eventId))||work.attendance.some(x=>ids.has(x.eventId))||work.payments.some(x=>ids.has(x.eventId)))fail('已有比赛、参加记录或结算，不能直接合并');
 if(work.costs.some(c=>ids.has(c.eventId)))fail('已有附加费用，请先核对费用归属后再合并');
 if(work.awardVotes.some(v=>ids.has(v.eventId)))fail('已有赛后评选记录，不能直接合并');
 upgradeActivitySignups(work,target);
 const oldTargetCount=work.registrations.filter(r=>r.eventId===target.id&&r.status!=='cancelled').length;
 for(const source of sources){
  // The untouched originals retain a normal restore path. Only the target gets copies.
  const originalBookings=work.bookings.filter(b=>b.eventId===source.id),mapping=new Map<string,string>();
  for(const b of originalBookings){
   if(work.bookings.some(x=>x.eventId===target.id&&x.name===b.name&&(x.venue??target.venue)===(b.venue??source.venue)&&x.start<b.end&&x.end>b.start))fail('同一场地时段重复，请先核对预约');
   const copy={...b,id:crypto.randomUUID(),eventId:target.id,venue:b.venue??source.venue,address:b.address??source.address,signupCapacity:bookingCapacity(b,source)};mapping.set(b.id,copy.id);work.bookings.push(copy);
  }
  const scoped=structuredClone(work);upgradeActivitySignups(scoped,scoped.events.find(e=>e.id===source.id)!);
  for(const original of scoped.registrations.filter(r=>r.eventId===source.id)){
   const slots=(original.bookingSignups??[]).map(x=>({...x,bookingId:mapping.get(x.bookingId)??fail('报名关联场地不存在')}));
   let r=work.registrations.find(r=>r.eventId===target.id&&r.playerId===original.playerId);
   if(r){
    if(JSON.stringify(r.courtExempt)!==JSON.stringify(original.courtExempt)||JSON.stringify(r.ballExempt)!==JSON.stringify(original.ballExempt))fail('同一球友的费用豁免不同，请先核对');
    if(slots.some(x=>x.status!=='cancelled'&&(r!.bookingSignups??[]).some(y=>y.status!=='cancelled'&&x.arrival<y.departure&&x.departure>y.arrival)))fail('同一球友在两个活动报名时间重叠，请先核对');
    r.bookingSignups!.push(...slots);
   }else{r={...original,id:crypto.randomUUID(),eventId:target.id,sequence:Math.max(0,...work.registrations.filter(x=>x.eventId===target.id).map(x=>x.sequence))+1,bookingSignups:slots};work.registrations.push(r)}
   syncRegistration(r);
  }
  if(!target.pointsChoice&&source.pointsChoice)target.pointsChoice=structuredClone(source.pointsChoice);
  if(!target.shuttlePlan&&source.shuttlePlan)target.shuttlePlan=structuredClone(source.shuttlePlan);
  target.start=Math.min(target.start,source.start);target.end=Math.max(target.end,source.end);
  if(source.note&&source.note!==target.note)target.note=[target.note,source.note].filter(Boolean).join('\n');
  source.deletedAt=now;source.deletedBy=a.id;source.mergedInto=target.id;
 }
 for(const b of work.bookings.filter(b=>b.eventId===target.id)){const formal=work.registrations.flatMap(r=>r.eventId===target.id?r.bookingSignups??[]:[]).filter(x=>x.bookingId===b.id&&x.status==='confirmed').length;b.signupCapacity=Math.max(bookingCapacity(b,target),formal)}
 for(const r of work.rounds.filter(r=>r.eventId===target.id)){if(['draft','published'].includes(r.status)||work.matches.filter(m=>m.roundId===r.id).every(m=>m.status==='cancelled')){r.status='cancelled';work.matches.filter(m=>m.roundId===r.id).forEach(m=>m.status='cancelled')}}
 target.attendanceMode='automatic';target.cancelDeadline=cancellationDeadline(target);
 work.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'mergeEvents',reason,changes:{targetEventId:target.id,sourceEventIds:sourceIds,originalTargetPlayers:oldTargetCount,mergedPlayers:work.registrations.filter(r=>r.eventId===target.id&&r.status!=='cancelled').length,bookings:work.bookings.filter(b=>b.eventId===target.id).map(b=>b.id)}});
 Object.assign(s,work);return target.id;
}
