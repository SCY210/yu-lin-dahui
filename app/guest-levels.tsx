'use client';
import type {ClubData} from '../lib/contracts/club';
import {canManageEvent} from '../lib/domain/permissions';
import {guestLevels,guestLevelLabel,defaultGuestLevel} from '../lib/domain/guests';
import {choice,type Field} from './form-fields';

type Ctx={data:ClubData;name:(id:string)=>string;busy?:boolean;readOnly?:boolean;open:(title:string,action:string,values:Record<string,unknown>,fields:Field[],convert?:(v:Record<string,unknown>)=>Record<string,unknown>,description?:string)=>void};
type ClubEvent=ClubData['events'][number];

/** Friends signed up for this activity, with their level. The registrant and the organisers can change it;
 * a change counts from now on and friends never collect rating or points. */
export default function GuestLevels({e,ctx}:{e:ClubEvent;ctx:Ctx}){
 const {data,name}=ctx;
 const manager=canManageEvent(data.me,e),ids=new Set(data.registrations.filter(r=>r.eventId===e.id&&r.status!=='cancelled').map(r=>r.playerId));
 const guests=data.players.filter(p=>p.guest&&ids.has(p.id));
 if(!guests.length)return null;
 const editable=(p:typeof guests[number])=>!ctx.readOnly&&(manager||data.me.role==='admin'||p.ownerId===data.me.id);
 const change=(p:typeof guests[number])=>ctx.open('修改 '+name(p.id)+' 的水平','guestLevel',{playerId:p.id,level:String(p.guestLevel??defaultGuestLevel)},[choice('level','朋友水平',guestLevels.map(([v,label])=>[String(v),label+' · '+v]))],v=>({playerId:p.id,level:Number(v.level)}),'用于分队和计算同场球友的修为得失；朋友自己不计修为和积分。修改后只影响之后的比赛。');
 return <details className="ev-details guest-levels"><summary>临时朋友 · {guests.length} 人（不计积分）</summary><div>
  {guests.map(p=><p key={p.id} className="row"><span><strong>{name(p.id)}</strong> · {p.guestHost??'球友'}的朋友 · {guestLevelLabel(p.guestLevel)}</span>{editable(p)&&<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>change(p)}>改水平</button>}</p>)}
 </div></details>;
}
