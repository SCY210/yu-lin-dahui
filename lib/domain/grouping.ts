import {matchingStopped} from './matching-participation';
import {awaitingArrival} from './points-attendance';
import {arenaStatus} from './social';
import {balanceCost,compareBalance} from './match-balance';
import {genderMismatches} from './gender-balance';
import {matchHistory} from './match-history';
import {bookingAllowsPlayer} from './booking-signups';
import {attendanceForEvent,usesAutomaticAttendance} from './attendance';
import {fail,type State,type Event,type Match} from './types';
import {eventFormat,teamSize,isPractice} from './match-format';
import {eventPairingOdds,oddsRandom,oddsSplits} from './pairing-odds';
export function readyIds(s:State,eventId:string,at:number,duration=0){const e=s.events.find(e=>e.id===eventId);if(!e)return [];const automatic=usesAutomaticAttendance(e);return [...new Set(attendanceForEvent(s,e).filter(a=>a.start<=at&&(automatic?(a.end??e.end)>at&&(a.end??e.end)>=at+duration*60000:a.end===null)&&a.state==='ready').map(a=>a.playerId))].filter(id=>!awaitingArrival(e,id)&&!e.noShowHold?.includes(id)&&!matchingStopped(e,id)&&(!automatic||s.registrations.some(r=>r.eventId===eventId&&r.playerId===id&&r.status==='confirmed'))&&s.players.some(p=>p.id===id&&p.enabled)&&!s.matches.some(m=>m.status==='playing'&&[...m.a,...m.b].includes(id)))}
/** A player may play at most this many rounds of an activity in a row (docs/MATCH_GROUPING.md). */
export const maxConsecutiveRounds=3;
/** Players who played each of the latest maxConsecutiveRounds rounds of this activity. Grouping lets them rest the next
 * round whenever somebody else can take the place, so a court is never left short only for this rule. */
export function tiredPlayers(s:Pick<State,'rounds'|'matches'>,eventId:string){
 const rounds=s.rounds.filter(r=>r.eventId===eventId&&['published','playing','complete'].includes(r.status)).sort((a,b)=>(a.pointsSlot??0)-(b.pointsSlot??0)||a.start-b.start||a.id.localeCompare(b.id)).slice(-maxConsecutiveRounds);
 if(rounds.length<maxConsecutiveRounds)return new Set<string>();
 const players=new Map(rounds.map(r=>[r.id,new Set<string>()]));
 for(const m of s.matches)if(m.status!=='cancelled'&&players.has(m.roundId))for(const id of [...m.a,...m.b])if(!m.noShow?.length||m.noShow.includes(id))players.get(m.roundId)!.add(id);
 const [first,...rest]=rounds.map(r=>players.get(r.id)!);
 return new Set([...first].filter(id=>rest.every(round=>round.has(id))));
}
type TurnDebt={deficit:number;wait:number;streak:number};
/** Whether a resting player may take a selected player's place without making turns less fair: the same number of
 * games owed and the same three-round rest, waiting at most one round apart, and not lengthening a run of rounds in a
 * row beyond two unless the replaced player's run is as long. The search may then swap a resting player in, so ties do
 * not fall back to list order, where the same groups keep coming back (one court with 8 players formed two fixed
 * groups of four). Someone may then wait two rounds while another plays two in a row, but game counts stay equal. */
function sameTurn(incoming:TurnDebt,replaced:TurnDebt,tiredIn:boolean,tiredOut:boolean){return tiredIn===tiredOut&&Math.abs(incoming.deficit-replaced.deficit)<1e-6&&Math.abs(incoming.wait-replaced.wait)<=1&&incoming.streak<=Math.max(1,replaced.streak)}
export function propose(s:State,e:Event,at:number,duration:number,seed:number){if(isPractice(e))fail('练球活动不生成比赛或积分');if(eventFormat(e)==='singles')return proposeSingles(s,e,at,duration,seed);const eligible=readyIds(s,e.id,at,duration);const bookings=s.bookings.filter(b=>b.eventId===e.id&&b.start<=at&&b.end>=at+duration*60000&&!s.matches.some(m=>m.courtId===b.id&&m.status==='playing'));let courts=bookings.filter((b,i,arr)=>arr.findIndex(x=>x.name===b.name&&(x.venue??e.venue)===(b.venue??e.venue))===i);const arenaName=s.bookings.find(x=>x.id===e.arenaCourtId)?.name;const arenaCourt=courts.find(b=>b.name===arenaName);if(e.playMode==='arena'&&arenaCourt)courts=[arenaCourt,...courts.filter(b=>b.name!==arenaName)];if(eligible.length<4)fail('目前可上场人数不足4人，无法生成双打');if(!courts.length)fail('预计比赛时段内没有完整可用的场地');
 const allowed=new Map(courts.map(b=>[b.id,new Set(eligible.filter(id=>bookingAllowsPlayer(s,e.id,b.id,id,at,at+duration*60000)))]));
 const canUse=(courtId:string,id:string)=>allowed.get(courtId)?.has(id)??false;
 const prior=s.rounds.filter(r=>r.eventId===e.id&&['published','playing','complete'].includes(r.status));
 const debt=(id:string)=>{let deficit=0,wait=0,games=0,streak=0;for(const r of prior){if(!r.eligible.includes(id))continue;const ms=s.matches.filter(m=>m.roundId===r.id&&m.status!=='cancelled');const played=ms.some(m=>[...m.a,...m.b].includes(id)&&(!m.noShow?.length||m.noShow.includes(id)));deficit+=ms.length*4/r.eligible.length-(played?1:0);if(played){wait=0;games++;streak++}else{wait++;streak=0}}return {deficit,wait,games,streak}};
 const tired=tiredPlayers(s,e.id),debts=new Map(eligible.map(id=>[id,debt(id)]));
 eligible.sort((a,b)=>{const x=debts.get(a)!,y=debts.get(b)!;return Number(tired.has(a))-Number(tired.has(b))||y.deficit-x.deficit||y.wait-x.wait||x.streak-y.streak||a.localeCompare(b)});const picked=new Set<string>(),usedCourts:typeof courts=[];let selected:string[]=[];
 for(const court of courts){const pool=eligible.filter(id=>!picked.has(id)&&canUse(court.id,id));if(pool.length<4)continue;const chosen=pool.slice(0,4);chosen.forEach(id=>picked.add(id));selected.push(...chosen);usedCourts.push(court)}
 courts=usedCourts;if(!courts.length)fail('本时段同球馆正式球友不足4人，无法安排双打');let fixed=0;let arenaLosers:string[]=[];if(e.playMode==='arena'&&arenaCourt){const arena=arenaStatus(s,e.id);const holders=arena.holders.filter(id=>eligible.includes(id)&&canUse(arenaCourt.id,id));if(holders.length===2){const latest=s.matches.find(m=>m.id===arena.matchId)!;const losers=[...latest.a,...latest.b].filter(id=>!holders.includes(id));arenaLosers=losers;const challengers=eligible.filter(id=>!holders.includes(id)&&!losers.includes(id)&&canUse(arenaCourt.id,id)).slice(0,2);if(challengers.length<2)fail('擂台需要两名新的接擂球友；请等待更多正式球友参加或切回公平轮转');const pinned=[...holders,...challengers];const used=new Set(pinned);selected=[...pinned];for(const court of courts.slice(1)){const pool=eligible.filter(id=>!used.has(id)&&canUse(court.id,id)).slice(0,4);pool.forEach(id=>used.add(id));selected.push(...pool)}fixed=2}}
 const rating=(id:string)=>s.players.find(p=>p.id===id)!.rating;const history=matchHistory(s,e.id);
 const cohortValues=new Map(eligible.map(id=>[id,s.registrations.find(r=>r.eventId===e.id&&r.playerId===id)?.bookingSignups?.find(x=>x.status==='confirmed'&&x.arrival<=at&&x.departure>=at+duration*60000)?.bookingId]));
 const cohort=(id:string)=>cohortValues.get(id);
 const mixedCohorts=new Set(eligible.map(cohort).filter(Boolean)).size>1;
 const costCache=new Map<string,ReturnType<typeof balanceCost>>();
 const positions=new Map(eligible.map((id,i)=>[id,i]));
 const penalty=(list:string[])=>{
  // Compact local indices are unambiguous and avoid repeatedly serializing IDs
  // in the seeded search. Court order stays in the key for venue constraints.
  let key='';for(let i=0;i<list.length;i+=4){
   const [a,b,c,d]=list.slice(i,i+4).map(id=>positions.get(id)!);
   const left=Math.min(a,b)+','+Math.max(a,b),right=Math.min(c,d)+','+Math.max(c,d);
   key+=(left<right?left+'/'+right:right+'/'+left)+';';
  }
  const cached=costCache.get(key);if(cached)return cached;
  let variety=0,mismatches=0,rematches=0,cohorts=0,partners=0;const gaps:number[]=[];
  for(let i=0;i<list.length;i+=4){
   const a=list.slice(i,i+2),b=list.slice(i+2,i+4);
   mismatches+=genderMismatches(s,a,b,rating);
   if([...a,...b].some(id=>!canUse(courts[i/4].id,id)))return balanceCost([Infinity],Infinity);
   gaps.push(Math.abs((rating(a[0])+rating(a[1])-rating(b[0])-rating(b[1]))/2));
   if(mixedCohorts&&cohort(a[0])&&[...a,...b].every(id=>cohort(id)===cohort(a[0])))variety+=90;
   for(const team of [a,b]){
    if(['mentor','carry'].includes(e.identityMode??''))variety-=Math.abs(rating(team[0])-rating(team[1]))*.6;
   }
   // As in live rotation: a block from one game counts like a repeated foursome, and repeated partners cost strength.
   rematches+=history.rematches(a,b);cohorts+=history.cohorts([...a,...b])+history.blocks([...a,...b]);partners+=history.partnerPenalty(a,b);
   variety+=history.variety(a,b,e.playMode==='koc'?1800:350);
  }
  const result=balanceCost(gaps,variety,mismatches,rematches,cohorts,partners);costCache.set(key,result);return result;
 };
 // Check all three pairings on each court, including the unchanged one.
 // Arena holders keep their team. Fair-turn selection and venue rules stay upstream.
 const pairCourts=(list:string[])=>{
  const result=[...list];
  for(let offset=fixed?4:0;offset<list.length;offset+=4){
   const [a,b,c,d]=result.slice(offset,offset+4);let chosen=[...result],cost=penalty(chosen);
   for(const pair of [[a,c,b,d],[a,d,b,c]]){
    const next=[...result];next.splice(offset,4,...pair);const nextCost=penalty(next);
    if(compareBalance(nextCost,cost)<0){chosen=next;cost=nextCost}
   }
   result.splice(offset,4,...chosen.slice(offset,offset+4));
  }
  return result;
 };
 let rng=seed>>>0;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
 let best=pairCourts(selected),bestCost=penalty(best);
 const interchangeable=(a:string,b:string)=>sameTurn(debts.get(a)!,debts.get(b)!,tired.has(a),tired.has(b));
 for(let n=0;n<600;n++){
  const candidate=[...best];const i=fixed+Math.floor(rand()*(candidate.length-fixed)),j=fixed+Math.floor(rand()*(candidate.length-fixed));
  // Half the moves bring in an interchangeable resting player (not in arena mode, whose challengers are fixed).
  const bench=fixed||rand()<.5?[]:eligible.filter(id=>!candidate.includes(id)&&interchangeable(id,candidate[i]));
  if(bench.length)candidate[i]=bench[Math.floor(rand()*bench.length)];
  else [candidate[i],candidate[j]]=[candidate[j],candidate[i]];
  if(fixed&&candidate.slice(2,4).some(id=>arenaLosers.includes(id)))continue;
  // Reject venue violations before the more expensive pairing search.
  if(candidate.some((id,index)=>!canUse(courts[Math.floor(index/4)].id,id)))continue;
  const paired=pairCourts(candidate),cost=penalty(paired),comparison=compareBalance(cost,bestCost);
  if(comparison<0||(comparison===0&&rand()<.1)){best=paired;bestCost=cost}
 }
 // Hidden pairing odds decide partners or opponents only once the courts are chosen, so who plays and who shares a
 // court stay as fair turns and balance made them (lib/domain/pairing-odds.ts).
 const odds=eventPairingOdds(s,e.id);
 if(odds){
  const draw=oddsRandom(seed);
  for(let offset=fixed?4:0;offset<best.length;offset+=4){
   const options=oddsSplits(odds,best.slice(offset,offset+4),draw).map(split=>{const next=[...best];next.splice(offset,4,...split.flat());return next});
   best=options.reduce((x,y)=>compareBalance(penalty(y),penalty(x))<0?y:x);
  }
  bestCost=penalty(best);
 }
 const rest=eligible.filter(id=>!best.includes(id));
 return {eligible,rest,courts:courts.slice(0,best.length/4).map((court,i)=>({courtId:court.id,a:best.slice(i*4,i*4+2),b:best.slice(i*4+2,i*4+4)})),stats:Object.fromEntries(eligible.map(id=>{const d=debts.get(id)!;return [id,{deficit:d.deficit,wait:d.wait,games:d.games}]})),penalty:bestCost.variety,balance:bestCost};
}
export function validateRound(s:State,eventId:string,windowStart:number,windowMinutes:number,matches:Match[]){if(isPractice(s.events.find(e=>e.id===eventId)??{}))fail('练球活动不生成比赛或积分');const ids=matches.flatMap(m=>[...m.a,...m.b]);const event=s.events.find(e=>e.id===eventId);
 // Overtime: a window past the scheduled end is checked against the final attendance/court phase, as in live play.
 const late=!!event&&windowStart+windowMinutes*60000>event.end,start=late?Math.min(windowStart,event!.end-1):windowStart,duration=late?0:windowMinutes;
if(event&&ids.some(id=>matchingStopped(event,id)))fail('分组包含已选择不再上场的球友，请调整阵容或重新预排后再开赛');if(new Set(ids).size!==ids.length)fail('同一轮有重复选手');const ready=readyIds(s,eventId,start,duration);const names=new Set<string>();for(const m of matches){if(m.a.length!==teamSize(s.events.find(e=>e.id===eventId)??{})||m.b.length!==teamSize(s.events.find(e=>e.id===eventId)??{})||[...m.a,...m.b].some(id=>!ready.includes(id)))fail('分组包含不在参加时段内或正在比赛的成员');const b=s.bookings.find(b=>b.id===m.courtId&&b.eventId===eventId&&b.start<=start&&b.end>=start+duration*60000);if(!b||names.has((b.venue??s.events.find(e=>e.id===eventId)?.venue)+'/'+b.name))fail('场地不可用或重复');if([...m.a,...m.b].some(id=>!bookingAllowsPlayer(s,eventId,b.id,id,start,start+duration*60000)))fail('分组包含不在该球馆参加时段内的成员');names.add((b.venue??s.events.find(e=>e.id===eventId)?.venue)+'/'+b.name)}}

/** Same fair-turn debt and venue constraints as doubles, with one player per side. */
function proposeSingles(s:State,e:Event,at:number,duration:number,seed:number){
 const eligible=readyIds(s,e.id,at,duration),end=at+duration*60000;
 if(eligible.length<2)fail('目前可上场人数不足2人，无法生成单打');
 const bookings=s.bookings.filter(b=>b.eventId===e.id&&b.start<=at&&b.end>=end&&!s.matches.some(m=>m.courtId===b.id&&m.status==='playing'))
  .filter((b,i,all)=>all.findIndex(x=>x.name===b.name&&(x.venue??e.venue)===(b.venue??e.venue))===i);
 if(!bookings.length)fail('预计比赛时段内没有完整可用的场地');
 const prior=s.rounds.filter(r=>r.eventId===e.id&&['published','playing','complete'].includes(r.status));
 const debt=(id:string)=>{let deficit=0,wait=0,games=0,streak=0;for(const r of prior){if(!r.eligible.includes(id))continue;const ms=s.matches.filter(m=>m.roundId===r.id&&m.status!=='cancelled'),played=ms.some(m=>[...m.a,...m.b].includes(id)&&(!m.noShow?.length||m.noShow.includes(id)));deficit+=ms.length*2/r.eligible.length-(played?1:0);if(played){wait=0;games++;streak++}else{wait++;streak=0}}return {deficit,wait,games,streak}};
 const tired=tiredPlayers(s,e.id),debts=new Map(eligible.map(id=>[id,debt(id)]));
 eligible.sort((a,b)=>{const x=debts.get(a)!,y=debts.get(b)!;return Number(tired.has(a))-Number(tired.has(b))||y.deficit-x.deficit||y.wait-x.wait||x.streak-y.streak||a.localeCompare(b)});
 const selected:string[]=[],used=new Set<string>(),courts:typeof bookings=[];
 const canUse=(i:number,id:string)=>bookingAllowsPlayer(s,e.id,courts[i].id,id,at,end);
 for(const b of bookings){const pool=eligible.filter(id=>!used.has(id)&&bookingAllowsPlayer(s,e.id,b.id,id,at,end));if(pool.length<2)continue;const pair=pool.slice(0,2);pair.forEach(id=>used.add(id));selected.push(...pair);courts.push(b)}
 if(!courts.length)fail('本时段同球馆正式球友不足2人，无法安排单打');
 const rating=(id:string)=>s.players.find(p=>p.id===id)?.rating??1000,history=matchHistory(s,e.id);
 const penalty=(list:string[])=>{const gaps:number[]=[];let repeats=0;for(let i=0;i<list.length;i+=2){const a=list[i],b=list[i+1];if(!canUse(i/2,a)||!canUse(i/2,b))return balanceCost([Infinity],Infinity);gaps.push(Math.abs(rating(a)-rating(b)));repeats+=history.rematches([a],[b])}return balanceCost(gaps,repeats*75,0,repeats)};
 let best=[...selected],cost=penalty(best),rng=seed>>>0;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
 const interchangeable=(a:string,b:string)=>sameTurn(debts.get(a)!,debts.get(b)!,tired.has(a),tired.has(b));
 for(let n=0;n<180;n++){const next=[...best],i=Math.floor(rand()*next.length),j=Math.floor(rand()*next.length);const bench=rand()<.5?eligible.filter(id=>!next.includes(id)&&interchangeable(id,next[i])):[];if(bench.length)next[i]=bench[Math.floor(rand()*bench.length)];else [next[i],next[j]]=[next[j],next[i]];const nextCost=penalty(next);if(compareBalance(nextCost,cost)<0){best=next;cost=nextCost}}
 return {eligible,rest:eligible.filter(id=>!best.includes(id)),courts:courts.map((court,i)=>({courtId:court.id,a:[best[i*2]],b:[best[i*2+1]]})),stats:Object.fromEntries(eligible.map(id=>{const d=debts.get(id)!;return [id,{deficit:d.deficit,wait:d.wait,games:d.games}]})),penalty:cost.variety,balance:cost};
}
