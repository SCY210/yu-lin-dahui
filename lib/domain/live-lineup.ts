import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {authorizeEventAction} from './permissions';
import {eventStatusAt} from './event-lifecycle';
import {teamSize} from './match-format';
import {bookingAllowsPlayer} from './booking-signups';
import {livePresentIds,liveResting} from './live-play';
import {decorateMatch} from './play';
import {fail,type State,type Event,type Match,type Account} from './types';
const id=z.string().min(1).max(100),team=z.array(id).min(1).max(2);
const schemas={liveLineup:z.object({matchId:id,a:team,b:team,expectedA:team,expectedB:team})};
/** Candidates belong to this venue and signup window, are not on another court, and are not taking a break. */
export function liveLineupCandidates(s:State,e:Event,m:Match,now:number){
 const busy=new Set(s.matches.filter(x=>x.id!==m.id&&x.status==='playing').flatMap(x=>[...x.a,...x.b]));
 const current=new Set([...m.a,...m.b]),venue=s.bookings.find(b=>b.id===m.courtId)?.venue??e.venue;
 return livePresentIds(s,e,now).filter(id=>!busy.has(id)&&bookingAllowsPlayer(s,e.id,m.courtId,id,now,now+1)&&(!liveResting(e,id,venue)||current.has(id)));
}
/** Explicit correction of the current lineup; never completes a game or changes another court. */
export async function applyLiveLineup(s:State,a:Account,action:string,input:unknown,now:number){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 const p=command.payload;authorizeEventAction(s,a,action,p);
 const m=s.matches.find(m=>m.id===p.matchId)??fail('对局不存在');
 const e=s.events.find(e=>e.id===m.eventId&&e.deletedAt===undefined)??fail('活动不存在或已删除');
 const r=s.rounds.find(r=>r.id===m.roundId&&r.eventId===e.id)??fail('轮次不存在');
 if(!e.livePlay?.enabled||m.status!=='playing'||r.status!=='playing'||m.start===null||m.games.length||m.scoreA!==null||m.scoreB!==null)fail('只能调整实时排场中尚未录分的当前对局');
 if(['draft','ended','cancelled'].includes(eventStatusAt(e,now))||now<e.start)fail('活动已结束或尚未开始，不能调整当前上场人员');
 if(JSON.stringify(m.a)!==JSON.stringify(p.expectedA)||JSON.stringify(m.b)!==JSON.stringify(p.expectedB))fail('409: 上场人员已更新，请刷新后重新选择');
 const size=teamSize(e),selected=[...p.a,...p.b];
 if(p.a.length!==size||p.b.length!==size)fail(size===1?'单打每队须有一人':'双打每队须有两人');
 if(new Set(selected).size!==selected.length)fail('同一球友不能占两个位置');
 const allowed=new Set(liveLineupCandidates(s,e,m,now));
 if(selected.some(id=>!allowed.has(id)))fail('所选球友不在可上场名单：请检查报名、参加时段、轮休和其他场地对局');
 const before={a:[...m.a],b:[...m.b]};
 m.a=[...p.a];m.b=[...p.b];decorateMatch(s,e,m);
 r.eligible=[...new Set([...r.eligible,...selected])];
 const playing=new Set(s.matches.filter(x=>x.status==='playing').flatMap(x=>[...x.a,...x.b]));
 r.rest=livePresentIds(s,e,now).filter(id=>!playing.has(id));
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'手动调整本局上场人员',changes:{eventId:e.id,matchId:m.id,before,after:{a:[...m.a],b:[...m.b]}}});
 return true;
}
