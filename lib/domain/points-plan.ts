import {z} from 'zod';
import {propose,validateRound} from './grouping';
import {pointsRoundWindows} from './points-phases';
import {fixedPartnerTeams,proposeFixed} from './fixed-partners';
import {decorateMatch} from './play';
import {authorizeEventAction} from './permissions';
import {businessTimestamp} from './timestamp';
import {fail,type State,type Account,type Event,type Match,type Round} from './types';

export {defaultPointsMinutes,pointsWindow,isPointsTime} from './points-window';

const minute=60000;
const id=z.string().min(1).max(100);
const schemas:Record<string,z.ZodTypeAny>={
 planPoints:z.object({eventId:id,at:businessTimestamp,pointsMinutes:z.number().int().min(5).max(720),roundMinutes:z.number().int().min(5).max(60),seed:z.number().int().min(1).max(2147483647),pairing:z.enum(['rotate','fixed'])}),
 publishPoints:z.object({eventId:id}),
};
export async function applyPointsPlan(s:State,a:Account,action:string,input:unknown,now:number){
 const schema=Object.hasOwn(schemas,action)?schemas[action]:undefined;if(!schema)return false;
 const p=schema.parse(input) as any;authorizeEventAction(s,a,action,p);
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 if(['draft','ended','cancelled'].includes(e.status))fail('请在活动开放后、结束前安排积分赛');
 if(s.matches.some(m=>m.eventId===e.id&&['playing','complete','forfeit'].includes(m.status)))fail('已有比赛开始或完成，请保留现有安排；积分赛须在开打前一次分配');
 if(action==='publishPoints'){
  const rounds=s.rounds.filter(r=>r.eventId===e.id&&r.pointsSlot!==undefined&&r.status==='draft');
  if(!rounds.length)fail('请先安排积分赛轮次');
  for(const r of rounds)validateRound(s,e.id,r.start,r.duration,s.matches.filter(m=>m.roundId===r.id));
  for(const r of rounds){r.status='published';s.matches.filter(m=>m.roundId===r.id).forEach(m=>m.status='published')}
 }else{
  const end=p.at+p.pointsMinutes*minute;
  if(p.at<e.start||end>e.end)fail('积分赛时段须在活动时间内');
  if(e.playMode==='arena')fail('擂台依赖上一轮胜负，请先切换为公平轮转或个人轮转，再提前分配积分赛');
  // Build on a clone so a gap in attendance/court availability never leaves a
  // partial schedule or removes the organiser's previous valid arrangement.
  const working=structuredClone(s),event=working.events.find(x=>x.id===e.id)!;
  event.attendanceMode='automatic';const teams=p.pairing==='fixed'?fixedPartnerTeams(working,event):undefined;
  const replaced=new Set(working.rounds.filter(r=>r.eventId===e.id&&['draft','published'].includes(r.status)).map(r=>r.id));
  working.rounds.filter(r=>replaced.has(r.id)).forEach(r=>r.status='cancelled');
  working.matches.filter(m=>replaced.has(m.roundId)).forEach(m=>m.status='cancelled');
  const windows=pointsRoundWindows(working,event,p.at,end,p.roundMinutes);
  const plannedRounds:Round[]=[],plannedMatches:Match[]=[];
  for(const [i,{start:at,duration}] of windows.entries()){
   let proposal:ReturnType<typeof propose>;
   try{proposal=teams?proposeFixed(working,event,at,duration,((p.seed+i*7919)%2147483647)||1,teams):propose(working,event,at,duration,((p.seed+i*7919)%2147483647)||1)}catch(error){fail(`第${i+1}轮无法安排：${error instanceof Error?error.message:'请检查参加时间和场地'}`)}
   const r:Round={id:crypto.randomUUID(),eventId:e.id,start:at,duration,status:'published',eligible:proposal.eligible,rest:proposal.rest,seed:((p.seed+i*7919)%2147483647)||1,pointsSlot:i+1};
   working.rounds.push(r);plannedRounds.push(r);
   for(const court of proposal.courts){
    const m:Match={...court,id:crypto.randomUUID(),eventId:e.id,roundId:r.id,status:'published',start:null,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};
    decorateMatch(working,event,m);working.matches.push(m);plannedMatches.push(m);
   }
  }
  // Published status above makes the existing fair rotation algorithm count
  // earlier planned turns. Commit as editable drafts until the organiser publishes.
  plannedRounds.forEach(r=>r.status='draft');plannedMatches.forEach(m=>m.status='draft');
  e.pointsPlan={start:p.at,end,roundMinutes:p.roundMinutes,seed:p.seed,generatedAt:now};e.attendanceMode='automatic';e.pointsChoice={...(e.pointsChoice??{votes:[]}),selectedMode:p.pairing,votingOpen:false,teams};
  s.rounds=working.rounds;s.matches=working.matches;
 }
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'提前安排积分赛',changes:p});return true;
}
