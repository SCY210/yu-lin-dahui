'use client';
import {UserX,UserCheck} from 'lucide-react';
import type {ClubData} from '../lib/contracts/club';
import type {Match} from '../lib/domain/types';
import {canManageEvent,canReportNoShow} from '../lib/domain/permissions';
import './match-no-show.css';

type Danger={action:string;payload:Record<string,unknown>;title:string;description:string;reason:string};
type Ctx={data:ClubData;name:(id:string)=>string;readOnly?:boolean;busy?:boolean;setDanger:(value:Danger)=>void};
type ClubEvent=ClubData['events'][number];
const penalty='判 TA 本局负：只扣 TA 的修为和赛季积分（按输一局算）；同场其他人不加不减，也不算上场次数。TA 到场后点“我到了”才会继续被排上场。';

/** On a started match (before any score): who did not show up. Absent players of a no-show are listed. */
export function MatchNoShow({m,ctx}:{m:Match;ctx:Ctx}){
 const {data,name}=ctx,e=data.events?.find(x=>x.id===m.eventId);
 if(!e||e.tournament)return null;
 const absent=m.status==='forfeit'?m.noShow??[]:[];
 const open=(m.status==='playing'&&m.start!==null&&!m.games?.length&&m.scoreA==null)||absent.length>0;
 if(!open)return null;
 const players=[...m.a,...m.b],candidates=players.filter(id=>!absent.includes(id)&&id!==data.me.playerId);
 const allowed=!ctx.readOnly&&!!data.me&&typeof ctx.setDanger==='function'&&canReportNoShow(data.me,e,m,absent)&&candidates.length>0&&absent.length+1<players.length;
 return <div className="match-no-show">
  {absent.length>0&&<p className="match-no-show-result"><UserX size={16} aria-hidden="true"/>{absent.map(name).join('、')} 没到场 · 本局判负</p>}
  {allowed&&<details><summary>{absent.length?'还有人没到？':'有人没到场？'}</summary><div className="actions">{candidates.map(id=><button type="button" key={id} className="ghost danger" disabled={ctx.busy||absent.length+1>=players.length} onClick={()=>ctx.setDanger({action:'noShow',payload:{matchId:m.id,playerIds:[id]},title:'确认 '+name(id)+' 没到场',description:penalty.replaceAll('TA',name(id)),reason:''})}>{name(id)} 没到</button>)}</div></details>}
 </div>;
}

/** Players held out of scheduling after a no-show; they, their registrant or an organiser confirm arrival. */
export function NoShowHold({e,ctx}:{e:ClubEvent;ctx:Ctx}){
 const {data,name}=ctx,held=e.noShowHold??[];
 if(!held.length||ctx.readOnly)return null;
 const manager=canManageEvent(data.me,e),own=(id:string)=>id===data.me.playerId||data.players.find(p=>p.id===id)?.ownerId===data.me.id;
 const visible=held.filter(id=>manager||own(id));
 if(!visible.length)return null;
 return <section className="card no-show-hold" role="status">
  <strong><UserX size={18} aria-hidden="true"/>{visible.some(own)&&!manager?'你被标记为没到场，暂时不会被排上场':'没到场、暂停排场的球友'}</strong>
  <div className="actions">{visible.map(id=><button type="button" key={id} className="primary" disabled={ctx.busy} onClick={()=>ctx.setDanger({action:'noShowArrived',payload:{eventId:e.id,playerId:id},title:name(id)+' 已到场',description:'确认后恢复排场，之后会按场数正常轮换上场。',reason:''})}><UserCheck size={16} aria-hidden="true"/>{id===data.me.playerId?'我到了':name(id)+' 已到场'}</button>)}</div>
 </section>;
}
