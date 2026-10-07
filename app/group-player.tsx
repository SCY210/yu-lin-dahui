'use client';
import {ArrowLeftRight} from 'lucide-react';
import {Avatar} from './avatar';
import './group-player.css';

/** Profile navigation is separate from editing the draft position. */
type Props={id:string;ctx:{data:{players:{id:string;name:string;avatarId?:string}[]};name:(id:string)=>string;openProfile?:(id:string)=>void;busy?:boolean};interactive?:boolean;selected?:string;onSelect?:(id:string)=>void;role?:string};
export default function GroupPlayer({id,ctx,interactive=false,selected='',onSelect,role}:Props) {
 const player=ctx.data.players.find(p=>p.id===id);
 return <div className={'group-player '+(selected===id?'is-selected':'')}>
  <button type="button" className="group-player-profile" disabled={!ctx.openProfile} onClick={()=>ctx.openProfile?.(id)} aria-label={'查看'+ctx.name(id)+'的球友档案'}>
   <Avatar p={player}/><span>{ctx.name(id)}{role&&<small className="role-label">{role}</small>}</span>
  </button>
  {interactive&&<button type="button" className="group-player-swap" disabled={ctx.busy} aria-pressed={selected===id} aria-label={(selected===id?'取消选择':'选择交换')+'：'+ctx.name(id)} title="选择两位球友交换位置" onClick={()=>onSelect?.(id)}><ArrowLeftRight size={16} aria-hidden="true"/></button>}
 </div>;
}
