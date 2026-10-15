'use client';
import type {ClubData} from '../lib/contracts/club';
import {canManageEvent} from '../lib/domain/permissions';
import {guestLevels,guestLevelLabel,defaultGuestLevel} from '../lib/domain/guests';
import {choice,type Field} from './form-fields';

type Ctx={data:ClubData;name:(id:string)=>string;busy?:boolean;readOnly?:boolean;open:(title:string,action:string,values:Record<string,unknown>,fields:Field[],convert?:(v:Record<string,unknown>)=>Record<string,unknown>,description?:string)=>void};
type ClubEvent=ClubData['events'][number];

const genders:Record<string,string>={male:'男',female:'女'};

/** Friends signed up for this activity, with their gender and level. The registrant and the organisers can change
 * them; a change counts from now on and friends never collect rating or points. Doubles pairing needs the gender. */
export default function GuestLevels({e,ctx}:{e:ClubEvent;ctx:Ctx}){
 const {data,name}=ctx;
 const manager=canManageEvent(data.me,e),ids=new Set(data.registrations.filter(r=>r.eventId===e.id&&r.status!=='cancelled').map(r=>r.playerId));
 const guests=data.players.filter(p=>p.guest&&ids.has(p.id));
 if(!guests.length)return null;
 const editable=(p:typeof guests[number])=>!ctx.readOnly&&(manager||data.me.role==='admin'||p.ownerId===data.me.id);
 const change=(p:typeof guests[number])=>ctx.open('修改 '+name(p.id)+' 的水平','guestLevel',{playerId:p.id,level:String(p.guestLevel??defaultGuestLevel)},[choice('level','朋友水平',guestLevels.map(([v,label])=>[String(v),label+' · '+v]))],v=>({playerId:p.id,level:Number(v.level)}),'用于分队和计算同场球友的修为得失；朋友自己不计修为和积分。修改后只影响之后的比赛。');
 const setGender=(p:typeof guests[number])=>ctx.open('修改 '+name(p.id)+' 的性别','guestGender',{playerId:p.id,gender:p.guestGender??''},[choice('gender','朋友性别',[['male','男'],['female','女']])],v=>({playerId:p.id,gender:v.gender}),'用于双打分队：只要能排成混双，就不会安排男双对女双。修改后只影响之后排出的比赛。');
 const missing=guests.filter(p=>!p.guestGender).length;
 return <details className="ev-details guest-levels" open={missing>0||undefined}><summary>临时来宾 · {guests.length} 人（不计积分）{missing>0&&<> · {missing} 人未填性别</>}</summary><div className="ev-details-content">
  {missing>0&&<p className="hint">未填性别的朋友在分队时会按男生处理，请补上性别。</p>}
  {guests.map(p=><p key={p.id} className="row"><span><strong>{name(p.id)}</strong> · {p.guestHost??'球友'}的朋友 · {p.guestGender?genders[p.guestGender]:'未填性别'} · {guestLevelLabel(p.guestLevel)}</span>{editable(p)&&<span className="actions"><button type="button" className="ghost" disabled={ctx.busy} onClick={()=>setGender(p)}>改性别</button><button type="button" className="ghost" disabled={ctx.busy} onClick={()=>change(p)}>改水平</button></span>}</p>)}
 </div></details>;
}
