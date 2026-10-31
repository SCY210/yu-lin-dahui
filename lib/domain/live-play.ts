import {matchingStopped} from './matching-participation';
import {awaitingArrival,clearFilledPointsWaiting} from './points-attendance';
import {cancelPendingScheduling} from './scheduling';
import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {liveActivityAvailable,liveAvailabilityTime} from './live-window';
import {bookingAllowsPlayer,registrationSpans} from './booking-signups';
import {fixedPartnerTeams} from './fixed-partners';
import {balanceCost,compareBalance} from './match-balance';
import {genderMismatches} from './gender-balance';
import {matchHistory} from './match-history';
import {authorizeEventAction,canManageEvent,canRecordScore} from './permissions';
import {canEnableEventRanking} from './event-ranking';
import {decorateMatch} from './play';
import {markRanked} from './all-ranked';
import {eventPairingOdds,oddsRandom,oddsSplits} from './pairing-odds';
import {eventFormat,courtPlayers,isPractice} from './match-format';
import {fail,month,type State,type Event,type Account,type Match,type LivePlay} from './types';

const id=z.string().min(1).max(100);
const schemas={
 liveStart:z.object({eventId:id}),livePause:z.object({eventId:id,paused:z.boolean()}),
 livePreference:z.object({eventId:id,playerId:id,avoidConsecutive:z.boolean()}),
 liveReady:z.object({eventId:id,playerId:id}),
 liveNext:z.object({eventId:id,courtId:id,allowSame:z.boolean().optional()}),
};
const playing=(m:Match)=>m.status==='playing';
const physical=(s:Pick<State,'bookings'>,e:Event,courtId:string)=>{
 const b=s.bookings.find(b=>b.id===courtId);return JSON.stringify([b?.venue??e.venue,b?.name??courtId]);
};
export function liveAppearances(s:Pick<State,'matches'>,eventId:string,playerId:string){
 return s.matches.filter(m=>m.eventId===eventId&&m.start!==null&&['playing','complete','forfeit'].includes(m.status)&&[...m.a,...m.b].includes(playerId)&&(!m.noShow?.length||m.noShow.includes(playerId))).length;
}
export function livePresentIds(s:Pick<State,'players'|'registrations'|'bookings'|'attendance'>,e:Event,now:number){
 const at=liveAvailabilityTime(e,now);
 const enabled=new Set(s.players.filter(p=>p.enabled&&!e.noShowHold?.includes(p.id)&&!matchingStopped(e,p.id)).map(p=>p.id));
 return s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed'&&!awaitingArrival(e,r.playerId)&&enabled.has(r.playerId)&&
  registrationSpans(s as State,e,r).some(span=>span.start<=at&&(span.end??e.end)>at)&&
  !s.attendance.some(at=>at.eventId===e.id&&at.playerId===r.playerId&&at.state==='paused'&&at.end===null))
  .sort((a,b)=>a.sequence-b.sequence||a.playerId.localeCompare(b.playerId)).map(r=>r.playerId);
}
/** Only a voluntary break (the do-not-play-consecutively preference) keeps a player off. Retired automatic breaks
 * (`win-limit`, `two-wins`) may remain in stored data and are ignored. */
export function liveResting(e:Event,playerId:string,venue?:string){
 return !!e.livePlay?.rest.some(rest=>rest.reason===undefined&&rest.playerId===playerId&&(!venue||rest.venue===venue));
}
const winners=(m:Match)=>m.status==='complete'&&m.scoreA!==null&&m.scoreB!==null&&m.scoreA!==m.scoreB?(m.scoreA>m.scoreB?m.a:m.b):[];
/** Each player's current run of live wins in a row, whatever their partners or courts; a loss resets it. */
export function liveWinStreaks(s:Pick<State,'matches'|'rounds'>,e:Event){
 const rounds=new Set(s.rounds.filter(r=>r.eventId===e.id&&r.live).map(r=>r.id));
 const runs=new Map<string,number>();
 const games=s.matches.filter(m=>m.eventId===e.id&&rounds.has(m.roundId)&&m.start!==null&&['complete','forfeit'].includes(m.status)).sort((a,b)=>(a.end??a.start!)-(b.end??b.start!)||a.start!-b.start!);
 for(const m of games){const won=new Set(winners(m));for(const id of [...m.a,...m.b])runs.set(id,won.has(id)?(runs.get(id)??0)+1:0)}
 return runs;
}
/** Cheap no-work guard for read maintenance; use the same physical-court identity as fillLiveCourts. */
export function hasEmptyLiveCourt(s:Pick<State,'bookings'|'matches'>,e:Event,now:number){
 const busy=new Set<string>(),used=new Set<string>();
 for(const m of s.matches)if(m.eventId===e.id){if(playing(m))busy.add(physical(s,e,m.courtId));else if(m.start!==null&&!['draft','published'].includes(m.status))used.add(physical(s,e,m.courtId))}
 // A court that has finished a game waits for 开始组队, so it is not work for the clock.
 return s.bookings.some(b=>b.eventId===e.id&&b.start<=now&&b.end>now&&!busy.has(physical(s,e,b.id))&&!used.has(physical(s,e,b.id)));
}
function configuration(e:Event):LivePlay{
 return e.livePlay??={enabled:false,paused:false,preferences:[],completions:[],rest:[]};
}
/** splits: the team splits allowed by hidden pairing odds (lib/domain/pairing-odds.ts); all three when omitted. */
function pair(s:State,e:Event,ids:string[],history:ReturnType<typeof matchHistory>,rating:(id:string)=>number,splits?:string[][][]){
 const size=eventFormat(e)==='singles'?1:2;
 const cost=(order:string[])=>{
  const a=order.slice(0,size),b=order.slice(size);
  const mean=(t:string[])=>t.reduce((n,id)=>n+rating(id),0)/size;
  return balanceCost([Math.abs(mean(a)-mean(b))],history.variety(a,b),size===2?genderMismatches(s,a,b,rating):0,history.rematches(a,b),size===2?history.cohorts(order):0,size===2?history.partnerPenalty(a,b):0);
 };
 const [first,...others]=splits?splits.map(split=>split.flat()):size===2?[ids,[ids[0],ids[2],ids[1],ids[3]],[ids[0],ids[3],ids[1],ids[2]]]:[ids];
 let best=first,bestCost=cost(first);
 for(const candidate of others){
  const next=cost(candidate);if(compareBalance(next,bestCost)<0){best=candidate;bestCost=next}
 }
 return {a:best.slice(0,size),b:best.slice(size),cost:bestCost};
}

/** Courts that have not had a game yet start on their own (activity start, a court slot opening, an arrival). A court
 * that has finished a game waits until someone presses 开始组队 (liveNext, `next`). Everyone leaves the court after
 * each game and the next four come from a queue (docs/LIVE_PLAY.md): waiting players before the just-finished ones,
 * longest wait first, then fewer games; then the existing pairing algorithm splits them into teams. Attendance/court
 * times constrain availability internally; no duration is guessed. Returns the started matches. */
export function fillLiveCourts(s:State,e:Event,now:number,next?:{courtId?:string;allowSame?:boolean}){
 const started:Match[]=[];
 const config=e.livePlay;
 // Only an explicit action can create overtime matches; clock maintenance must
 // never restart an old activity just because its participants remain signed up.
 if(e.tournament||isPractice(e)||!config?.enabled||config.paused||!liveActivityAvailable(e,now)||now<e.start||(now>=e.end&&!next))return started;
 const at=liveAvailabilityTime(e,now);
 // A manual request (liveNext for one court, or the organiser starting live play for every free court) also fills
 // courts that have already had a game.
 const target=next?.courtId?physical(s,e,next.courtId):null,manual=!!next;
 const present=livePresentIds(s,e,now),busy=new Set(s.matches.filter(playing).flatMap(m=>[...m.a,...m.b]));
 const courts=s.bookings.filter(b=>b.eventId===e.id&&b.start<=at&&b.end>at)
  .sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 const handled=new Set<string>();
 const history=matchHistory(s,e.id,true),ratings=new Map(s.players.map(p=>[p.id,p.rating]));
 const rating=(id:string)=>ratings.get(id)??1000;
 const counts=new Map<string,number>(),lastTurns=new Map<string,number>();
 for(const m of s.matches)if(m.eventId===e.id&&m.start!==null)for(const id of [...m.a,...m.b]){
  lastTurns.set(id,Math.max(lastTurns.get(id)??0,m.start));
  if(['playing','complete','forfeit'].includes(m.status)&&(!m.noShow?.length||m.noShow.includes(id)))counts.set(id,(counts.get(id)??0)+1);
 }
 const appearances=(id:string)=>counts.get(id)??0;
 const last=(id:string)=>lastTurns.get(id)??0;
 // The game each player last played in, to keep a whole game from coming back on court as one block.
 const lastGame=new Map<string,string>(),lastStart=new Map<string,number>();
 for(const m of s.matches)if(m.eventId===e.id&&m.start!==null&&['playing','complete','forfeit'].includes(m.status))for(const id of [...m.a,...m.b])if(m.start>=(lastStart.get(id)??-1)){lastStart.set(id,m.start);lastGame.set(id,m.id)}
 // The bench is a queue: whoever has waited longest since their last game goes first, then fewer games. This keeps
 // both the games played and the longest wait about even (docs/LIVE_PLAY.md).
 const fairOrder=(a:string,b:string)=>last(a)-last(b)||appearances(a)-appearances(b)||present.indexOf(a)-present.indexOf(b)||a.localeCompare(b);
 // Games started since each player's last game; it grows as this call starts games too.
 const waits=new Map<string,number>();
 for(const m of s.matches)if(m.eventId===e.id&&m.start!==null&&['playing','complete','forfeit'].includes(m.status))for(const id of present)if(m.start>last(id))waits.set(id,(waits.get(id)??0)+1);
 const waited=(id:string)=>waits.get(id)??0;
 const previousByCourt=new Map<string,Match>();
 for(const m of s.matches)if(m.eventId===e.id&&m.start!==null&&!['playing','draft','published'].includes(m.status)){
  const key=physical(s,e,m.courtId),old=previousByCourt.get(key);
  if(!old||(m.end??m.start)>(old.end??old.start!)||((m.end??m.start)===(old.end??old.start!)&&(m.start>old.start!||(m.start===old.start&&m.id.localeCompare(old.id)<0))))previousByCourt.set(key,m);
 }
 for(const court of courts){
  const key=physical(s,e,court.id),venue=court.venue??e.venue;
  if(handled.has(key))continue;handled.add(key);
  if(target!==null&&key!==target)continue;
  if(s.matches.some(m=>m.eventId===e.id&&playing(m)&&physical(s,e,m.courtId)===key))continue;
  // Waiting players get the next turn before this court's just-finished players, even when the latter have fewer
  // games or started their previous game earlier. Derive this from stored matches so pause/resume and concurrent
  // retries keep the same order.
  const previous=previousByCourt.get(key);
  if(previous&&!manual)continue;
  const justFinished=new Set(previous?[...previous.a,...previous.b]:[]);
  const order=(a:string,b:string)=>Number(justFinished.has(a))-Number(justFinished.has(b))||fairOrder(a,b);
  // For strength, variety and rematches the pairing may swap in a candidate whose wait differs by at most one game and
  // who has not played more, so nobody is passed over for more than about one extra game or plays ahead of others.
  const sameTurn=(a:string,b:string)=>justFinished.has(a)===justFinished.has(b)&&Math.abs(waited(a)-waited(b))<=1&&appearances(b)<=appearances(a);
  // The order is a preference, not an eligibility lock. When short, any available player can fill the court,
  // including the ones who have just finished.
  const pool=present.filter(id=>!busy.has(id)&&!liveResting(e,id,venue)&&bookingAllowsPlayer(s,e.id,court.id,id,at,at+1)).sort(order);
  let teams:{a:string[];b:string[]}|undefined;
  if(eventFormat(e)==='doubles'&&e.pointsChoice?.selectedMode==='fixed'){
   const fixed=e.pointsChoice.teams??fixedPartnerTeams(s,e);e.pointsChoice.teams=fixed;
   const candidates=fixed.filter(team=>team.length===2&&team.every(id=>pool.includes(id)))
    .sort((a,b)=>Number(a.some(id=>justFinished.has(id)))-Number(b.some(id=>justFinished.has(id)))||Math.max(...a.map(last))-Math.max(...b.map(last))||order(a[0],b[0]));
   if(candidates.length>=2){
    let chosen=candidates.slice(0,2);
    const cost=(ts:string[][])=>balanceCost([Math.abs(ts[0].reduce((n,id)=>n+rating(id),0)-ts[1].reduce((n,id)=>n+rating(id),0))/2],history.variety(ts[0],ts[1],0),genderMismatches(s,ts[0],ts[1],rating),history.rematches(ts[0],ts[1]),history.cohorts(ts.flat()));
    let bestCost=cost(chosen);
    for(let pass=0;pass<2;pass++)for(let i=0;i<2;i++)for(const candidate of candidates.slice(0,16)){
     if(chosen.includes(candidate)||chosen[i].some((id,j)=>!sameTurn(id,candidate[j])))continue;
     const next=[...chosen];next[i]=candidate;const nextCost=cost(next);
     if(compareBalance(nextCost,bestCost)<0){chosen=next;bestCost=nextCost}
    }
    // Two teams that came off one game together would only play each other again: bring in another team, first one
    // that would not get ahead in games, then the best balance.
    const from=(team:string[])=>lastGame.get(team[0]);
    if(from(chosen[0])&&from(chosen[0])===from(chosen[1])){
     let best:string[][]|undefined,bestAhead=Infinity,bestOptionCost:ReturnType<typeof cost>|undefined;
     for(let i=0;i<2;i++)for(const candidate of candidates.slice(0,16)){
      if(chosen.includes(candidate)||from(candidate)===from(chosen[0]))continue;
      const option=[...chosen];option[i]=candidate;
      const ahead=Math.max(0,Math.max(...candidate.map(appearances))-Math.max(...chosen[i].map(appearances))),optionCost=cost(option);
      if(!best||ahead<bestAhead||(ahead===bestAhead&&compareBalance(optionCost,bestOptionCost!)<0)){best=option;bestAhead=ahead;bestOptionCost=optionCost}
     }
     if(best)chosen=best;
    }
    teams={a:chosen[0],b:chosen[1]};
   }
  }else if(pool.length>=courtPlayers(e)){
   let chosen=pair(s,e,pool.slice(0,courtPlayers(e)),history,rating);
   for(let pass=0;pass<2;pass++)for(let i=0;i<courtPlayers(e);i++)for(const candidate of pool.slice(0,16)){
    const ids=[...chosen.a,...chosen.b],replaced=ids[i];if(ids.includes(candidate)||!sameTurn(replaced,candidate))continue;
    ids[i]=candidate;const next=pair(s,e,ids,history,rating);
    if(compareBalance(next.cost,chosen.cost)<0)chosen=next;
   }
   // Everyone leaves after each game, so a whole game could come back on court as one block and the same people
   // would only swap partners. Break up three or four from one earlier game by bringing in others (just-finished
   // players included): first those who would not get ahead in games, then the best balance.
   if(eventFormat(e)==='doubles')for(let round=0;round<2;round++){
    const ids=[...chosen.a,...chosen.b],tally=new Map<string,number>();
    for(const id of ids){const game=lastGame.get(id);if(game)tally.set(game,(tally.get(game)??0)+1)}
    const block=[...tally].find(([,n])=>n>=3)?.[0];if(!block)break;
    let best:ReturnType<typeof pair>|undefined,bestAhead=Infinity;
    for(let i=0;i<ids.length;i++)if(lastGame.get(ids[i])===block)for(const candidate of pool.slice(0,16)){
     if(ids.includes(candidate)||lastGame.get(candidate)===block)continue;
     const option=[...ids];option[i]=candidate;
     const split=pair(s,e,option,history,rating),ahead=Math.max(0,appearances(candidate)-appearances(ids[i]));
     if(!best||ahead<bestAhead||(ahead===bestAhead&&compareBalance(split.cost,best.cost)<0)){best=split;bestAhead=ahead}
    }
    if(!best)break;chosen=best;
   }
   const odds=eventFormat(e)==='doubles'?eventPairingOdds(s,e.id):undefined;
   if(odds){const four=[...chosen.a,...chosen.b];chosen=pair(s,e,four,history,rating,oddsSplits(odds,four,oddsRandom(Math.floor(now/1000)+started.length*7919+[...court.id].reduce((n,c)=>n*31+c.charCodeAt(0)|0,0))))}
   teams={a:chosen.a,b:chosen.b};
  }
  if(!teams)continue;
  const participants=[...teams.a,...teams.b];
  if(eventFormat(e)==='singles'&&previous&&target!==null&&!next?.allowSame&&participants.every(id=>justFinished.has(id)))fail('409: 场下暂时没有可换的人，请等待其他球友或选择继续原班人马');
  participants.forEach(id=>busy.add(id));
  const sequence=1+s.matches.filter(m=>m.eventId===e.id&&m.start!==null&&m.status!=='cancelled'&&physical(s,e,m.courtId)===key).length;
  const roundId=crypto.randomUUID();
  s.rounds.push({id:roundId,eventId:e.id,start:now,duration:0,status:'playing',eligible:[...present],rest:present.filter(id=>!participants.includes(id)&&!busy.has(id)),seed:sequence,live:true,liveSequence:sequence});
  const match:Match={...teams,id:crypto.randomUUID(),eventId:e.id,roundId,courtId:court.id,status:'playing',start:now,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};
  decorateMatch(s,e,match);markRanked(match,e);s.matches.push(match);history.add(match);started.push(match);
  for(const id of participants){counts.set(id,appearances(id)+1);lastTurns.set(id,now);waits.set(id,0);lastGame.set(id,match.id)}
  for(const id of present)if(!participants.includes(id))waits.set(id,waited(id)+1);
  clearFilledPointsWaiting(s,e);
  const season=month(now);if(!s.seasons.some(p=>p.id===season))s.seasons.push({id:season,rules:{...s.settings.rules},version:1});
 }
 return started;
}

/** A requested break lasts until a later-started match at the same venue finishes.
 * With insufficient substitutes the court waits; nobody is forced to play. */
export function finishLiveMatch(s:State,e:Event,m:Match,now:number){
 if(!e.livePlay?.enabled)return;
 const config=e.livePlay,venue=s.bookings.find(b=>b.id===m.courtId)?.venue??e.venue;
 let completion=config.completions.find(c=>c.venue===venue);
 if(!completion){completion={venue,count:0};config.completions.push(completion)}completion.count++;
 config.rest=config.rest.filter(rest=>rest.reason===undefined&&(rest.venue!==venue||m.start===null||m.start<rest.after));
 for(const playerId of [...m.a,...m.b])if(config.preferences.some(p=>p.playerId===playerId&&p.avoidConsecutive)){
  config.rest=config.rest.filter(p=>p.playerId!==playerId||p.venue!==venue);config.rest.push({playerId,venue,after:m.end??now});
 }
 fillLiveCourts(s,e,Math.max(now,m.end??now));
}

export async function applyLivePlay(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 const p=command.payload;
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 if(!liveActivityAvailable(e,now))fail('活动未开放、已取消或已手动提前结束，不能使用实时排场');
 if(e.tournament)fail('赛事请使用对战表安排比赛');
 if(isPractice(e))fail('练球活动不生成比赛或积分');
 const manager=canManageEvent(a,e)||canEnableEventRanking(s,a,e);
 if(command.action==='liveNext'){
  // Like score entry: anyone signed up for the activity, its organiser or an administrator.
  if(!manager&&!canRecordScore(s,a,e))fail('403: 只有本活动已接龙的球友、创建者或管理员可以开始组队');
  if(!e.livePlay?.enabled||e.livePlay.paused||now<e.start)fail('实时排场未开启、已暂停或活动尚未开始');
  const started=fillLiveCourts(s,e,now,{courtId:command.payload.courtId,allowSame:command.payload.allowSame});
  if(!started.length)fail('这片场地正在比赛，或可上场的人数不足，暂时无法组队');
  s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'录分后开始组队',changes:{eventId:e.id,courtId:command.payload.courtId,matchIds:started.map(m=>m.id)}});
  return true;
 }
 if(command.action==='liveStart'||command.action==='livePause'){
  authorizeEventAction(s,a,command.action,p);
  if(!manager)fail('403: 只有活动创建者或管理员可以开始或暂停排场');
 }else{
  const p=command.payload;
  const player=s.players.find(player=>player.id===p.playerId);
  if(!player||!s.registrations.some(r=>r.eventId===e.id&&r.playerId===player.id&&r.status==='confirmed'))fail('只有正式接龙球友可以调整轮休');
  if(!manager&&player.id!==a.playerId&&player.ownerId!==a.id)fail('403: 只能调整自己或代报名朋友的轮休');
 }
 if(action==='liveStart'&&now<e.start)fail('请在活动进行时开始实时排场');
 const config=configuration(e);
 if(command.action==='liveStart'){
  cancelPendingScheduling(s,e.id);
  e.schedulingMode='live';
  config.enabled=true;config.paused=false;e.playMode='balanced';
 }else if(command.action==='livePause')config.paused=command.payload.paused;
 else if(command.action==='livePreference'){
  const p=command.payload;
  config.preferences=config.preferences.filter(pref=>pref.playerId!==p.playerId);
  config.preferences.push({playerId:p.playerId,avoidConsecutive:p.avoidConsecutive});
  if(!p.avoidConsecutive)config.rest=config.rest.filter(rest=>rest.playerId!==p.playerId);
 }else config.rest=config.rest.filter(rest=>rest.playerId!==command.payload.playerId);
 fillLiveCourts(s,e,now,command.action==='liveStart'?{allowSame:true}:undefined);
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:action==='livePreference'?'调整连续上场意愿':action==='liveReady'?'轮休后准备上场':'实时公平排场',changes:p});
 return true;
}
