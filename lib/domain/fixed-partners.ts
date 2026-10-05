import {propose} from './grouping';
import {registrationSpans,bookingAllowsPlayer} from './booking-signups';
import {fail,type Event,type State} from './types';

export function fixedPartnerTeams(s:State,e:Event){
 const regs=s.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed'&&r.arrival<e.end&&r.departure>e.start&&s.players.some(p=>p.id===r.playerId&&p.enabled));
 const rating=(id:string)=>s.players.find(p=>p.id===id)?.rating??1000;
 const pool=[...new Set(regs.map(r=>r.playerId))].sort((a,b)=>rating(b)-rating(a)||a.localeCompare(b));
 const mean=pool.reduce((sum,id)=>sum+rating(id),0)/(pool.length||1),teams:string[][]=[];
 const overlap=(a:string,b:string)=>{const x=regs.find(r=>r.playerId===a)!,y=regs.find(r=>r.playerId===b)!;if(!x.bookingSignups&&!y.bookingSignups)return Math.max(0,Math.min(x.departure,y.departure,e.end)-Math.max(x.arrival,y.arrival,e.start));let longest=0;for(const u of registrationSpans(s,e,x))for(const v of registrationSpans(s,e,y)){if(u.bookingId&&v.bookingId&&u.bookingId!==v.bookingId)continue;longest=Math.max(longest,Math.max(0,Math.min(u.end??e.end,v.end??e.end)-Math.max(u.start,v.start)))}return longest};
 while(pool.length>1){const a=pool.shift()!;pool.sort((b,c)=>overlap(a,c)-overlap(a,b)||Math.abs((rating(a)+rating(b))/2-mean)-Math.abs((rating(a)+rating(c))/2-mean)||b.localeCompare(c));if(overlap(a,pool[0])<5*60000)continue;const b=pool.shift()!;teams.push([a,b])}
 return teams;
}

/** Reuse attendance, courts and fair-turn debt; keep partners throughout the activity. */
export function proposeFixed(s:State,e:Event,at:number,duration:number,seed:number,teams:string[][]){
 const base=propose(s,e,at,duration,seed),eligible=new Set(base.eligible);
 const available=teams.filter(t=>t.length===2&&t.every(id=>eligible.has(id)));
 if(available.length<2)fail('本轮完整到场的固定搭档不足两队，请检查参加时间或改用轮换搭档');
 const debt=(team:string[])=>team.reduce((sum,id)=>sum+(base.stats[id]?.deficit??0),0)/2;
 const wait=(team:string[])=>Math.min(...team.map(id=>base.stats[id]?.wait??0));
 available.sort((a,b)=>debt(b)-debt(a)||wait(b)-wait(a)||a.join(':').localeCompare(b.join(':')));
 const selected:string[][]=[],used=new Set<string>(),courts:typeof base.courts=[];
 for(const court of base.courts){const pool=available.filter(t=>t.every(id=>!used.has(id)&&bookingAllowsPlayer(s,e.id,court.courtId,id,at,at+duration*60000)));if(pool.length<2)continue;const chosen=pool.slice(0,2);chosen.flat().forEach(id=>used.add(id));selected.push(...chosen);courts.push(court)}
 const count=courts.length;if(!count)fail('本时段没有场地同时具备两队完整固定搭档');
 const rating=(t:string[])=>t.reduce((sum,id)=>sum+(s.players.find(p=>p.id===id)?.rating??1000),0)/2;
 const history=s.matches.filter(m=>m.eventId===e.id&&!['draft','cancelled'].includes(m.status));
 const same=(a:string[],b:string[])=>a.every(id=>b.includes(id));
 const penalty=(list:string[][])=>{let cost=0;for(let i=0;i<list.length;i+=2){if([...list[i],...list[i+1]].some(id=>!bookingAllowsPlayer(s,e.id,courts[i/2].courtId,id,at,at+duration*60000)))return Infinity;cost+=Math.abs(rating(list[i])-rating(list[i+1]));cost+=history.filter(m=>(same(m.a,list[i])&&same(m.b,list[i+1]))||(same(m.b,list[i])&&same(m.a,list[i+1]))).length*150}return cost};
 let rng=seed>>>0;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
 let best=[...selected],bestCost=penalty(best);
 for(let i=0;i<180;i++){const next=[...best],a=Math.floor(rand()*next.length),b=Math.floor(rand()*next.length);[next[a],next[b]]=[next[b],next[a]];const cost=penalty(next);if(cost<bestCost||(cost===bestCost&&rand()<0.1)){best=next;bestCost=cost}}
 const playing=new Set(best.flat());return {...base,rest:base.eligible.filter(id=>!playing.has(id)),courts:courts.slice(0,count).map((court,i)=>({courtId:court.courtId,a:best[i*2],b:best[i*2+1]})),penalty:bestCost};
}
