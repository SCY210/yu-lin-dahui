import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {canManageEvent} from './permissions';
import {guestLevelAt,guestLevelValues,isGuest} from './guests';
import {replayRating} from './ranking';
import {fail,type State,type Account} from './types';

export const guestLevelInput=z.number().int().refine(v=>guestLevelValues.includes(v),'请选择朋友水平');
const schemas={guestLevel:z.object({playerId:z.string().min(1).max(100),level:guestLevelInput})};

/** The registrant who brought the friend, an administrator, or the organiser of an activity the friend joined. */
export function canSetGuestLevel(s:Pick<State,'players'|'events'|'registrations'>,a:Pick<Account,'id'|'role'|'playerId'>,playerId:string){
 const player=s.players.find(p=>p.id===playerId);if(!player)return false;
 if(a.role==='admin'||player.ownerId===a.id)return true;
 const joined=new Set(s.registrations.filter(r=>r.playerId===playerId&&r.status!=='cancelled').map(r=>r.eventId));
 return s.events.some(e=>joined.has(e.id)&&e.deletedAt===undefined&&canManageEvent(a,e));
}

/** A level change applies from now on: earlier games keep the level the friend had then. Friends never gain points. */
export async function applyGuestLevel(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 const p=command.payload,player=s.players.find(x=>x.id===p.playerId)??fail('球友不存在');
 if(!isGuest(s,player.id))fail('只有代报名的朋友可以设置水平');
 if(!canSetGuestLevel(s,a,player.id))fail('403: 只有拉朋友的人、活动创建者或管理员可以修改朋友水平');
 const before=guestLevelAt(player);player.guestLevels=[...(player.guestLevels??[]),{at:now,level:p.level}];
 replayRating(s,now);
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'修改朋友水平',changes:{playerId:player.id,before,after:p.level}});
 return true;
}
