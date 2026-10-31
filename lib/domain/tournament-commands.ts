import {markRanked} from './all-ranked';
import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {authorizeEventAction} from './permissions';
import {eventStatusAt} from './event-lifecycle';
import {automaticEventTitle,eventFormat,teamSize,isPractice} from './match-format';
import {validateRound} from './grouping';
import {fail,month,type State,type Account,type Match,type Event} from './types';
import {isClubOwner} from './ownership';
import {tournamentResults} from './tournament-results';
import {qualifiers,categoryFits,categoryName,categoryProblem,fixtureSides,groupComplete,tournamentFormat,type Tournament,type TournamentFixture} from './tournament';
const id=z.string().min(1).max(100),rule=z.object({games:z.union([z.literal(1),z.literal(3)]),points:z.union([z.literal(11),z.literal(15),z.literal(21)])}).strict();
const schemas={
 tournamentDraw:z.object({eventId:id,teams:z.array(z.array(id).min(1).max(2)).min(2).max(32),groups:z.number().int().min(2).max(8).default(2),advance:z.number().int().min(1).max(4).default(2),seed:z.number().int().min(1).max(2147483647),/** Knockout only: teams are already in seed order (strongest first) instead of drawn at random. */seeded:z.boolean().optional()}),
 tournamentSettings:z.object({eventId:id,format:z.enum(['groups','knockout','round-robin']),category:z.enum(['mens-singles','mens-doubles','mixed-doubles']).nullable(),scoring:rule,/** The knockout rule; omitted, the knockout follows `scoring`. */knockoutScoring:rule.optional(),/** Prize costs in cents; omitted, they stay as they are. */prizes:z.object({first:z.number().int().min(0).max(1000000),second:z.number().int().min(0).max(1000000),third:z.number().int().min(0).max(1000000)}).strict().optional()}),
 tournamentKnockout:z.object({eventId:id}),tournamentReopen:z.object({eventId:id}),
 tournamentStart:z.object({eventId:id,fixtureId:id,courtId:id}),
 tournamentReferee:z.object({eventId:id,fixtureId:id,playerId:id.nullable()}),
 tournamentArchive:z.object({eventId:id,archived:z.boolean()}),
 tournamentArrange:z.object({eventId:id}),
};
/** One round robin per group: every team meets every other once (circle method). */
function roundRobin(group:string[],g:number){
 const fixtures:TournamentFixture[]=[],ring:(string|null)[]=[...group];if(ring.length%2)ring.push(null);
 for(let r=0;r<ring.length-1;r++){for(let i=0;i<ring.length/2;i++){const a=ring[i],b=ring[ring.length-1-i];if(a&&b)fixtures.push({id:crypto.randomUUID(),stage:'group',group:g,round:r+1,slot:i,a,b})}ring.splice(1,0,ring.pop()!)}
 return fixtures;
}
/** The whole elimination tree from its first-round pairs; later rounds take the winners of two adjacent fixtures. */
function bracket(first:{a?:string;b?:string}[]){
 const fixtures:TournamentFixture[]=[];let prior:TournamentFixture[]=[];
 for(let round=1,count=first.length;count>=1;round++,count/=2){const next:TournamentFixture[]=[];for(let slot=0;slot<count;slot++){
  next.push({id:crypto.randomUUID(),stage:'knockout',round,slot,...(round===1?first[slot]:{fromA:prior[slot*2].id,fromB:prior[slot*2+1].id})});
 }fixtures.push(...next);prior=next}
 return fixtures;
}
/** Standard seeding: seeds 1 and 2 can only meet in the final, 1-4 in the semi-finals; empty slots give the top seeds byes. */
export function seededFirstRound(seeds:string[]){
 let size=2;while(size<seeds.length)size*=2;
 let order=[0];while(order.length<size){const n=order.length*2;order=order.flatMap(i=>[i,n-1-i])}
 return Array.from({length:size/2},(_,i)=>({a:seeds[order[i*2]],b:seeds[order[i*2+1]]}));
}
/** The knockout from the group tables: group winners first, then runners-up, in standard seeding so the best can
 * only meet late; first-round opponents come from different groups where possible. */
export function generateKnockout(t:Tournament,s:Pick<State,'matches'>){
 const first=seededFirstRound(qualifiers(t,s)),groupOf=(id:string|undefined)=>t.groups.findIndex(g=>g.includes(id??''));
 for(let i=0;i<first.length;i++){const pair=first[i];if(!pair.a||!pair.b||groupOf(pair.a)!==groupOf(pair.b))continue;
  const j=first.findIndex((other,j)=>j!==i&&other.a&&other.b&&groupOf(pair.a)!==groupOf(other.b)&&groupOf(other.a)!==groupOf(pair.b));
  if(j>=0)[pair.b,first[j].b]=[first[j].b,pair.b];
 }
 t.fixtures.push(...bracket(first));t.phase='knockout';
}
/** Once the last group result is in, the knockout is drawn without anyone pressing a button (autoArrange). */
export function advanceAfterGroups(s:State,e:Event,now:number){
 const t=e.tournament;if(!t?.autoArrange||tournamentFormat(t)!=='groups'||t.phase!=='groups'||!groupComplete(t,s))return false;
 generateKnockout(t,s);s.audits.push({id:crypto.randomUUID(),at:now,actor:'system',action:'tournamentKnockout',reason:'小组赛结束，自动生成淘汰赛',changes:{eventId:e.id}});return true;
}
/** Puts one ready fixture on a court: both sides known, the court booked now and free, the players not on court. */
function startFixture(s:State,e:Event,f:TournamentFixture,courtId:string,now:number){
 const t=e.tournament!;
 if(f.matchId)fail('409: 这场比赛已开始，请刷新');
 if(f.stage==='group'&&t.phase!=='groups')fail('小组赛已封存');
 const sides=fixtureSides(t,s,f);if(!sides.a||!sides.b)fail('请等待前序赛果；轮空无需开赛');
 const ta=t.teams.find(x=>x.id===sides.a)!,tb=t.teams.find(x=>x.id===sides.b)!;
 const court=s.bookings.find(x=>x.id===courtId&&x.eventId===e.id)??fail('场地不存在');
 if(s.matches.some(m=>m.status==='playing'&&s.bookings.some(b=>b.id===m.courtId&&b.name===court.name&&(b.venue??s.events.find(x=>x.id===b.eventId)?.venue)===(court.venue??e.venue))))fail('这片场地正在比赛');
 if(now<e.start||now>=e.end||now<court.start||now>=court.end)fail('当前不在赛事或场地预约时间内');
 const roundId=crypto.randomUUID(),m:Match={id:crypto.randomUUID(),eventId:e.id,roundId,courtId:court.id,a:[...ta.players],b:[...tb.players],status:'playing',start:now,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:true,enteredBy:null,games:[]};
 validateRound(s,e.id,now,0,[m]);
 s.rounds.push({id:roundId,eventId:e.id,start:now,duration:0,status:'playing',eligible:[...m.a,...m.b],rest:[],seed:1});markRanked(m,e);s.matches.push(m);f.matchId=m.id;
 if(!s.seasons.some(x=>x.id===month(now)))s.seasons.push({id:month(now),rules:{...s.settings.rules},version:1});
}
/** The system schedules the competition (docs/TOURNAMENTS.md): every free court booked now takes the ready fixture
 * whose teams have played least and waited longest, so everyone plays about as often and nobody sits out for long.
 * Earlier rounds go first, and a player already on court waits. Returns the started fixtures. */
export function arrangeFixtures(s:State,e:Event,now:number){
 const t=e.tournament;if(!t||t.archive||t.phase==='setup'||e.deletedAt!==undefined||['draft','cancelled'].includes(e.status)||now<e.start||now>=e.end)return [];
 const own=s.matches.filter(m=>m.eventId===e.id),started:TournamentFixture[]=[];
 const teamOf=(id:string)=>t.teams.find(x=>x.id===id)!,players=(f:TournamentFixture)=>{const {a,b}=fixtureSides(t,s,f);return a&&b?[...teamOf(a).players,...teamOf(b).players]:null};
 const played=(id:string)=>own.filter(m=>m.status==='complete'&&[...m.a,...m.b].includes(id)).length;
 const rested=(id:string)=>Math.max(e.start,...own.filter(m=>[...m.a,...m.b].includes(id)).map(m=>m.end??now));
 for(;;){
  const busyCourts=new Set(s.matches.filter(m=>m.status==='playing').map(m=>m.courtId)),onCourt=new Set(s.matches.filter(m=>m.status==='playing').flatMap(m=>[...m.a,...m.b]));
  const court=s.bookings.filter(b=>b.eventId===e.id&&b.start<=now&&b.end>now&&!busyCourts.has(b.id)).sort((a,b)=>a.name.localeCompare(b.name,'zh'))[0];if(!court)break;
  const ready=t.fixtures.filter(f=>!f.matchId&&(f.stage==='knockout'||t.phase==='groups')).flatMap(f=>{const ids=players(f);return ids&&!ids.some(id=>onCourt.has(id))?[{f,ids}]:[]});
  if(!ready.length)break;
  const minRound=Math.min(...ready.map(x=>x.f.round+(x.f.stage==='knockout'?100:0)));
  const pick=ready.filter(x=>x.f.round+(x.f.stage==='knockout'?100:0)===minRound).sort((x,y)=>x.ids.reduce((n,id)=>n+played(id),0)-y.ids.reduce((n,id)=>n+played(id),0)||Math.max(...x.ids.map(rested))-Math.max(...y.ids.map(rested))||(x.f.group??0)-(y.f.group??0)||x.f.slot-y.f.slot)[0];
  // The court's referee stays on for its next fixture unless they play in it.
  const last=t.fixtures.filter(f=>f.referee&&own.some(m=>m.id===f.matchId&&m.courtId===court.id)).sort((x,y)=>(own.find(m=>m.id===y.matchId)?.start??0)-(own.find(m=>m.id===x.matchId)?.start??0))[0];
  if(!pick.f.referee&&last?.referee&&!pick.ids.includes(last.referee))pick.f.referee=last.referee;
  try{startFixture(s,e,pick.f,court.id,now);started.push(pick.f)}catch{break}
 }
 return started;
}
export async function applyTournament(s:State,a:Account,action:string,input:unknown,now:number){
 const c=parseDomainCommand(schemas,action,input);if(!c)return false;
 const p=c.payload;authorizeEventAction(s,a,action,p);
 const e=s.events.find(e=>e.id===p.eventId)??fail('比赛不存在'),t=e.tournament??fail('此活动不是赛事');
 if(c.action==='tournamentSettings'){
  const p=c.payload;
  if(a.role!=='admin'&&!isClubOwner(s,a))fail('403: 只有群主和管理员可以设置赛制和报名费');
  if(e.status==='cancelled')fail('比赛已取消');
  const category=p.category??undefined,singles=teamSize(e)===1;
  if(category&&!categoryFits(category,singles))fail(singles?'单打比赛只能选择单打或男单':'双打比赛只能选择男双或混双');
  if(!singles&&!category&&t.category)fail('双打比赛请选择男双或混双');
  const knockoutScoring=p.knockoutScoring??p.scoring;
  const changed=p.format!==tournamentFormat(t)||category!==t.category||JSON.stringify(p.scoring)!==JSON.stringify(t.scoring)||JSON.stringify(knockoutScoring)!==JSON.stringify(t.knockoutScoring??t.scoring);
  if(changed&&t.phase!=='setup')fail('抽签后不能更改赛制、项目或计分规则；可以继续调整奖品');
  t.format=p.format;t.scoring=p.scoring;t.knockoutScoring=knockoutScoring;if(category)t.category=category;else delete t.category;
  if(e.automaticTitle)e.title=automaticEventTitle(e.start,eventFormat(e),categoryName(t,singles));
  if(p.prizes)t.prizes=p.prizes;
  s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:c.action,reason:'比赛设置',changes:{eventId:e.id,format:p.format,category:category??null,scoring:p.scoring,knockoutScoring,prizes:p.prizes??null}});return true;
 }
 if(c.action==='tournamentArchive'){
  // One click files a finished competition under past competitions with its results frozen, names included.
  if(!c.payload.archived){if(!t.archive)fail('比赛没有归档');delete t.archive}
  else{
   if(t.archive)fail('比赛已经归档');
   const results=tournamentResults(t,s)??fail('比赛还没有决出冠军，不能归档');
   t.archive={at:now,by:a.id,results:results.map(r=>({...r,players:r.players.map(id=>({id,name:s.players.find(p=>p.id===id)?.name??'球友'}))}))};
  }
  s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:c.action,reason:c.payload.archived?'归档比赛':'取消归档',changes:{eventId:e.id}});return true;
 }
 if(t.archive)fail('比赛已归档，请先取消归档');
 if(isPractice(e)||['draft','ended','cancelled'].includes(eventStatusAt(e,now)))fail('赛事尚未开放或已经结束');
 switch(c.action){
  case 'tournamentDraw':{
   const p=c.payload;
   if(s.matches.some(m=>m.eventId===e.id))fail('比赛已开打，不能重新抽签');
   const players=p.teams.flat(),size=teamSize(e);
   if(p.teams.some(team=>team.length!==size)||new Set(players).size!==players.length)fail('请检查队伍人数，每人只能参加一队');
   if(players.some(id=>!s.players.some(x=>x.id===id&&x.enabled)||!s.registrations.some(r=>r.eventId===e.id&&r.playerId===id&&r.status==='confirmed')))fail('只可选择本赛事正式报名的球友');
   const format=tournamentFormat(t);
   for(const team of p.teams){const problem=categoryProblem(t.category,team.map(id=>s.players.find(x=>x.id===id)!));if(problem)fail(problem)}
   if(format==='groups'&&(p.teams.length<4||p.groups*2>p.teams.length||p.advance>Math.floor(p.teams.length/p.groups)))fail('至少 4 队；每组至少两队，晋级名额不能超过最小组人数');
   if(format==='round-robin'&&p.teams.length>16)fail('单循环最多 16 队');
   let seed=p.seed>>>0;const shuffled=p.teams.map(players=>({id:crypto.randomUUID(),players}));
   if(!(format==='knockout'&&p.seeded))for(let i=shuffled.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
   const settings={format:t.format,category:t.category,scoring:t.scoring,knockoutScoring:t.knockoutScoring,prizes:t.prizes,autoArrange:t.autoArrange};
   if(format==='knockout'){e.tournament={...settings,phase:'knockout',teams:shuffled,groups:[],advance:1,fixtures:bracket(seededFirstRound(shuffled.map(team=>team.id)))};break}
   const groups=format==='round-robin'?[shuffled.map(team=>team.id)]:Array.from({length:p.groups},()=>[] as string[]);
   if(format==='groups')shuffled.forEach((team,i)=>groups[i%p.groups].push(team.id));
   e.tournament={...settings,phase:'groups',teams:shuffled,groups,advance:format==='round-robin'?1:p.advance,fixtures:groups.flatMap(roundRobin)};break;
  }
  case 'tournamentKnockout':{
   if(tournamentFormat(t)!=='groups')fail('本赛制没有小组赛晋级');
   if(t.phase!=='groups'||!groupComplete(t,s))fail('请先完成所有小组赛');
   generateKnockout(t,s);break;
  }
  case 'tournamentReopen':{
   if(tournamentFormat(t)!=='groups'||t.phase!=='knockout'||t.fixtures.some(f=>f.stage==='knockout'&&f.matchId))fail('淘汰赛已开打，不能返回小组赛');
   t.fixtures=t.fixtures.filter(f=>f.stage==='group');t.phase='groups';break;
  }
  case 'tournamentReferee':{
   // Any member may referee a fixture they do not play in; they then score it live on their phone (docs/LIVE_SCORING.md).
   const p=c.payload,f=t.fixtures.find(f=>f.id===p.fixtureId)??fail('对阵不存在');
   if(p.playerId===null){delete f.referee;break}
   if(!s.players.some(x=>x.id===p.playerId&&x.enabled)||!s.accounts.some(x=>x.playerId===p.playerId))fail('裁判需要是有账号的球友');
   const sides=fixtureSides(t,s,f),playing=t.teams.filter(team=>team.id===sides.a||team.id===sides.b).flatMap(team=>team.players);
   if(playing.includes(p.playerId))fail('参赛选手不能给自己的比赛当裁判');
   f.referee=p.playerId;break;
  }
  case 'tournamentStart':{const p=c.payload;startFixture(s,e,t.fixtures.find(f=>f.id===p.fixtureId)??fail('对阵不存在'),p.courtId,now);break}
  case 'tournamentArrange':{if(!arrangeFixtures(s,e,now).length)fail(now<e.start?'比赛还没开始':'没有可以开赛的对阵或空闲场地');break}
 }
 if(['tournamentDraw','tournamentKnockout'].includes(c.action)&&e.tournament?.autoArrange)arrangeFixtures(s,e,now);
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'赛事安排',changes:{eventId:e.id}});return true;
}
