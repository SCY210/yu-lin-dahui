import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {authorizeEventAction} from './permissions';
import {eventStatusAt} from './event-lifecycle';
import {schedulingMode,pendingSchedulingIds,cancelPendingScheduling} from './scheduling';
import {fail,type State,type Account} from './types';
const id=z.string().min(1).max(100),mode=z.enum(['planned','round','live']);
const schemas={schedulingMode:z.object({eventId:id,mode,expectedMode:mode,expectedPendingIds:z.array(id).max(1000)})};
export async function applyScheduling(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 const p=command.payload;authorizeEventAction(s,a,action,p);
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 if(['draft','ended','cancelled'].includes(eventStatusAt(e,now)))fail('请在活动开放后、结束前切换排场方式');
 const before=schedulingMode(s,e),pending=pendingSchedulingIds(s,e.id);
 if(before!==p.expectedMode||JSON.stringify(pending)!==JSON.stringify([...p.expectedPendingIds].sort()))fail('409: 排场安排已更新，请刷新后重新确认切换');
 if(before===p.mode)return true;
 const cancelledMatchIds=cancelPendingScheduling(s,e.id);
 if(e.livePlay){e.livePlay.enabled=false;e.livePlay.paused=false}
 e.schedulingMode=p.mode;
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'切换排场方式',changes:{eventId:e.id,before,after:p.mode,cancelledMatchIds}});
 return true;
}
