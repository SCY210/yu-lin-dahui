import {googleMapsUrl} from './venues';
import {profileEditMode} from './domain/profile-permissions';
import {canRecoverEvent,privateEventState} from './domain/event-privacy';
import {eventStatusAt} from './domain/event-lifecycle';
import {pointGrants} from './domain/point-grants';
import {maskClubContent} from './domain/blocked-words';
import {canDeletePhoto} from './domain/photo-deletion';
import {achievementSnapshot} from './domain/achievements';
import {clubOwnerId,clubOwnerPlayerId,isClubOwner} from './domain/ownership';
import type {State,Account} from './domain/types';
import {doublesLeaderboard as leaderboard,doublesQuarterlyLeaderboard as quarterlyLeaderboard,doublesAnnualLeaderboard as annualLeaderboard,singlesQuarterlyLeaderboard,singlesAnnualLeaderboard,replayRating} from './domain/ranking';
import {realmLedger,visibleRealm,type RealmSnapshot} from './domain/realm-rating';
import {cancellationView} from './domain/cancellations';
import {visibleActivityAcknowledgements} from './domain/activity-acknowledgement';
import {treasureShopView} from './domain/treasure-shop';
import {bonusNotices} from './domain/bonus-notices';
import {withScorer} from './domain/score-conflict';
import {guestIds,guestHostName,guestLevelAt} from './domain/guests';
import {rankingQuarter} from './ranking-quarter';
import {calculateSettlementPreview} from './domain/money';
import {socialSnapshot} from './domain/social';
import {rotationPlan} from './domain/play';
import {enableDefaultAttendance,applyDefaultAttendance} from './domain/attendance';

// Retired profile fields may remain in stored JSON for compatibility, but are never shown: grip/shoes and the self-assessed level.
const hiddenProfileKeys=['grip','shoes','level'];
export function projectClubState(s:State,a:Account,period:string,year:number,now=Date.now()){
 s=structuredClone(s);for(const e of s.events)e.status=eventStatusAt(e,now);enableDefaultAttendance(s,now);const actualAttendance=s.attendance;applyDefaultAttendance(s);
 const admin=a.role==='admin',history={...s},ownerId=clubOwnerId(s),ownerPlayerId=clubOwnerPlayerId(s);
 if(!admin)s.events=s.events.filter(e=>e.status!=='draft'||e.creatorId===a.id);
 const historicalIds=new Set(s.events.map(e=>e.id));
 const eventCollections=['bookings','registrations','attendance','rounds','matches','costs','settlements','payments','awardVotes'] as const;
 for(const key of eventCollections)(s[key] as unknown[])=s[key].filter(row=>historicalIds.has(row.eventId));
 const achievements=achievementSnapshot({...history,events:s.events,matches:s.matches},now);
 // Deletion hides an activity's workspace; completed results stay historical facts.
 // Realms, 修为 and strength labels settle per activity, while ranking points stay live.
 const guests=guestIds(history);
 const ledger=realmLedger(history,now),monthly=leaderboard(history,period,now,ledger),quarter=rankingQuarter(period),quarterly=quarterlyLeaderboard(history,quarter,now,ledger),annual=annualLeaderboard(history,year,now,ledger),singlesQuarterly=singlesQuarterlyLeaderboard(history,quarter,now,ledger),singlesAnnual=singlesAnnualLeaderboard(history,year,now,ledger);
 const ratingHistory=admin?replayRating(structuredClone(history),now):[];
 const mergedEventTargets=Object.fromEntries(s.events.filter(e=>e.deletedAt!==undefined&&e.mergedInto&&s.events.some(t=>t.id===e.mergedInto&&t.deletedAt===undefined)).map(e=>[e.id,e.mergedInto]));
 const deletedEvents=s.events.filter(e=>e.deletedAt!==undefined&&canRecoverEvent(s,a,e)).map(e=>({id:e.id,title:e.title,start:e.start,end:e.end,deletedAt:e.deletedAt,...(e.mergedInto?{mergedInto:e.mergedInto}:{})}));
 s.events=s.events.filter(e=>e.deletedAt===undefined);
 const ids=new Set(s.events.map(e=>e.id));
 for(const key of eventCollections)(s[key] as unknown[])=s[key].filter(row=>ids.has(row.eventId));
 const matchIds=new Set(s.matches.map(m=>m.id));
 // Members never see a realm during placement: rows and stats carry only the settled count and 修为 then.
 const realmView=(realm:RealmSnapshot)=>realm.placement?null:realm.realm;
 const board=<T extends {rating:number;realm:string;realmScore:RealmSnapshot}>(rows:T[])=>rows.map(r=>({...r,rating:admin?r.rating:null,realm:realmView(r.realmScore),realmScore:visibleRealm(r.realmScore)}));
 const fullSocial=socialSnapshot(s,period,year,now,history,ledger.snapshot);
 const permanent=new Set(history.players.filter(p=>!guests.has(p.id)).map(p=>p.id));
 const social={...fullSocial,funny:fullSocial.funny.filter(st=>permanent.has(st.playerId)),personality:fullSocial.personality.filter(st=>permanent.has(st.playerId)),annual:fullSocial.annual.filter(st=>permanent.has(st.playerId)),stats:fullSocial.stats.filter(st=>permanent.has(st.playerId)).map(st=>({...st,tier:realmView(st.realmScore),realmScore:visibleRealm(st.realmScore)}))};
 const drafts=s.events.filter(e=>admin||e.creatorId===a.id).map(e=>calculateSettlementPreview({...s,attendance:actualAttendance},e,now));
 return maskClubContent({
  revision:s.revision,settings:{name:s.settings.name,rules:s.settings.rules,feePayees:(s.settings.feePayees??[]).map(({id,name,phone,createdBy})=>({id,name,phone,mine:createdBy===a.id})),...(admin?{blockedWords:s.settings.blockedWords??[]}:{})},me:{...a,bonusNotices:bonusNotices(history,a,now),isOwner:isClubOwner(s,a)},permissions:{canManageRoles:admin&&isClubOwner(s,a),canManageBlockedWords:admin},
  players:s.players.filter(p=>!p.guestEventId||ids.has(p.guestEventId)).map(p=>({...p,...(guests.has(p.id)?{guest:true,guestHost:guestHostName(s,p.id)??'球友',guestLevel:guestLevelAt(p)}:{}),profileEditMode:profileEditMode(s,p.id,a),protectedOwner:p.id===ownerPlayerId,...(p.profile?{profile:Object.fromEntries(Object.entries(p.profile).filter(([key])=>!hiddenProfileKeys.includes(key)))}:{}),...(!admin?{rating:null,initialRating:null,ratingReason:''}:{}),ownerId:p.ownerId===a.id?a.id:''})),
  events:s.events.map(e=>({...e,mapUrl:googleMapsUrl(e.venue,e.address),...(e.pointsChoice?{pointsChoice:{...e.pointsChoice,votes:e.pointsChoice.votes.map(v=>({...v,voterId:v.voterId===a.id?a.id:''}))}}:{}),...(e.shuttlePlan?{shuttlePlan:{...e.shuttlePlan,votes:e.shuttlePlan.votes.map(v=>({...v,voterId:v.voterId===a.id?a.id:''}))}}:{})})),deletedEvents,mergedEventTargets,bookings:s.bookings.map(b=>{const e=s.events.find(e=>e.id===b.eventId);return {...b,mapUrl:googleMapsUrl(b.venue??e?.venue??'',b.address??e?.address??'')}}),registrations:s.registrations.map(({cancelledAt:_at,cancelledBy:_by,cancelledAs:_as,cancelReason:_reason,noticeAcknowledgements:_notice,...r})=>{const notice=visibleActivityAcknowledgements(history,a,{...r,noticeAcknowledgements:_notice}),cancellation=cancellationView(history,{...r,cancelledAt:_at,cancelledBy:_by,cancelledAs:_as,cancelReason:_reason});return {...r,...(notice?.length?{noticeAcknowledgements:notice}:{}),...(cancellation?{cancellation}:{})}}),attendance:s.attendance,rounds:s.rounds,matches:s.matches.map(m=>withScorer(s,m)),costs:s.costs,seasons:s.seasons,
  // Compatibility for tabs opened before deployment; no monthly board is shown.
  leaderboard:board(monthly),quarterlyLeaderboard:board(quarterly),rankingQuarter:quarter,annualLeaderboard:board(annual),rankingYear:year,period,
  singlesQuarterlyLeaderboard:board(singlesQuarterly),singlesAnnualLeaderboard:board(singlesAnnual),
  social,
  pointGrants:isClubOwner(s,a)?pointGrants(s):[],
  treasureShop:treasureShopView(s,a),
  achievements,
  challenges:s.challenges.filter(c=>matchIds.has(c.sourceMatchId)&&(!c.matchId||matchIds.has(c.matchId))),
  tagVotes:[] as State['tagVotes'],awardVotes:s.awardVotes.filter(v=>v.category==='mvp').map((v,i)=>{const event=s.events.find(e=>e.id===v.eventId),voter=event&&(a.role==='admin'||isClubOwner(s,a))?s.accounts.find(x=>x.id===v.voterId):undefined;return {...v,id:v.voterId===a.id?v.id:'award:'+v.eventId+':mvp:'+i,voterId:v.voterId===a.id?a.id:'',...(voter?{voterPlayerId:voter.playerId}:{})}}),
  photos:s.photos.filter(p=>(p.kind==='avatar'||p.kind==='racket')||ids.has(p.eventId??'')).map(({key,...p})=>({...p,canDelete:canDeletePhoto(s,a,{key,...p})})),
  rotationPlans:Object.fromEntries(s.events.map(e=>[e.id,rotationPlan(s,e,now)])),settlements:s.settlements.map(x=>({...x,bills:x.bills,detail:x.detail})),
  // Only what paid status needs: who, for which activity, how much.
  payments:s.payments.map(({eventId,playerId,cents})=>({eventId,playerId,cents})),
  audits:admin?privateEventState(history,a).audits:[],accounts:admin?s.accounts.map(account=>({...account,isOwner:account.id===ownerId,canEditProfileName:profileEditMode(s,account.playerId,a)==='full',canModify:account.id!==ownerId||isClubOwner(s,a)})):[],drafts,ratingHistory,
 },s.settings.blockedWords??[]);
}
