import {canDeletePhoto} from './domain/photo-deletion';
import {achievementSnapshot} from './domain/achievements';
import {clubOwnerId,clubOwnerPlayerId,isClubOwner} from './domain/ownership';
import type {State,Account} from './domain/types';
import {leaderboard,annualLeaderboard,replayRating} from './domain/ranking';
import {calculateSettlement} from './domain/money';
import {socialSnapshot} from './domain/social';
import {rotationPlan} from './domain/play';
import {enableDefaultAttendance,applyDefaultAttendance} from './domain/attendance';

export function projectClubState(s:State,a:Account,period:string,year:number,now=Date.now()){
 s=structuredClone(s);enableDefaultAttendance(s,now);const actualAttendance=s.attendance;applyDefaultAttendance(s);
 const admin=a.role==='admin',history={...s},ownerId=clubOwnerId(s),ownerPlayerId=clubOwnerPlayerId(s);
 if(!admin)s.events=s.events.filter(e=>e.status!=='draft'||e.creatorId===a.id);
 const historicalIds=new Set(s.events.map(e=>e.id));
 const eventCollections=['bookings','registrations','attendance','rounds','matches','costs','settlements','payments','awardVotes'] as const;
 for(const key of eventCollections)(s[key] as unknown[])=s[key].filter(row=>historicalIds.has(row.eventId));
 const achievements=achievementSnapshot({...history,events:s.events,matches:s.matches},now);
 // Deletion hides an activity's workspace; completed results stay historical facts.
 const monthly=leaderboard(history,period),annual=annualLeaderboard(history,year);
 const ratingHistory=admin?replayRating(structuredClone(history)):[];
 const mergedEventTargets=Object.fromEntries(s.events.filter(e=>e.deletedAt!==undefined&&e.mergedInto&&s.events.some(t=>t.id===e.mergedInto&&t.deletedAt===undefined)).map(e=>[e.id,e.mergedInto]));
 const deletedEvents=s.events.filter(e=>e.deletedAt!==undefined&&(admin||e.creatorId===a.id)).map(e=>({id:e.id,title:e.title,start:e.start,end:e.end,deletedAt:e.deletedAt,...(e.mergedInto?{mergedInto:e.mergedInto}:{})}));
 s.events=s.events.filter(e=>e.deletedAt===undefined);
 const ids=new Set(s.events.map(e=>e.id));
 for(const key of eventCollections)(s[key] as unknown[])=s[key].filter(row=>ids.has(row.eventId));
 const matchIds=new Set(s.matches.map(m=>m.id));
 const social=socialSnapshot(s,period,year,now,history);
 const drafts=s.events.filter(e=>admin||e.creatorId===a.id).map(e=>calculateSettlement({...s,attendance:actualAttendance},e,now));
 return {
  revision:s.revision,settings:{name:s.settings.name,rules:s.settings.rules},me:{...a,isOwner:isClubOwner(s,a)},permissions:{canManageRoles:admin&&isClubOwner(s,a)},
  players:s.players.map(p=>({...p,protectedOwner:p.id===ownerPlayerId,...(p.profile?{profile:Object.fromEntries(Object.entries(p.profile).filter(([key])=>!['grip','shoes'].includes(key)))}:{}),...(!admin?{rating:null,initialRating:null,ratingReason:''}:{}),ownerId:p.ownerId===a.id?a.id:''})),
  events:s.events.map(e=>({...e,...(e.pointsChoice?{pointsChoice:{...e.pointsChoice,votes:e.pointsChoice.votes.map(v=>({...v,voterId:v.voterId===a.id?a.id:''}))}}:{}),...(e.shuttlePlan?{shuttlePlan:{...e.shuttlePlan,votes:e.shuttlePlan.votes.map(v=>({...v,voterId:v.voterId===a.id?a.id:''}))}}:{})})),deletedEvents,mergedEventTargets,bookings:s.bookings,registrations:s.registrations,attendance:s.attendance,rounds:s.rounds,matches:s.matches,costs:s.costs,seasons:s.seasons,
  leaderboard:monthly.map(r=>({...r,...(!admin?{rating:null}:{})})),annualLeaderboard:annual.map(r=>({...r,...(!admin?{rating:null}:{})})),rankingYear:year,period,
  social,
  achievements,
  challenges:s.challenges.filter(c=>matchIds.has(c.sourceMatchId)&&(!c.matchId||matchIds.has(c.matchId))),
  tagVotes:s.tagVotes.map(v=>({...v,voterId:v.voterId===a.id?a.id:''})),awardVotes:s.awardVotes.map(v=>({...v,voterId:v.voterId===a.id?a.id:''})),
  photos:s.photos.filter(p=>(p.kind==='avatar'||p.kind==='racket')||ids.has(p.eventId??'')).map(({key,...p})=>({...p,canDelete:canDeletePhoto(s,a,{key,...p})})),
  rotationPlans:Object.fromEntries(s.events.map(e=>[e.id,rotationPlan(s,e,now)])),settlements:s.settlements.map(x=>({...x,bills:x.bills,detail:x.detail})),
  audits:admin?s.audits:[],accounts:admin?s.accounts.map(account=>({...account,isOwner:account.id===ownerId,canModify:account.id!==ownerId||isClubOwner(s,a)})):[],drafts,ratingHistory,
 };
}
