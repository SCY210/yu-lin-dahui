import {propose,validateRound} from './grouping';
import {fixedPartnerTeams,proposeFixed} from './fixed-partners';
import {decorateMatch} from './play';
import {clearFilledPointsWaiting} from './points-attendance';
import {month,type Event,type Match,type Round,type State} from './types';

export type PlannedGap={duration:number;until:number;courtIds:string[];futureRoundIds:string[];playerIds:string[]};

/** Fill only the gap before a confirmed later phase. Existing future lineups
 * remain stored; they do not count as already played when choosing this game. */
export function fillPlannedGap(s:State,e:Event,now:number,gap:PlannedGap){
 const future=new Set(gap.futureRoundIds),courts=new Set(gap.courtIds),players=new Set(gap.playerIds);
 const proposalState={...s,registrations:s.registrations.filter(r=>r.eventId!==e.id||players.has(r.playerId)),bookings:s.bookings.filter(b=>b.eventId!==e.id||courts.has(b.id)),rounds:s.rounds.filter(r=>r.eventId===e.id&&!future.has(r.id)),matches:s.matches.filter(m=>m.eventId===e.id?(!future.has(m.roundId)||m.status==='playing'):m.status==='playing')};
 const seed=Math.floor(now)%2147483646+1;
 let proposal:ReturnType<typeof propose>;
 try{proposal=e.pointsChoice?.selectedMode==='fixed'?proposeFixed(proposalState,e,now,gap.duration,seed,e.pointsChoice.teams??fixedPartnerTeams(proposalState,e)):propose(proposalState,e,now,gap.duration,seed)}catch{return false}
 if(!proposal.courts.length)return false;
 const round:Round={id:crypto.randomUUID(),eventId:e.id,start:now,duration:gap.duration,status:'playing',eligible:proposal.eligible,rest:proposal.rest,seed,pointsSlot:Math.max(0,...s.rounds.filter(r=>r.eventId===e.id).map(r=>r.pointsSlot??0))+1};
 const matches:Match[]=proposal.courts.map(c=>{const m:Match={...c,id:crypto.randomUUID(),eventId:e.id,roundId:round.id,status:'playing',start:now,end:null,scoreA:null,scoreB:null,games:[],monthly:true,elo:true,locked:false,enteredBy:null};decorateMatch(s,e,m);return m});
 validateRound(proposalState,e.id,now,gap.duration,matches);
 s.rounds.push(round);s.matches.push(...matches);clearFilledPointsWaiting(s,e);
 const season=month(now);if(!s.seasons.some(x=>x.id===season))s.seasons.push({id:season,rules:{...s.settings.rules},version:1});
 s.audits.push({id:crypto.randomUUID(),at:now,actor:'system:points-courts',action:'pointsGapFill',reason:'本时段预排已结束，使用当前可上场球友继续补排',changes:{eventId:e.id,roundId:round.id,matchIds:matches.map(m=>m.id),until:gap.until}});
 return true;
}
