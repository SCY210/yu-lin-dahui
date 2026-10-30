import {apply} from './domain/commands';
import {createSimulation,simulationView,type SimulationDocument,type SimulationView} from './admin-simulation';
import {applyLiveOp,finalGames,liveOpInput,liveTally,type LiveScore} from './domain/live-score';
import {defaultScoring,finishedGame,fixtureSides,newTournament,scoringCap,type ScoringRule} from './domain/tournament';
import {realmSnapshot} from './domain/realm-rating';
import {fail,type State} from './domain/types';

/** The competition sandbox (docs/ADMIN_SIMULATION.md): the whole flow of a competition, from choosing the format to the
 * archived results, on a snapshot of real members. It is a separate document from the activity sandbox and never
 * writes the real club, live score table or notifications. */
export const competitionSimulationKey='admin-simulation-competition-v1';
export type CompetitionSimulationDocument=SimulationDocument&{kind:'competition';live:Record<string,LiveScore>};
export type CompetitionSimulationView=SimulationView&{live:Record<string,LiveScore>};
const commands=new Set(['tournamentSettings','tournamentDraw','tournamentKnockout','tournamentReopen','tournamentStart','tournamentReferee','tournamentArchive','score','settle']);
const courts=4,players=16;

/** Up to sixteen members with four courts, all confirmed, and a competition waiting for its format and draw. */
export function createCompetitionSimulation(now:number,club:State|undefined,format:'singles'|'doubles'='doubles'):CompetitionSimulationDocument{
 const base=createSimulation(now,club,players),s=base.state,e=s.events[0];
 e.title='模拟比赛 · '+s.players.length+'人 / '+courts+'场地';e.matchFormat=format;e.tournament=newTournament();
 delete e.schedulingMode;e.note='管理员专用比赛模拟，使用真实球友资料快照。';
 s.bookings=Array.from({length:courts},(_,i)=>({id:'sim-court-'+(i+1),eventId:e.id,name:'模拟 '+(i+1)+' 号场',start:e.start,end:e.end,pricing:'total' as const,cents:0,signupCapacity:s.players.length}));
 delete s.settings.pairingOdds;
 return {...base,kind:'competition',live:{}};
}

export function competitionView(doc:CompetitionSimulationDocument,now:number):CompetitionSimulationView{return {...simulationView(doc,now),live:doc.live}}

/** A random but plausible finished match under the rule: the stronger side wins more often. */
function randomGames(rule:ScoringRule,aStronger:number,random:()=>number){
 const games:{a:number;b:number}[]=[],need=Math.ceil(rule.games/2),wins={a:0,b:0};
 while(wins.a<need&&wins.b<need){
  const winner=random()<aStronger?'a':'b',loser=winner==='a'?'b':'a',close=random()<.25;
  const lost=close?rule.points-1+Math.floor(random()*(scoringCap(rule)-rule.points)):Math.floor(random()*(rule.points-1));
  const won=lost<=rule.points-2?rule.points:Math.min(lost+2,scoringCap(rule)),game={[winner]:won,[loser]:won===scoringCap(rule)?Math.min(lost,won-1):lost} as {a:number;b:number};
  if(!finishedGame(rule,game.a,game.b))continue;games.push(game);wins[winner]++;
 }
 return games;
}

/** One sandbox operation: a real competition command, a live referee operation, or a shortcut that starts every ready
 * fixture on a free court or finishes every match in play with random scores. */
export async function changeCompetitionSimulation(doc:CompetitionSimulationDocument,action:string,payload:Record<string,unknown>,requestId:string,now:number,club?:State):Promise<CompetitionSimulationDocument>{
 if(action==='reset'){const next=createCompetitionSimulation(now,club??doc.state,payload.matchFormat==='singles'?'singles':'doubles');next.revision=doc.revision+1;next.state.revision=next.revision;next.requests=[...doc.requests,requestId].slice(-100);return next}
 if(!commands.has(action)&&!['liveScore','autoStart','autoScore'].includes(action))fail('比赛模拟只允许赛制、抽签、开赛、裁判记分、录分和归档操作');
 const next=structuredClone(doc),s=next.state,a=s.accounts[0],e=s.events[0],t=e.tournament!;
 if(now>=e.end)fail('模拟比赛已过期，请重置模拟比赛后再测试');
 if(s.matches.length>300)fail('模拟记录过多，请重置模拟比赛');
 if(action==='liveScore'){
  const op=liveOpInput.parse(payload),m=s.matches.find(m=>m.id===op.matchId&&t.fixtures.some(f=>f.matchId===m.id))??fail('比赛不存在');
  if(!next.live[m.id]&&m.status!=='playing')fail('请先在对战表中安排开赛');
  if(m.status==='complete'&&op.op!=='swap')fail('比分已经提交');
  try{next.live[m.id]=applyLiveOp(next.live[m.id]??null,op,t.scoring??defaultScoring,{matchId:m.id,eventId:e.id},now)}catch(error){fail(error instanceof Error?error.message:'操作无效')}
 }else if(action==='autoStart'){
  // Free courts take the ready fixtures in order: group fixtures by round, knockout fixtures by round.
  const busy=new Set(s.matches.filter(m=>m.status==='playing').map(m=>m.courtId)),playing=new Set(s.matches.filter(m=>m.status==='playing').flatMap(m=>[...m.a,...m.b]));
  const ready=t.fixtures.filter(f=>!f.matchId&&(f.stage==='knockout'||t.phase==='groups')).sort((x,y)=>x.round-y.round||(x.group??0)-(y.group??0)||x.slot-y.slot);
  let started=0;
  for(const f of ready){
   const court=s.bookings.find(b=>!busy.has(b.id));if(!court)break;
   const {a:ta,b:tb}=fixtureSides(t,s,f);if(!ta||!tb)continue;
   const ids=t.teams.filter(x=>x.id===ta||x.id===tb).flatMap(x=>x.players);if(ids.some(id=>playing.has(id)))continue;
   await apply(s,a,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:court.id},now);busy.add(court.id);ids.forEach(id=>playing.add(id));started++;
  }
  if(!started)fail('没有可以开赛的对阵：请先抽签、录完进行中的比赛，或生成淘汰赛');
 }else if(action==='autoScore'){
  const rule=t.scoring??defaultScoring,ratings=realmSnapshot(s,now),strength=(ids:string[])=>ids.reduce((sum,id)=>sum+(ratings.get(id)?.score??1000),0)/ids.length;
  let seed=(next.revision*2654435761+requestId.length)>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const playing=s.matches.filter(m=>m.status==='playing'&&t.fixtures.some(f=>f.matchId===m.id));
  if(!playing.length)fail('没有进行中的比赛');
  for(const m of playing){
   // A match the referee finished keeps its live result; the others get a random one.
   const live=next.live[m.id],games=live?.status==='finished'?finalGames(rule,liveTally(rule,live.events)):randomGames(rule,1/(1+10**((strength(m.b)-strength(m.a))/400)),random);
   await apply(s,a,'score',{matchId:m.id,a:games[0].a,b:games[0].b,games,reason:'模拟比分'},now);
  }
 }else await apply(s,a,action,payload,now);
 next.revision=doc.revision+1;s.revision=next.revision;next.requests=[...doc.requests,requestId].slice(-100);
 return next;
}
