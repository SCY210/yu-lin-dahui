import {z} from 'zod';
import {bookingParts,setRangeAdvancer} from './booking-advancers';
import {canManageEvent} from './permissions';
import {isClubOwner} from './ownership';
import {businessTimestamp} from './timestamp';
import {editReason} from './edit-reason';
import {fail,type Account,type Booking,type State} from './types';

/** Includes the displayed price and court as well as ownership, so stale forms never silently change a new slot. */
export function bookingClaimVersion(b:Booking){return JSON.stringify([b.id,b.eventId,b.start,b.end,b.pricing,b.cents,b.bearer??'members',bookingParts(b),b.claims??[]])}
const inputSchema=z.object({bookingId:z.string().min(1).max(100),start:businessTimestamp,end:businessTimestamp,expected:z.string().min(1).max(20000),correct:z.boolean().default(false),release:z.boolean().default(false),playerId:z.string().min(1).max(100).optional(),reason:editReason}).strict();

/** Self-claim changes only the advancer of a range. A stored organiser may explicitly correct any claimed range.
 * `release` sets a range back to 待认领: the organiser for any range, a member only for time they themselves booked. */
export function applyBookingClaim(s:State,a:Account,action:string,input:unknown,now:number){
 if(action!=='bookingClaim')return false;
 const p=inputSchema.parse(input),actor=s.accounts.find(x=>x.id===a.id)??fail('403: 账号不可用');
 if(!s.players.some(x=>x.id===actor.playerId&&x.enabled))fail('403: 成员已停用');
 const b=s.bookings.find(x=>x.id===p.bookingId)??fail('场地不存在或已取消'),e=s.events.find(x=>x.id===b.eventId)??fail('活动不存在');
 const manager=canManageEvent({id:actor.id,role:actor.role,isOwner:isClubOwner(s,actor)},e);
 if(e.deletedAt!==undefined||e.status==='cancelled'||e.status==='draft'&&!manager)fail('当前活动不能认领场地');
 if(p.correct&&!manager)fail('403: 只有组织者可以纠正约场人');
 if(p.release)return releaseRange(s,actor,manager,e.id,b,p,now,action);
 const playerId=p.correct?p.playerId??fail('请选择实际约场人'):actor.playerId;
 if(!p.correct&&p.playerId!==undefined&&p.playerId!==actor.playerId)fail('403: 只能认领自己的约场时段');
 if(!s.accounts.some(x=>x.playerId===playerId)||!s.players.some(x=>x.id===playerId&&x.enabled))fail('请选择一位已启用且有账号的球友');
 if(s.settlements.some(x=>x.eventId===e.id&&x.confirmed))fail('费用已确认，请联系组织者从费用页纠正约场人并重新确认分摊');
 if(p.expected!==bookingClaimVersion(b))fail('409: 场地或认领情况已变化，请刷新后重新选择');
 if(p.start<b.start||p.end>b.end||p.end<=p.start)fail('认领时间必须在这个场地的预约范围内');
 const halfHour=1800000;
 if((p.start!==b.start&&(p.start-b.start)%halfHour!==0)||(p.end!==b.end&&(p.end-b.start)%halfHour!==0))fail('请按半小时选择认领时间');
 if(p.end-p.start<3600000&&!(p.start===b.start&&p.end===b.end))fail('认领时段至少 1 小时');
 if(!p.correct&&(b.claims??[]).some(c=>c.playerId!==playerId&&c.start<p.end&&c.end>p.start))fail('409: 这个时段已被其他球友认领，请联系组织者纠正');
 // Time nobody has claimed yet (待认领) stays unclaimed around the new claim; it is not given to anyone.
 if((b.claims??[]).some(c=>c.playerId===playerId&&c.start<=p.start&&c.end>=p.end)&&bookingParts(b).filter(part=>part.start<p.end&&part.end>p.start).every(part=>part.advancedBy===playerId))return true;
 const next=structuredClone(b);setRangeAdvancer(next,p.start,p.end,playerId);
 const parts=bookingParts(next);
 if(parts.length>21)fail('这个场地的约场时段过多，请联系组织者整理');
 if(parts.length>1&&parts.some(part=>part.end-part.start<3600000))fail('调整后每个约场时段至少保留 1 小时');
 const keep=(b.claims??[]).flatMap(c=>c.end<=p.start||c.start>=p.end?[c]:[...(c.start<p.start?[{...c,end:p.start}]:[]),...(c.end>p.end?[{...c,start:p.end}]:[])]);
 next.claims=[...keep,{start:p.start,end:p.end,playerId,at:now}].sort((a,b)=>a.start-b.start);
 if(next.claims.length>40)fail('认领记录过多，请联系组织者整理');
 const before=structuredClone(b);
 Object.assign(b,next);
 // Object.assign does not remove a now-redundant handover list or first booker.
 if(!next.handovers)delete b.handovers;
 if(!next.advancedBy)delete b.advancedBy;
 s.audits.push({id:crypto.randomUUID(),at:now,actor:actor.id,action,reason:p.reason||(p.correct?'纠正约场认领':'认领本人约场时段'),changes:{eventId:e.id,bookingId:b.id,start:p.start,end:p.end,playerId,correct:p.correct,before,after:structuredClone(b)}});
 return true;
}

type ClaimInput=z.infer<typeof inputSchema>;
/** Set a range back to 待认领 (docs/BOOKING_CLAIMS.md): its booker and claims inside it are removed; time outside keeps
 * its booker. Validated like a claim (snapshot, booking range, half hours, confirmed fees). */
function releaseRange(s:State,actor:Account,manager:boolean,eventId:string,b:Booking,p:ClaimInput,now:number,action:string){
 if(s.settlements.some(x=>x.eventId===eventId&&x.confirmed))fail('费用已确认，请联系组织者从费用页纠正约场人并重新确认分摊');
 if(p.expected!==bookingClaimVersion(b))fail('409: 场地或认领情况已变化，请刷新后重新选择');
 if(p.start<b.start||p.end>b.end||p.end<=p.start)fail('改回待认领的时间必须在这个场地的预约范围内');
 const halfHour=1800000;
 if((p.start!==b.start&&(p.start-b.start)%halfHour!==0)||(p.end!==b.end&&(p.end-b.start)%halfHour!==0))fail('请按半小时选择时间');
 const inside=bookingParts(b).filter(part=>part.start<p.end&&part.end>p.start);
 if(inside.every(part=>!part.advancedBy))return true;
 if(!manager&&inside.some(part=>part.advancedBy&&part.advancedBy!==actor.playerId))fail('403: 只能把自己约的时间改回待认领，其他时间请联系组织者');
 const next=structuredClone(b);setRangeAdvancer(next,p.start,p.end);
 const parts=bookingParts(next);
 if(parts.length>1&&parts.some(part=>part.end-part.start<3600000))fail('调整后每个约场时段至少保留 1 小时');
 const claims=(b.claims??[]).flatMap(c=>c.end<=p.start||c.start>=p.end?[c]:[...(c.start<p.start?[{...c,end:p.start}]:[]),...(c.end>p.end?[{...c,start:p.end}]:[])]);
 if(claims.length)next.claims=claims;else delete next.claims;
 const before=structuredClone(b);
 Object.assign(b,next);
 if(!next.handovers)delete b.handovers;
 if(!next.advancedBy)delete b.advancedBy;
 if(!next.claims)delete b.claims;
 s.audits.push({id:crypto.randomUUID(),at:now,actor:actor.id,action,reason:p.reason||'改回待认领',changes:{eventId,bookingId:b.id,start:p.start,end:p.end,release:true,before,after:structuredClone(b)}});
 return true;
}
