import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {authorizeEventAction} from './permissions';
import {liveActivityAvailable,liveAvailabilityTime} from './live-window';
import {teamSize} from './match-format';
import {bookingAllowsPlayer} from './booking-signups';
import {livePresentIds,liveVoluntaryResting} from './live-play';
import {decorateMatch} from './play';
import {fail,type State,type Event,type Match,type Account} from './types';
const id=z.string().min(1).max(100),team=z.array(id).min(1).max(2);
const lineup=z.array(z.object({id,a:team,b:team})).max(64);
const schemas={liveLineup:z.object({matchId:id,a:team,b:team,expectedA:team,expectedB:team}),liveSwap:z.object({eventId:id,p1:id,p2:id,expectedLineup:lineup})};
/** Manual selection may override the automatic two-win break, but not voluntary rest or availability checks. */
export function liveLineupCandidates(s:State,e:Event,m:Match,now:number){
 const at=liveAvailabilityTime(e,now);
 const busy=new Set(s.matches.filter(x=>x.id!==m.id&&x.status==='playing').flatMap(x=>[...x.a,...x.b]));
 const current=new Set([...m.a,...m.b]),venue=s.bookings.find(b=>b.id===m.courtId)?.venue??e.venue;
 return livePresentIds(s,e,now).filter(id=>!busy.has(id)&&bookingAllowsPlayer(s,e.id,m.courtId,id,at,at+1)&&(!liveVoluntaryResting(e,id,venue)||current.has(id)));
}
function clearManualWinRest(e:Event,selected:string[]){
 const ids=new Set(selected);if(e.livePlay)e.livePlay.rest=e.livePlay.rest.filter(r=>r.reason!=='two-wins'||!ids.has(r.playerId));
}
/** The unscored games currently on court, in the same snapshot form as a planned round (round-lineup.ts). */
export function liveLineupSnapshot(s:Pick<State,'matches'>,eventId:string){
 return s.matches.filter(m=>m.eventId===eventId&&m.status==='playing').map(m=>({id:m.id,a:[...m.a],b:[...m.b]})).sort((x,y)=>x.id.localeCompare(y.id));
}
const unscored=(m:Match)=>m.start!==null&&!m.games.length&&m.scoreA===null&&m.scoreB===null;
/** The same interaction as a planned round: two players trade places. Partners on one court, a player on court and
 * one waiting, or players on two courts. Every touched game is validated as a whole before anything is stored. */
function swapLivePlayers(s:State,a:Account,p:{eventId:string;p1:string;p2:string;expectedLineup:{id:string;a:string[];b:string[]}[]},now:number){
 const e=s.events.find(e=>e.id===p.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 if(!e.livePlay?.enabled)fail('只能在实时排场中交换当前上场人员');
 if(!liveActivityAvailable(e,now)||now<e.start)fail('活动已结束或尚未开始，不能调整当前上场人员');
 if(e.pointsChoice?.selectedMode==='fixed')fail('固定搭档不能单局交换成员');
 const expected=[...p.expectedLineup].map(m=>({id:m.id,a:[...m.a],b:[...m.b]})).sort((x,y)=>x.id.localeCompare(y.id));
 if(JSON.stringify(expected)!==JSON.stringify(liveLineupSnapshot(s,e.id)))fail('409: 上场人员已更新，请重新选择要交换的球友');
 if(p.p1===p.p2)fail('请选择两位不同的球友');
 const current=s.matches.filter(m=>m.eventId===e.id&&m.status==='playing'),has=(m:Match,id:string)=>m.a.includes(id)||m.b.includes(id);
 const touched=current.filter(m=>has(m,p.p1)||has(m,p.p2));
 if(!touched.length)fail('请选择至少一位正在场上的球友');
 if(touched.some(m=>!unscored(m)))fail('已录分的对局不能换人');
 const swap=(id:string)=>id===p.p1?p.p2:id===p.p2?p.p1:id;
 const next=touched.map(m=>({...m,a:m.a.map(swap),b:m.b.map(swap)})),view={...s,matches:s.matches.map(m=>next.find(n=>n.id===m.id)??m)};
 for(const m of next){
  const selected=[...m.a,...m.b];if(new Set(selected).size!==selected.length)fail('同一球友不能占两个位置');
  // The original lineup protects voluntary rest; the automatic two-win break permits an explicit override.
  const allowed=new Set(liveLineupCandidates(view,e,touched.find(x=>x.id===m.id)!,now));
  if(selected.some(id=>!allowed.has(id)))fail('409: 所选球友已不在可上场名单，请检查报名时段和轮休状态');
 }
 const before=touched.map(m=>({matchId:m.id,a:[...m.a],b:[...m.b]}));
 const retained=new Set(s.rounds.filter(r=>current.some(m=>m.roundId===r.id)).flatMap(r=>r.liveRetained??[]));
 for(const m of next){const original=touched.find(x=>x.id===m.id)!;original.a=m.a;original.b=m.b;decorateMatch(s,e,original)}
 clearManualWinRest(e,next.flatMap(m=>[...m.a,...m.b]));
 const playing=new Set(current.flatMap(m=>[...m.a,...m.b])),rest=livePresentIds(s,e,now).filter(id=>!playing.has(id));
 for(const m of touched){const r=s.rounds.find(r=>r.id===m.roundId);if(r){r.eligible=[...new Set([...r.eligible,...m.a,...m.b])];r.rest=rest;r.liveRetained=[...new Set([...(r.liveRetained??[]),...[...m.a,...m.b].filter(id=>retained.has(id))])]}}
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'liveSwap',reason:'交换实时排场上场人员',changes:{eventId:e.id,p1:p.p1,p2:p.p2,before,after:touched.map(m=>({matchId:m.id,a:[...m.a],b:[...m.b]}))}});
}
/** Explicit correction of the current lineup; never completes a game or changes another court. */
export async function applyLiveLineup(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 if(command.action==='liveSwap'){authorizeEventAction(s,a,action,command.payload);swapLivePlayers(s,a,command.payload,now);return true}
 const p=command.payload;authorizeEventAction(s,a,action,p);
 const m=s.matches.find(m=>m.id===p.matchId)??fail('对局不存在');
 const e=s.events.find(e=>e.id===m.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 const r=s.rounds.find(r=>r.id===m.roundId&&r.eventId===e.id)??fail('轮次不存在');
 if(!e.livePlay?.enabled||m.status!=='playing'||r.status!=='playing'||m.start===null||m.games.length||m.scoreA!==null||m.scoreB!==null)fail('只能调整实时排场中尚未录分的当前对局');
 if(!liveActivityAvailable(e,now)||now<e.start)fail('活动已结束或尚未开始，不能调整当前上场人员');
 if(JSON.stringify(m.a)!==JSON.stringify(p.expectedA)||JSON.stringify(m.b)!==JSON.stringify(p.expectedB))fail('409: 上场人员已更新，请刷新后重新选择');
 const size=teamSize(e),selected=[...p.a,...p.b];
 if(p.a.length!==size||p.b.length!==size)fail(size===1?'单打每队须有一人':'双打每队须有两人');
 if(new Set(selected).size!==selected.length)fail('同一球友不能占两个位置');
 const allowed=new Set(liveLineupCandidates(s,e,m,now));
 if(selected.some(id=>!allowed.has(id)))fail('409: 所选球友已不在可上场名单，请检查其他场地的最新阵容、报名时段和轮休状态');
 const before={a:[...m.a],b:[...m.b]};
 const currentRounds=new Set(s.matches.filter(x=>x.eventId===e.id&&x.status==='playing').map(x=>x.roundId));
 const retained=new Set(s.rounds.filter(x=>currentRounds.has(x.id)).flatMap(x=>x.liveRetained??[]));
 m.a=[...p.a];m.b=[...p.b];decorateMatch(s,e,m);
 clearManualWinRest(e,selected);
 // A brief swap to the bench and back before any game completes is not a completed rest.
 r.liveRetained=[...new Set([...(r.liveRetained??[]),...selected.filter(id=>retained.has(id))])];
 r.eligible=[...new Set([...r.eligible,...selected])];
 const playing=new Set(s.matches.filter(x=>x.status==='playing').flatMap(x=>[...x.a,...x.b]));
 r.rest=livePresentIds(s,e,now).filter(id=>!playing.has(id));
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'手动调整本局上场人员',changes:{eventId:e.id,matchId:m.id,before,after:{a:[...m.a],b:[...m.b]}}});
 return true;
}
