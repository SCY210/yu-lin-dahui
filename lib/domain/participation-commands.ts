import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {authorizeEventAction} from './permissions';
import {eventStatusAt} from './event-lifecycle';
import {fillLiveCourts} from './live-play';
import {fail,type State,type Account} from './types';

const id=z.string().min(1).max(100);
const schemas={pointsParticipation:z.object({eventId:id,playerId:id,playing:z.boolean()})};

export function applyParticipation(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 const p=command.payload;authorizeEventAction(s,a,action,p);
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 if(['draft','ended','cancelled'].includes(eventStatusAt(e,now)))fail('只能在活动开放后、结束前调整上场意愿');
 if(!s.players.some(player=>player.id===p.playerId&&player.enabled)||!s.registrations.some(r=>r.eventId===e.id&&r.playerId===p.playerId&&r.status==='confirmed'))fail('只有本活动正式报名球友可以调整上场意愿');
 const stopped=(e.matchingStopped??[]).filter(id=>id!==p.playerId);
 if(!p.playing)stopped.push(p.playerId);
 if(stopped.length)e.matchingStopped=stopped;else delete e.matchingStopped;
 // The current game and any recorded score remain real results. Future pending
 // lineups are validated at publish/start/early-score time instead of forfeited.
 fillLiveCourts(s,e,now);
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:p.playing?'恢复参与排场':'本次不再上场',changes:p});
 return true;
}
