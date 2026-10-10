import {arenaStatus} from './social';
import {balanceCost,compareBalance} from './match-balance';
import {bookingAllowsPlayer} from './booking-signups';
import {attendanceForEvent,usesAutomaticAttendance} from './attendance';
import {fail,type State,type Event,type Match} from './types';
import {eventFormat,teamSize,isPractice} from './match-format';
export function readyIds(s:State,eventId:string,at:number,duration=0){const e=s.events.find(e=>e.id===eventId);if(!e)return [];const automatic=usesAutomaticAttendance(e);return [...new Set(attendanceForEvent(s,e).filter(a=>a.start<=at&&(automatic?(a.end??e.end)>at&&(a.end??e.end)>=at+duration*60000:a.end===null)&&a.state==='ready').map(a=>a.playerId))].filter(id=>(!automatic||s.registrations.some(r=>r.eventId===eventId&&r.playerId===id&&r.status==='confirmed'))&&s.players.some(p=>p.id===id&&p.enabled)&&!s.matches.some(m=>m.status==='playing'&&[...m.a,...m.b].includes(id)))}
export function propose(s:State,e:Event,at:number,duration:number,seed:number){if(isPractice(e))fail('练球活动不生成比赛或积分');if(eventFormat(e)==='singles')return proposeSingles(s,e,at,duration,seed);const eligible=readyIds(s,e.id,at,duration);const bookings=s.bookings.filter(b=>b.eventId===e.id&&b.start<=at&&b.end>=at+duration*60000&&!s.matches.some(m=>m.courtId===b.id&&m.status==='playing'));let courts=bookings.filter((b,i,arr)=>arr.findIndex(x=>x.name===b.name&&(x.venue??e.venue)===(b.venue??e.venue))===i);const arenaName=s.bookings.find(x=>x.id===e.arenaCourtId)?.name;const arenaCourt=courts.find(b=>b.name===arenaName);if(e.playMode==='arena'&&arenaCourt)courts=[arenaCourt,...courts.filter(b=>b.name!==arenaName)];if(eligible.length<4)fail('目前可上场人数不足4人，无法生成双打');if(!courts.length)fail('预计比赛时段内没有完整可用的场地');
 const allowed=new Map(courts.map(b=>[b.id,new Set(eligible.filter(id=>bookingAllowsPlayer(s,e.id,b.id,id,at,at+duration*60000)))]));
 const canUse=(courtId:string,id:string)=>allowed.get(courtId)?.has(id)??false;
 const prior=s.rounds.filter(r=>r.eventId===e.id&&['published','playing','complete'].includes(r.status));
 const debt=(id:string)=>{let deficit=0,wait=0,games=0;for(const r of prior){if(!r.eligible.includes(id))continue;const ms=s.matches.filter(m=>m.roundId===r.id&&m.status!=='cancelled');const played=ms.some(m=>[...m.a,...m.b].includes(id));deficit+=ms.length*4/r.eligible.length-(played?1:0);if(played){wait=0;games++}else wait++}return {deficit,wait,games}};
 eligible.sort((a,b)=>{const x=debt(a),y=debt(b);return y.deficit-x.deficit||y.wait-x.wait||a.localeCompare(b)});const picked=new Set<string>(),usedCourts:typeof courts=[];let selected:string[]=[];
 for(const court of courts){const pool=eligible.filter(id=>!picked.has(id)&&canUse(court.id,id));if(pool.length<4)continue;const chosen=pool.slice(0,4);chosen.forEach(id=>picked.add(id));selected.push(...chosen);usedCourts.push(court)}
 courts=usedCourts;if(!courts.length)fail('本时段同球馆正式球友不足4人，无法安排双打');let fixed=0;let arenaLosers:string[]=[];if(e.playMode==='arena'&&arenaCourt){const arena=arenaStatus(s,e.id);const holders=arena.holders.filter(id=>eligible.includes(id)&&canUse(arenaCourt.id,id));if(holders.length===2){const latest=s.matches.find(m=>m.id===arena.matchId)!;const losers=[...latest.a,...latest.b].filter(id=>!holders.includes(id));arenaLosers=losers;const challengers=eligible.filter(id=>!holders.includes(id)&&!losers.includes(id)&&canUse(arenaCourt.id,id)).slice(0,2);if(challengers.length<2)fail('擂台需要两名新的接擂球友；请等待更多正式球友参加或切回公平轮转');const pinned=[...holders,...challengers];const used=new Set(pinned);selected=[...pinned];for(const court of courts.slice(1)){const pool=eligible.filter(id=>!used.has(id)&&canUse(court.id,id)).slice(0,4);pool.forEach(id=>used.add(id));selected.push(...pool)}fixed=2}}const rest=eligible.filter(id=>!selected.includes(id));
 const rating=(id:string)=>s.players.find(p=>p.id===id)!.rating;const history=s.matches.filter(m=>m.eventId===e.id&&m.status!=='draft'&&m.status!=='cancelled');
 const cohortValues=new Map(eligible.map(id=>[id,s.registrations.find(r=>r.eventId===e.id&&r.playerId===id)?.bookingSignups?.find(x=>x.status==='confirmed'&&x.arrival<=at&&x.departure>=at+duration*60000)?.bookingId]));
 const cohort=(id:string)=>cohortValues.get(id);
 const mixedCohorts=new Set(eligible.map(cohort).filter(Boolean)).size>1;
 const lastPartner=new Map<string,string>();for(const m of [...history].sort((a,b)=>(a.start??s.rounds.find(r=>r.id===a.roundId)?.start??0)-(b.start??s.rounds.find(r=>r.id===b.roundId)?.start??0)||a.id.localeCompare(b.id))){for(const t of [m.a,m.b]){lastPartner.set(t[0],t[1]);lastPartner.set(t[1],t[0])}}const penalty=(list:string[])=>{
  let variety=0;const gaps:number[]=[];
  for(let i=0;i<list.length;i+=4){
   const a=list.slice(i,i+2),b=list.slice(i+2,i+4);
   if([...a,...b].some(id=>!canUse(courts[i/4].id,id)))return balanceCost([Infinity],Infinity);
   gaps.push(Math.abs((rating(a[0])+rating(a[1])-rating(b[0])-rating(b[1]))/2));
   if(mixedCohorts&&cohort(a[0])&&[...a,...b].every(id=>cohort(id)===cohort(a[0])))variety+=90;
   for(const team of [a,b]){
    if(lastPartner.get(team[0])===team[1]||lastPartner.get(team[1])===team[0])variety+=e.playMode==='koc'?1800:350;
    if(['mentor','carry'].includes(e.identityMode??''))variety-=Math.abs(rating(team[0])-rating(team[1]))*.6;
   }
   for(const m of history){
    for(const team of [a,b])if([m.a,m.b].some(t=>team.every(id=>t.includes(id))))variety+=75;
    for(const x of a)for(const y of b)if((m.a.includes(x)&&m.b.includes(y))||(m.b.includes(x)&&m.a.includes(y)))variety+=12;
   }
  }
  return balanceCost(gaps,variety);
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
 for(let n=0;n<600;n++){
  const candidate=[...best];const i=fixed+Math.floor(rand()*(candidate.length-fixed)),j=fixed+Math.floor(rand()*(candidate.length-fixed));
  [candidate[i],candidate[j]]=[candidate[j],candidate[i]];
  if(fixed&&candidate.slice(2,4).some(id=>arenaLosers.includes(id)))continue;
  // Reject venue violations before the more expensive pairing search.
  if(candidate.some((id,index)=>!canUse(courts[Math.floor(index/4)].id,id)))continue;
  const paired=pairCourts(candidate),cost=penalty(paired),comparison=compareBalance(cost,bestCost);
  if(comparison<0||(comparison===0&&rand()<.1)){best=paired;bestCost=cost}
 }

 return {eligible,rest,courts:courts.slice(0,best.length/4).map((court,i)=>({courtId:court.id,a:best.slice(i*4,i*4+2),b:best.slice(i*4+2,i*4+4)})),stats:Object.fromEntries(eligible.map(id=>[id,debt(id)])),penalty:bestCost.variety,balance:bestCost};
}
export function validateRound(s:State,eventId:string,start:number,duration:number,matches:Match[]){if(isPractice(s.events.find(e=>e.id===eventId)??{}))fail('练球活动不生成比赛或积分');const ids=matches.flatMap(m=>[...m.a,...m.b]);if(new Set(ids).size!==ids.length)fail('同一轮有重复选手');const ready=readyIds(s,eventId,start,duration);const names=new Set<string>();for(const m of matches){if(m.a.length!==teamSize(s.events.find(e=>e.id===eventId)??{})||m.b.length!==teamSize(s.events.find(e=>e.id===eventId)??{})||[...m.a,...m.b].some(id=>!ready.includes(id)))fail('分组包含不在参加时段内或正在比赛的成员');const b=s.bookings.find(b=>b.id===m.courtId&&b.eventId===eventId&&b.start<=start&&b.end>=start+duration*60000);if(!b||names.has((b.venue??s.events.find(e=>e.id===eventId)?.venue)+'/'+b.name))fail('场地不可用或重复');if([...m.a,...m.b].some(id=>!bookingAllowsPlayer(s,eventId,b.id,id,start,start+duration*60000)))fail('分组包含不在该球馆参加时段内的成员');names.add((b.venue??s.events.find(e=>e.id===eventId)?.venue)+'/'+b.name)}}

/** Same fair-turn debt and venue constraints as doubles, with one player per side. */
function proposeSingles(s:State,e:Event,at:number,duration:number,seed:number){
 const eligible=readyIds(s,e.id,at,duration),end=at+duration*60000;
 if(eligible.length<2)fail('目前可上场人数不足2人，无法生成单打');
 const bookings=s.bookings.filter(b=>b.eventId===e.id&&b.start<=at&&b.end>=end&&!s.matches.some(m=>m.courtId===b.id&&m.status==='playing'))
  .filter((b,i,all)=>all.findIndex(x=>x.name===b.name&&(x.venue??e.venue)===(b.venue??e.venue))===i);
 if(!bookings.length)fail('预计比赛时段内没有完整可用的场地');
 const prior=s.rounds.filter(r=>r.eventId===e.id&&['published','playing','complete'].includes(r.status));
 const debt=(id:string)=>{let deficit=0,wait=0,games=0;for(const r of prior){if(!r.eligible.includes(id))continue;const ms=s.matches.filter(m=>m.roundId===r.id&&m.status!=='cancelled'),played=ms.some(m=>[...m.a,...m.b].includes(id));deficit+=ms.length*2/r.eligible.length-(played?1:0);if(played){wait=0;games++}else wait++}return {deficit,wait,games}};
 eligible.sort((a,b)=>{const x=debt(a),y=debt(b);return y.deficit-x.deficit||y.wait-x.wait||a.localeCompare(b)});
 const selected:string[]=[],used=new Set<string>(),courts:typeof bookings=[];
 const canUse=(i:number,id:string)=>bookingAllowsPlayer(s,e.id,courts[i].id,id,at,end);
 for(const b of bookings){const pool=eligible.filter(id=>!used.has(id)&&bookingAllowsPlayer(s,e.id,b.id,id,at,end));if(pool.length<2)continue;const pair=pool.slice(0,2);pair.forEach(id=>used.add(id));selected.push(...pair);courts.push(b)}
 if(!courts.length)fail('本时段同球馆正式球友不足2人，无法安排单打');
 const rating=(id:string)=>s.players.find(p=>p.id===id)?.rating??1000,history=s.matches.filter(m=>m.eventId===e.id&&!['draft','cancelled'].includes(m.status));
 const penalty=(list:string[])=>{const gaps:number[]=[];let repeats=0;for(let i=0;i<list.length;i+=2){const a=list[i],b=list[i+1];if(!canUse(i/2,a)||!canUse(i/2,b))return balanceCost([Infinity],Infinity);gaps.push(Math.abs(rating(a)-rating(b)));repeats+=history.filter(m=>(m.a.includes(a)&&m.b.includes(b))||(m.b.includes(a)&&m.a.includes(b))).length*75}return balanceCost(gaps,repeats)};
 let best=[...selected],cost=penalty(best),rng=seed>>>0;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
 for(let n=0;n<180;n++){const next=[...best],i=Math.floor(rand()*next.length),j=Math.floor(rand()*next.length);[next[i],next[j]]=[next[j],next[i]];const nextCost=penalty(next);if(compareBalance(nextCost,cost)<0){best=next;cost=nextCost}}
 return {eligible,rest:eligible.filter(id=>!used.has(id)),courts:courts.map((court,i)=>({courtId:court.id,a:[best[i*2]],b:[best[i*2+1]]})),stats:Object.fromEntries(eligible.map(id=>[id,debt(id)])),penalty:cost.variety,balance:cost};
}
