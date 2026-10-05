import {z} from 'zod';
import {authorizeEventAction} from './permissions';
import {fail,type Account,type Event,type State} from './types';

type ShuttleState={players:Pick<State['players'][number],'id'|'enabled'>[];registrations:Pick<State['registrations'][number],'eventId'|'status'|'playerId'>[]};
export function shuttleParticipantIds(s:ShuttleState,eventId:string){
 const enabled=new Set(s.players.filter(p=>p.enabled).map(p=>p.id));
 return new Set(s.registrations.filter(r=>r.eventId===eventId&&r.status!=='cancelled'&&enabled.has(r.playerId)).map(r=>r.playerId));
}
export function canVoteForShuttle(s:ShuttleState,e:Event,a:Pick<Account,'playerId'>,now=Date.now()){
 return e.deletedAt===undefined&&['open','locked'].includes(e.status)&&now<e.start&&!!e.shuttlePlan?.votingOpen&&shuttleParticipantIds(s,e.id).has(a.playerId);
}
export function shuttleVoteCounts(s:ShuttleState,e:Event){
 const participants=shuttleParticipantIds(s,e.id),counts:Record<string,number>={};
 for(const option of e.shuttlePlan?.options??[])counts[option.id]=0;
 for(const vote of e.shuttlePlan?.votes??[])if(participants.has(vote.playerId)&&Object.hasOwn(counts,vote.optionId))counts[vote.optionId]++;
 return counts;
}

const id=z.string().min(1).max(100);
const schemas:Record<string,z.ZodTypeAny>={
 shuttleOption:z.object({eventId:id,name:z.string().trim().min(1).max(100),note:z.string().trim().max(300).default('')}),
 shuttleRemove:z.object({eventId:id,optionId:id}),
 shuttleConfirm:z.object({eventId:id,optionId:id.nullable()}),
 shuttleVoting:z.object({eventId:id,open:z.boolean()}),
 shuttleVote:z.object({eventId:id,optionId:id.nullable()}),
};
export async function applyShuttles(s:State,a:Account,action:string,input:unknown,now:number){
 const schema=Object.hasOwn(schemas,action)?schemas[action]:undefined;if(!schema)return false;
 const p=schema.parse(input) as any;
 if(action!=='shuttleVote')authorizeEventAction(s,a,action,p);
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 if(['ended','cancelled'].includes(e.status))fail('活动已结束或取消，不能修改用球或投票');
 const plan=e.shuttlePlan??{options:[],votes:[],votingOpen:false};
 if(action==='shuttleVote'){
  if(!canVoteForShuttle(s,e,a,now))fail('403: 用球投票仅对已接龙成员开放，且须在活动开始前进行');
  if(p.optionId!==null&&!plan.options.some(o=>o.id===p.optionId))fail('候选球不存在，请刷新后重试');
  plan.votes=plan.votes.filter(v=>v.voterId!==a.id);
  if(p.optionId!==null)plan.votes.push({id:crypto.randomUUID(),voterId:a.id,playerId:a.playerId,optionId:p.optionId,at:now});
 }else if(action==='shuttleOption'){
  if(plan.options.length>=12)fail('每次活动最多添加12种候选球');
  if(plan.options.some(o=>o.name.toLocaleLowerCase()===p.name.toLocaleLowerCase()&&o.note===p.note))fail('这款候选球已添加');
  plan.options.push({id:crypto.randomUUID(),name:p.name,note:p.note});
 }else if(action==='shuttleRemove'){
  if(!plan.options.some(o=>o.id===p.optionId))fail('候选球不存在');
  if(plan.selectedId===p.optionId)fail('请先更换或清除已确认的用球，再移除此候选球');
  plan.options=plan.options.filter(o=>o.id!==p.optionId);plan.votes=plan.votes.filter(v=>v.optionId!==p.optionId);
  if(!plan.options.length)plan.votingOpen=false;
 }else if(action==='shuttleConfirm'){
  if(p.optionId!==null&&!plan.options.some(o=>o.id===p.optionId))fail('候选球不存在');
  plan.selectedId=p.optionId??undefined;plan.votingOpen=false;
 }else if(action==='shuttleVoting'){
  if(p.open&&(!plan.options.length||now>=e.start||!['open','locked'].includes(e.status)))fail('请在活动开始前、开放报名后添加候选球，再开启投票');
  plan.votingOpen=p.open;
 }
 e.shuttlePlan=plan;
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'活动用球与投票',changes:p});return true;
}
