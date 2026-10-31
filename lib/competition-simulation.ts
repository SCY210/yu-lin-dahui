import {apply} from './domain/commands';
import {isEventAction} from './domain/permissions';
import {createSimulation,simulationView,type SimulationDocument,type SimulationView} from './admin-simulation';
import {applyLiveOp,finalGames,liveOpInput,liveTally,type LiveScore} from './domain/live-score';
import {defaultScoring,finishedGame,matchRule,scoringCap,type ScoringRule} from './domain/tournament';
import {realmSnapshot} from './domain/realm-rating';
import {fail,type Account,type State} from './domain/types';

/** The competition sandbox (docs/ADMIN_SIMULATION.md): a competition debugged end to end without opening a real one.
 * It starts with member snapshots and no competition; the organiser creates it with the real create form, members
 * sign up through the real court signup, and the real competition page runs it from settings and draw to the archive.
 * It is a separate document from the activity sandbox and never writes the real club, live score table or
 * notifications. */
export const competitionSimulationKey='admin-simulation-competition-v1';
export type CompetitionSimulationDocument=SimulationDocument&{kind:'competition';live:Record<string,LiveScore>};
export type CompetitionSimulationView=SimulationView&{live:Record<string,LiveScore>};
/** Signups and fees outside the event action list that the real competition page uses. */
const memberActions=new Set(['event','courtRegister','courtCancel','register','cancel','feePaid','feeTransferPaid']);
const shortcuts=new Set(['liveScore','signup','signupAll','startNow','autoStart','autoScore']);
const players=16;

/** Up to sixteen member snapshots and no competition yet. */
export function createCompetitionSimulation(now:number,club:State|undefined):CompetitionSimulationDocument{
 const base=createSimulation(now,club,players),s=base.state;
 s.settings.name='比赛模拟';s.events=[];s.bookings=[];s.registrations=[];delete s.settings.pairingOdds;
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
/** A member signs up for the whole competition, as on the real page (app/tournament-signup.tsx). */
async function signUp(s:State,account:Account,e:State['events'][number],now:number){
 await apply(s,account,'register',{eventId:e.id,playerId:account.playerId,arrival:e.start,departure:e.end,note:''},now);
}

/** One sandbox operation, run by the sandbox owner account unless it acts for a member (signup). */
export async function changeCompetitionSimulation(doc:CompetitionSimulationDocument,action:string,payload:Record<string,unknown>,requestId:string,now:number,club?:State):Promise<CompetitionSimulationDocument>{
 if(action==='reset'){const next=createCompetitionSimulation(now,club??doc.state);next.revision=doc.revision+1;next.state.revision=next.revision;next.requests=[...doc.requests,requestId].slice(-100);return next}
 if(!shortcuts.has(action)&&!memberActions.has(action)&&!isEventAction(action))fail('比赛模拟只允许比赛相关操作');
 const next=structuredClone(doc),s=next.state,a=s.accounts[0],e=s.events.find(e=>e.deletedAt===undefined);
 if(s.matches.length>300)fail('模拟记录过多，请重置模拟比赛');
 if(action==='event'){
  if(e)fail('模拟里已经有一场比赛，请先重置模拟比赛');
  if(payload.tournament!==true)fail('比赛模拟只能创建比赛');
  await apply(s,a,'event',payload,now);
 }else{
  if(!e)fail('请先创建比赛');
  const t=e.tournament!;
  if(action==='signup'||action==='signupAll'){
   const ids=action==='signup'?[String(payload.playerId)]:s.players.map(p=>p.id);
   for(const id of ids){
    const account=s.accounts.find(x=>x.playerId===id)??fail('球友不存在'),r=s.registrations.find(r=>r.eventId===e.id&&r.playerId===id&&r.status!=='cancelled');
    if(action==='signup'&&payload.cancel===true){if(!r)fail('这位球友没有报名');await apply(s,account,'cancel',{eventId:e.id,playerId:id,reason:'模拟取消报名'},now);continue}
    if(!r)await signUp(s,account,e,now);
   }
  }else if(action==='startNow'){
   // Moves the whole competition so it starts now, as if its day had come; nothing else changes.
   if(e.start<=now)fail('比赛已经开始');const delta=Math.floor(now/60000)*60000-e.start;
   const shift=(x:number)=>x+delta;
   e.start=shift(e.start);e.end=shift(e.end);e.signupDeadline=shift(e.signupDeadline);e.cancelDeadline=shift(e.cancelDeadline);
   for(const b of s.bookings.filter(b=>b.eventId===e.id)){b.start=shift(b.start);b.end=shift(b.end);for(const h of b.handovers??[])h.at=shift(h.at)}
   for(const r of s.registrations.filter(r=>r.eventId===e.id)){r.arrival=shift(r.arrival);r.departure=shift(r.departure);for(const x of r.bookingSignups??[]){x.arrival=shift(x.arrival);x.departure=shift(x.departure)}}
  }else if(action==='liveScore'){
   const op=liveOpInput.parse(payload),m=s.matches.find(m=>m.id===op.matchId&&t.fixtures.some(f=>f.matchId===m.id))??fail('比赛不存在');
   if(!next.live[m.id]&&m.status!=='playing')fail('请先在对战表中安排开赛');
   if(m.status==='complete'&&op.op!=='swap')fail('比分已经提交');
   try{next.live[m.id]=applyLiveOp(next.live[m.id]??null,op,matchRule(t,m.id)??defaultScoring,{matchId:m.id,eventId:e.id},now)}catch(error){fail(error instanceof Error?error.message:'操作无效')}
  }else if(action==='autoStart'){
   // The same arrangement the system runs after every result (arrangeFixtures).
   await apply(s,a,'tournamentArrange',{eventId:e.id},now);
  }else if(action==='autoScore'){
   const ratings=realmSnapshot(s,now),strength=(ids:string[])=>ids.reduce((sum,id)=>sum+(ratings.get(id)?.score??1000),0)/ids.length;
   let seed=(next.revision*2654435761+requestId.length)>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
   const playing=s.matches.filter(m=>m.status==='playing'&&t.fixtures.some(f=>f.matchId===m.id));
   if(!playing.length)fail('没有进行中的比赛');
   for(const m of playing){
    // A match the referee finished keeps its live result; the others get a random one under their stage's rule.
    const rule=matchRule(t,m.id)??defaultScoring,live=next.live[m.id],games=live?.status==='finished'?finalGames(rule,liveTally(rule,live.events)):randomGames(rule,1/(1+10**((strength(m.b)-strength(m.a))/400)),random);
    await apply(s,a,'score',{matchId:m.id,a:games[0].a,b:games[0].b,games,reason:'模拟比分'},now);
   }
  }else await apply(s,a,action,payload,now);
 }
 next.revision=doc.revision+1;s.revision=next.revision;next.requests=[...doc.requests,requestId].slice(-100);
 return next;
}
