import type {Event} from '../lib/domain/types';
import type {ClubData} from '../lib/contracts/club';
import {signupClosed} from '../lib/domain/event-lifecycle';
import {canManageEvent} from '../lib/domain/permissions';
import {plannedInterval,plannedEpoch} from '../lib/time-planning';
import {choice,text,halfTimed,hm,type Field} from './form-fields';
import {guestLevels,defaultGuestLevel} from '../lib/domain/guests';

type Data=Pick<ClubData,'me'|'players'|'bookings'>;
type Court=Data['bookings'][number];
type Values={bookingId:string;mode:'new'|'existing';name:string;guestLevel:string;playerId:string;arrival:string;departure:string;note:string};
export function friendSignupForm(e:Event,data:Data,now:number,court?:Court,preferExisting=false){
 const manager=canManageEvent(data.me,e);
 if(['ended','cancelled'].includes(e.status)||(!manager&&(e.status!=='open'||signupClosed(e,now))))return null;
 const courts=data.bookings.filter(b=>b.eventId===e.id&&b.end>now).sort((a,b)=>a.start-b.start||a.name.localeCompare(b.name));
 const selected=court?courts.find(b=>b.id===court.id):courts[0];if(!selected)return null;
 const friends=data.players.filter(p=>p.enabled&&p.id!==data.me.playerId&&(!p.guestEventId||p.guestEventId===e.id)&&(manager||p.ownerId===data.me.id));
 const values:Values={bookingId:selected.id,mode:preferExisting&&friends.length?'existing':'new',name:'',guestLevel:String(defaultGuestLevel),playerId:friends[0]?.id??'',arrival:'',departure:'',note:''};
 const fields:Field[]=[];
 if(!court&&courts.length>1)fields.push(choice('bookingId','参加场地',courts.map(b=>[b.id,`${b.name} · ${hm(b.start)}–${hm(b.end)} · ${b.venue??e.venue}`])));
 if(friends.length)fields.push(choice('mode','朋友',[['new','临时来宾（不建档案）'],['existing','系统球友 / 本场来宾']]));
 fields.push({...text('name','朋友昵称'),when:{key:'mode',value:'new'}},{...choice('guestLevel','朋友水平（用于分队，不计积分）',guestLevels.map(([v,label])=>[String(v),label+' · '+v])),when:{key:'mode',value:'new'}});
 if(friends.length)fields.push({...choice('playerId','替谁接龙',friends.map(p=>[p.id,p.name+(p.guestEventId?' · 本场来宾':'')])),when:{key:'mode',value:'existing'}});
 fields.push(halfTimed('arrival','参加开始（留空按所选场地）',true),halfTimed('departure','参加结束（留空按所选场地）',true),{...text('note','备注'),optional:true});
 const convert=(v:Values)=>{
  const b=courts.find(b=>b.id===v.bookingId);if(!b)throw new Error('所选场地已不可报名，请重新选择');
  const plan=plannedInterval(b.start,b.end);
  const times={bookingId:b.id,arrival:v.arrival?plannedEpoch(v.arrival,plan.start):plan.start,departure:v.departure?plannedEpoch(v.departure,plan.end):plan.end,note:v.note??''};
  return v.mode==='existing'?{...times,mode:'existing' as const,playerId:v.playerId}:{...times,mode:'new' as const,name:v.name,guestLevel:Number(v.guestLevel)||defaultGuestLevel};
 };
 return {title:'添加朋友并接龙',values,fields,convert,description:`${selected.name} · ${hm(selected.start)}–${hm(selected.end)}。保存即加入所选场地接龙，满员自动候补。默认参加整段时间，可展开更多选项调整。临时来宾只保留本次活动的接龙、比赛与费用记录，不创建球员档案、不加入球友圈，不累计修为、局数或积分，只按所选水平分队。系统球友请从列表选择。`};
}
