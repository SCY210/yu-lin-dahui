import {z} from 'zod';
import {authorizeEventAction} from './permissions';
import {canVotePointsMode} from './points-voting';
import {fail,type State,type Event,type Account} from './types';

export {pointsModeLabels,pointsChoiceCounts,canVotePointsMode,type PointsMode} from './points-voting';

const id=z.string().min(1).max(100),mode=z.enum(['rotate','fixed']);
const schemas:Record<string,z.ZodTypeAny>={
 pointsModeVote:z.object({eventId:id,mode:mode.nullable()}),
 pointsModeVoting:z.object({eventId:id,open:z.boolean()}),
 pointsModeSelect:z.object({eventId:id,mode}),
};
export async function applyPointsChoice(s:State,a:Account,action:string,input:unknown,now:number){
 const schema=Object.hasOwn(schemas,action)?schemas[action]:undefined;if(!schema)return false;
 const p=schema.parse(input) as any;if(action!=='pointsModeVote')authorizeEventAction(s,a,action,p);
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 if(['ended','cancelled'].includes(e.status))fail('活动已结束或取消');
 const choice=e.pointsChoice??{votes:[],votingOpen:false};
 if(action==='pointsModeVote'){
  if(!canVotePointsMode(s,e,a,now))fail('403: 仅已接龙成员可在活动开始前参与开放的搭档投票');
  choice.votes=choice.votes.filter(v=>v.voterId!==a.id);
  if(p.mode!==null)choice.votes.push({id:crypto.randomUUID(),voterId:a.id,playerId:a.playerId,mode:p.mode,at:now});
 }else if(action==='pointsModeVoting'){
  if(p.open&&(now>=e.start||!['open','locked'].includes(e.status)))fail('请在开放报名后、活动开始前开启投票');
  choice.votingOpen=p.open;
 }else{
  if(s.matches.some(m=>m.eventId===e.id&&['playing','complete','forfeit'].includes(m.status)))fail('比赛已开始，不能更换搭档方式');
  if(p.mode==='fixed'&&e.playMode==='arena')fail('固定搭档请先切换为公平轮转玩法');
  if(choice.selectedMode!==p.mode){
   const rounds=s.rounds.filter(r=>r.eventId===e.id&&['draft','published'].includes(r.status));const ids=new Set(rounds.map(r=>r.id));
   rounds.forEach(r=>r.status='cancelled');s.matches.filter(m=>ids.has(m.roundId)).forEach(m=>m.status='cancelled');
   choice.teams=undefined;
  }
  choice.selectedMode=p.mode;choice.votingOpen=false;
 }
 e.pointsChoice=choice;s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'积分赛搭档投票与确认',changes:p});return true;
}
