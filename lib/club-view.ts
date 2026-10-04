import type {State,Account} from './domain/types';
import {leaderboard,annualLeaderboard,replayRating} from './domain/ranking';
import {calculateSettlement} from './domain/money';
import {socialSnapshot} from './domain/social';
import {rotationPlan} from './domain/play';
import {enableDefaultAttendance,applyDefaultAttendance} from './domain/attendance';

export function projectClubState(s:State,a:Account,period:string,year:number,now=Date.now()){
 s=structuredClone(s);enableDefaultAttendance(s,now);applyDefaultAttendance(s);
 const admin=a.role==='admin';
 if(!admin)s.events=s.events.filter(e=>e.status!=='draft'||e.creatorId===a.id);
 const historicalIds=new Set(s.events.map(e=>e.id));
 const eventCollections=['bookings','registrations','attendance','rounds','matches','costs','settlements','payments','awardVotes'] as const;
 for(const key of eventCollections)(s[key] as unknown[])=s[key].filter(row=>historicalIds.has(row.eventId));
 // Deletion hides an activity's workspace; completed results stay historical facts.
 const social=socialSnapshot(s,period,year,now);
 const monthly=leaderboard(s,period),annual=annualLeaderboard(s,year);
 const ratingHistory=admin?replayRating(structuredClone(s)):[];
 const deletedEvents=s.events.filter(e=>e.deletedAt!==undefined&&(admin||e.creatorId===a.id)).map(e=>({id:e.id,title:e.title,start:e.start,end:e.end,deletedAt:e.deletedAt}));
 s.events=s.events.filter(e=>e.deletedAt===undefined);
 const ids=new Set(s.events.map(e=>e.id));
 for(const key of eventCollections)(s[key] as unknown[])=s[key].filter(row=>ids.has(row.eventId));
 const matchIds=new Set(s.matches.map(m=>m.id));
 const visibleMap=<T,>(rows:Record<string,T>,visible:Set<string>)=>Object.fromEntries(Object.entries(rows).filter(([id])=>visible.has(id)));
 const drafts=s.events.filter(e=>admin||e.creatorId===a.id).map(e=>calculateSettlement(s,e,now));
 return {
  revision:s.revision,settings:{name:s.settings.name,rules:s.settings.rules},me:a,
  players:s.players.map(p=>({...p,...(p.profile?{profile:Object.fromEntries(Object.entries(p.profile).filter(([key])=>!['grip','shoes'].includes(key)))}:{}),...(!admin?{rating:null,initialRating:null,ratingReason:''}:{}),ownerId:p.ownerId===a.id?a.id:''})),
  events:s.events,deletedEvents,bookings:s.bookings,registrations:s.registrations,attendance:s.attendance,rounds:s.rounds,matches:s.matches,costs:s.costs,seasons:s.seasons,
  leaderboard:monthly.map(r=>({...r,...(!admin?{rating:null}:{})})),annualLeaderboard:annual.map(r=>({...r,...(!admin?{rating:null}:{})})),rankingYear:year,period,
  social:{...social,arenas:visibleMap(social.arenas,ids),courtBoards:visibleMap(social.courtBoards,ids),matchLevels:visibleMap(social.matchLevels,matchIds)},
  challenges:s.challenges.filter(c=>matchIds.has(c.sourceMatchId)&&(!c.matchId||matchIds.has(c.matchId))),
  tagVotes:s.tagVotes.map(v=>({...v,voterId:v.voterId===a.id?a.id:''})),awardVotes:s.awardVotes.map(v=>({...v,voterId:v.voterId===a.id?a.id:''})),
  photos:s.photos.filter(p=>(p.kind==='avatar'||p.kind==='racket')||ids.has(p.eventId??'')).map(({key,...p})=>p),
  rotationPlans:Object.fromEntries(s.events.map(e=>[e.id,rotationPlan(s,e,now)])),settlements:s.settlements.map(x=>({...x,bills:x.bills,detail:x.detail})),
  audits:admin?s.audits:[],accounts:admin?s.accounts:[],drafts,ratingHistory,
 };
}
