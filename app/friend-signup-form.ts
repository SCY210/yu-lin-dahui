import type {Event} from '../lib/domain/types';
import type {ClubData} from '../lib/contracts/club';
import {signupClosed} from '../lib/domain/event-lifecycle';
import {canManageEvent} from '../lib/domain/permissions';
import {plannedInterval,plannedEpoch} from '../lib/time-planning';
import {choice,text,halfTimed,hm,type Field} from './form-fields';
import {guestLevels,defaultGuestLevel} from '../lib/domain/guests';
import {duplicateGuestMessage,guestAlreadySignedUp,guestNameKey} from '../lib/domain/guest-names';

type Data=Pick<ClubData,'me'|'players'|'bookings'|'registrations'>;
type Court=Data['bookings'][number];
type Values={bookingId:string;mode:'new'|'saved'|'existing';name:string;gender:''|'male'|'female';guestLevel:string;saved:string;playerId:string;arrival:string;departure:string;note:string};
type Person=Data['players'][number];
const isGuestView=(p:Person)=>!!(p.guest||p.guestEventId);
/** Friends brought before, one per member and nickname (the latest record), with this activity's guest when they are
 * already signed up here. Members see their own friends; the owner and admins see every guest. */
function savedFriends(e:Event,data:Data,admin:boolean){
 const latest=new Map<string,Person>(),here=new Map<string,Person>();
 for(const p of data.players){
  if(!p.enabled||!isGuestView(p)||(!admin&&p.ownerId!==data.me.id))continue;
  const key=p.ownerId+'|'+guestNameKey(p.name);latest.set(key,p);
  if(p.guestEventId===e.id)here.set(key,p);
 }
 const host=(ownerId:string)=>data.players.find(p=>p.ownerId===ownerId&&!isGuestView(p))?.name;
 return [...latest].map(([key,p])=>({value:(here.has(key)?'existing:'+here.get(key)!.id:'saved:'+p.id),label:p.name+(here.has(key)?' · 已在本场，可报其他场地':'')+(admin&&p.ownerId!==data.me.id&&host(p.ownerId)?' · '+host(p.ownerId)+'带来':'')})).sort((a,b)=>a.label.localeCompare(b.label,'zh-CN'));
}
export function friendSignupForm(e:Event,data:Data,now:number,court?:Court,preferExisting=false){
 const manager=canManageEvent(data.me,e);
 if(['ended','cancelled'].includes(e.status)||(!manager&&(e.status!=='open'||signupClosed(e,now))))return null;
 const courts=data.bookings.filter(b=>b.eventId===e.id&&b.end>now).sort((a,b)=>a.start-b.start||a.name.localeCompare(b.name));
 const selected=court?courts.find(b=>b.id===court.id):courts[0];if(!selected)return null;
 // 羽林同门: formal members only, never guests. Organisers sign up any member; others only players they own.
 const members=data.players.filter(p=>p.enabled&&!isGuestView(p)&&p.id!==data.me.playerId&&(manager||p.ownerId===data.me.id));
 const admin=data.me.role==='admin',saved=savedFriends(e,data,admin);
 const values:Values={bookingId:selected.id,mode:preferExisting?(saved.length?'saved':members.length?'existing':'new'):'new',name:'',gender:'',guestLevel:String(defaultGuestLevel),saved:saved[0]?.value??'',playerId:members[0]?.id??'',arrival:'',departure:'',note:''};
 const fields:Field[]=[];
 if(!court&&courts.length>1)fields.push(choice('bookingId','参加场地',courts.map(b=>[b.id,`${b.name} · ${hm(b.start)}–${hm(b.end)} · ${b.venue??e.venue}`])));
 const savedLabel=admin?'全部临时来宾':'我的朋友';
 const modes:string[][]=[['new','新建临时来宾'],...(saved.length?[['saved',savedLabel]]:[]),...(members.length?[['existing','羽林同门']]:[])];
 if(modes.length>1)fields.push(choice('mode','朋友',modes));
 fields.push({...text('name','朋友昵称'),when:{key:'mode',value:'new'}},{...choice('gender','朋友性别（用于分队）',[['male','男'],['female','女']]),when:{key:'mode',value:'new'}},{...choice('guestLevel','朋友水平（用于分队，不计积分）',guestLevels.map(([v,label])=>[String(v),label+' · '+v])),when:{key:'mode',value:'new'}});
 if(saved.length)fields.push({...choice('saved',admin?'哪位临时来宾（昵称、性别和水平沿用上次）':'哪位朋友（昵称、性别和水平沿用上次）',saved.map(x=>[x.value,x.label])),when:{key:'mode',value:'saved'}});
 if(members.length)fields.push({...choice('playerId','替哪位羽林同门接龙',members.map(p=>[p.id,p.name])),when:{key:'mode',value:'existing'}});
 fields.push(halfTimed('arrival','参加开始（留空按所选场地）',true),halfTimed('departure','参加结束（留空按所选场地）',true),{...text('note','备注'),optional:true});
 const convert=(v:Values)=>{
  const b=courts.find(b=>b.id===v.bookingId);if(!b)throw new Error('所选场地已不可报名，请重新选择');
  const plan=plannedInterval(b.start,b.end);
  const times={bookingId:b.id,arrival:v.arrival?plannedEpoch(v.arrival,plan.start):plan.start,departure:v.departure?plannedEpoch(v.departure,plan.end):plan.end,note:v.note??''};
  if(v.mode==='new'&&!v.gender)throw new Error('请选择朋友性别，用于分队');
  // The same nickname is not added twice to one activity; the friend's other courts go through 代朋友接龙.
  if(v.mode==='new'&&guestAlreadySignedUp(data,e.id,v.name))throw new Error(duplicateGuestMessage);
  if(v.mode==='saved'){const [kind,id]=v.saved.split(':');if(!id)throw new Error('请选择朋友');return kind==='existing'?{...times,mode:'existing' as const,playerId:id}:{...times,mode:'saved' as const,sourcePlayerId:id}}
  return v.mode==='existing'?{...times,mode:'existing' as const,playerId:v.playerId}:{...times,mode:'new' as const,name:v.name,gender:v.gender as 'male'|'female',guestLevel:Number(v.guestLevel)||defaultGuestLevel};
 };
 return {title:'添加朋友并接龙',values,fields,convert,description:`${selected.name} · ${hm(selected.start)}–${hm(selected.end)}。保存即加入所选场地接龙，满员自动候补。默认参加整段时间，可展开更多选项调整。临时来宾只保留本次活动的接龙、比赛与费用记录，不创建球员档案、不加入球友圈，不累计修为、局数或积分，只按所选水平分队。以前带过的朋友可以在“${saved.length?savedLabel:'我的朋友'}”里直接选，不用重新填写。`};
}
