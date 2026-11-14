import {propose,validateRound} from './grouping';
import {fixedPartnerTeams,proposeFixed} from './fixed-partners';
import {decorateMatch} from './play';
import {pendingMatchLineup} from './round-lineup';
import type {Event,Match,Round,State} from './types';

const order=(a:Round,b:Round)=>(a.pointsSlot??0)-(b.pointsSlot??0)||a.start-b.start||a.id.localeCompare(b.id);
const swappedRound=(changes:unknown)=>{const c=changes as {roundId?:unknown;input?:{roundId?:unknown}}|undefined;const id=c?.roundId??c?.input?.roundId;return typeof id==='string'?id:undefined};

/** A phase change skips the unstarted planned games of the phase that ended (pointsPhaseAdvance), so their players lose
 * those games. The unstarted rounds after it were planned as if those games had been played; they are planned again
 * from the games actually played, with the same times, seeds and courts, so the players who lost a game get it back
 * (docs/MATCH_GROUPING.md). Rounds an organiser swapped by hand, rounds with a started or scored game, drafts and
 * overtime rounds keep their lineups. Planning every remaining round can take about a second on four courts, which
 * Workers Paid allows (docs/PERFORMANCE_BUDGET.md); it runs once per phase change, never on an unchanged poll. If one
 * round cannot be planned, nothing changes. Returns the IDs of the rounds planned again. */
export function replanAfterExpiry(s:State,e:Event,now:number,reason='跳过的预排不再补打，按实际对局重排之后尚未开打的轮次'):string[]{
 if(e.playMode==='arena'||e.livePlay?.enabled||e.tournament)return [];
 const swapped=new Set(s.audits.filter(a=>a.action==='swap').map(a=>swappedRound(a.changes)));
 const byRound=new Map<string,Match[]>();
 for(const m of s.matches)if(m.eventId===e.id&&m.status!=='cancelled'){const rows=byRound.get(m.roundId)??[];rows.push(m);byRound.set(m.roundId,rows)}
 const rounds=s.rounds.filter(r=>r.eventId===e.id&&!r.live&&!r.overtime&&r.pointsSlot!==undefined&&r.status==='published'&&!swapped.has(r.id)&&!!byRound.get(r.id)?.every(m=>m.status==='published'&&pendingMatchLineup(m))).sort(order);
 if(!rounds.length)return [];
 const again=new Set(rounds.map(r=>r.id));
 // As when appending a round (pointsNext): games now playing count as planned, so their courts and players are free for
 // later rounds. The rounds planned again start empty and are filled one after another, each seeing the ones before.
 const work:State={...s,rounds:s.rounds.map(r=>again.has(r.id)?{...r,status:'cancelled'}:r),matches:s.matches.filter(m=>!again.has(m.roundId)).map(m=>m.eventId===e.id&&m.status==='playing'?{...m,status:'published'}:m)};
 const teams=e.pointsChoice?.selectedMode==='fixed'?e.pointsChoice.teams??fixedPartnerTeams(work,e):undefined;
 const planned:{round:Round;eligible:string[];rest:string[];matches:Match[]}[]=[];
 try{
  for(const round of rounds){
   const proposal=teams?proposeFixed(work,e,round.start,round.duration,round.seed,teams):propose(work,e,round.start,round.duration,round.seed);
   if(!proposal.courts.length)return [];
   const matches=proposal.courts.map(c=>{const m:Match={...c,id:crypto.randomUUID(),eventId:e.id,roundId:round.id,status:'published',start:null,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};decorateMatch(work,e,m);return m});
   validateRound(work,e.id,round.start,round.duration,matches);
   work.rounds=work.rounds.map(r=>r.id===round.id?{...round,eligible:proposal.eligible,rest:proposal.rest}:r);work.matches=[...work.matches,...matches];
   planned.push({round,eligible:proposal.eligible,rest:proposal.rest,matches});
  }
 }catch{return []}
 // A court keeps its game ID, so a phone showing the old schedule follows the same game; games on courts the new plan
 // does not use are cancelled.
 for(const {round,eligible,rest,matches} of planned){
  round.eligible=eligible;round.rest=rest;
  const old=byRound.get(round.id)!,used=new Set<Match>();
  for(const m of matches){
   const same=old.find(x=>!used.has(x)&&x.courtId===m.courtId);
   // Replaced whole, so no label or no-show of the old lineup stays behind.
   if(same){used.add(same);s.matches[s.matches.indexOf(same)]={...m,id:same.id}}else s.matches.push(m);
  }
  for(const x of old)if(!used.has(x))x.status='cancelled';
 }
 s.audits.push({id:crypto.randomUUID(),at:now,actor:'system:points-courts',action:'pointsReplan',reason,changes:{eventId:e.id,roundIds:[...again]}});
 return [...again];
}
