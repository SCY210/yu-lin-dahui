import {googleMapsUrl} from './venues';
import {canUseSimulation} from './domain/simulation-access';
import {profileEditMode} from './domain/profile-permissions';
import {canRecoverEvent,privateEventState} from './domain/event-privacy';
import {eventStatusAt} from './domain/event-lifecycle';
import {pointGrants} from './domain/point-grants';
import {maskClubContent} from './domain/blocked-words';
import {canDeletePhoto} from './domain/photo-deletion';
import {achievementSnapshot} from './domain/achievements';
import {clubOwnerId,clubOwnerPlayerId,isClubOwner} from './domain/ownership';
import {month,type State,type Account} from './domain/types';
import {activeAvatarStreaks} from './domain/season-points';
import {doublesLeaderboard as leaderboard,doublesQuarterlyLeaderboard as quarterlyLeaderboard,doublesAnnualLeaderboard as annualLeaderboard,singlesQuarterlyLeaderboard,singlesAnnualLeaderboard} from './domain/ranking';
import {realmLedger,visibleRealm,type RealmSnapshot} from './domain/realm-rating';
import {cancellationView} from './domain/cancellations';
import {visibleActivityAcknowledgements} from './domain/activity-acknowledgement';
import {treasureShopView} from './domain/treasure-shop';
import {bonusNotices} from './domain/bonus-notices';
import {bondHistory,bondView,giftNotices} from './domain/bonds';
import {pairingOddsView} from './domain/pairing-odds';
import {withScorer} from './domain/score-conflict';
import {guestIds,guestHostName,guestHostPlayerId,guestLevelAt} from './domain/guests';
import {rankingQuarter} from './ranking-quarter';
import {calculateSettlementPreview} from './domain/money';
import {socialHistoryParts,socialSnapshot} from './domain/social';
import {sharedClubValue,sharedViewValidUntil,sharedRealmLedger} from './club-view-shared';
import {rotationPlan} from './domain/play';
import {bountyOutcome,bountySettings} from './domain/bounties';
import {enableDefaultAttendance,applyDefaultAttendance} from './domain/attendance';

// Retired profile fields may remain in stored JSON for compatibility, but are never shown: grip/shoes and the self-assessed level.
const hiddenProfileKeys=['grip','shoes','level'];
/** `shared.revision`: the stored revision this state was loaded at. Only the read route passes it, so history-only
 * results can be reused across members' requests (lib/club-view-shared.ts); without it everything is computed. */
export function projectClubState(s:State,a:Account,period:string,year:number,now=Date.now(),shared?:{revision:number;consumeState?:boolean;activityId?:string}){
 const activityId=shared?.activityId;
 // The GET handler owns its parsed snapshot and discards it after projection. Other callers retain copy semantics.
 if(!shared?.consumeState)s=structuredClone(s);for(const e of s.events){e.status=eventStatusAt(e,now);if(e.livePlay)e.livePlay={...e.livePlay,rest:e.livePlay.rest.filter(r=>r.reason!=='win-limit')}}enableDefaultAttendance(s,now);const actualAttendance=s.attendance;applyDefaultAttendance(s);
 const admin=a.role==='admin',history={...s},ownerId=clubOwnerId(s),ownerPlayerId=clubOwnerPlayerId(s);
 if(!admin)s.events=s.events.filter(e=>e.status!=='draft'||e.creatorId===a.id);
 const historicalIds=new Set(s.events.map(e=>e.id));
 const eventCollections=['bookings','registrations','attendance','rounds','matches','costs','settlements','payments','awardVotes'] as const;
 for(const key of eventCollections)(s[key] as unknown[])=s[key].filter(row=>historicalIds.has(row.eventId));
 // Deletion hides an activity's workspace; completed results stay historical facts.
 // Realms, 修为 and strength labels settle per activity, while ranking points stay live.
 const guests=guestIds(history);
 const quarter=rankingQuarter(period);
 const computeShared=()=>{const ledger=shared?sharedRealmLedger(history,now):realmLedger(history,now);return {ledger,monthly:activityId?[]:leaderboard(history,period,now,ledger),quarterly:activityId?[]:quarterlyLeaderboard(history,quarter,now,ledger),annual:activityId?[]:annualLeaderboard(history,year,now,ledger),singlesQuarterly:activityId?[]:singlesQuarterlyLeaderboard(history,quarter,now,ledger),singlesAnnual:activityId?[]:singlesAnnualLeaderboard(history,year,now,ledger),socialParts:activityId?{stats:[],funny:[],annual:[]}:socialHistoryParts(history,period,year,ledger.snapshot)}};
 const {ledger,monthly,quarterly,annual,singlesQuarterly,singlesAnnual,socialParts}=shared?sharedClubValue((activityId?'activity|':'')+shared.revision+'|'+period+'|'+year,now,()=>sharedViewValidUntil(history,now),computeShared):computeShared();
 const historicalMatches=new Map(history.matches.map(m=>[m.id,m]));
 const visibleHistory=new Set(history.events.filter(e=>admin||e.status!=='draft'||e.creatorId===a.id).map(e=>e.id));
 const knownEvents=new Set(history.events.map(e=>e.id));
 const streakGames=ledger.games.filter(g=>!knownEvents.has(g.eventId)||visibleHistory.has(g.eventId));
 // Achievements and avatar streaks depend only on which drafts this viewer may see: members without drafts of their
 // own all share one result per revision.
 const visibility=admin?'admin':'drafts:'+history.events.filter(e=>e.status==='draft'&&e.creatorId===a.id).map(e=>e.id).sort().join(',');
 const computeVisible=()=>({achievements:achievementSnapshot({...history,events:s.events,matches:s.matches},now),avatarStreaks:activeAvatarStreaks(streakGames,historicalMatches,rankingQuarter(month(now)))});
 const {achievements,avatarStreaks}=shared?sharedClubValue(shared.revision+'|'+visibility,now,()=>sharedViewValidUntil(history,now),computeVisible):computeVisible();
 // Bond facts depend on stored history, not the viewer. Selection and admin access stay in bondView per request.
 const bonds=shared?sharedClubValue('bonds|'+shared.revision,now,()=>sharedViewValidUntil(history,now),()=>bondHistory(history)):undefined;
 const noStreak={singles:0,doubles:0};
 const members=new Set(history.accounts.map(account=>account.playerId));
 // Normal screens never consume a per-game rating replay. The explicit history preview still returns it,
 // and authorized exports retain all stored history. Keep the field for older client contracts.
 const ratingHistory=[] as State['ratingChanges'];
 const mergedEventTargets=Object.fromEntries(s.events.filter(e=>e.deletedAt!==undefined&&e.mergedInto&&s.events.some(t=>t.id===e.mergedInto&&t.deletedAt===undefined)).map(e=>[e.id,e.mergedInto]));
 const deletedEvents=s.events.filter(e=>e.deletedAt!==undefined&&canRecoverEvent(s,a,e)).map(e=>({id:e.id,title:e.title,start:e.start,end:e.end,deletedAt:e.deletedAt,...(e.mergedInto?{mergedInto:e.mergedInto}:{})}));
 s.events=s.events.filter(e=>e.deletedAt===undefined);
 const ids=new Set(s.events.map(e=>e.id));
 for(const key of eventCollections)(s[key] as unknown[])=s[key].filter(row=>ids.has(row.eventId));
 if(activityId){
  s.events=s.events.filter(e=>e.id===activityId);
  // Keep visible, currently occupied courts outside this activity so live substitutions cannot select busy players.
  // No unrelated historical match, audit or fee collection enters the activity response.
  for(const key of eventCollections)if(key!=='matches')(s[key] as unknown[])=s[key].filter(row=>row.eventId===activityId);
  s.matches=s.matches.filter(m=>m.eventId===activityId||m.status==='playing');
 }
 const workspaceIds=new Set(s.events.map(e=>e.id));
 const matchIds=new Set(s.matches.map(m=>m.id));
 // Members never see a realm during placement: rows and stats carry only the settled count and 修为 then.
 const realmView=(realm:RealmSnapshot)=>realm.placement?null:realm.realm;
 const board=<T extends {rating:number;realm:string;realmScore:RealmSnapshot}>(rows:T[])=>rows.map(r=>({...r,rating:admin?r.rating:null,realm:realmView(r.realmScore),realmScore:visibleRealm(r.realmScore)}));
 const fullSocial=socialSnapshot(s,period,year,now,history,ledger.snapshot,socialParts);
 const permanent=new Set(history.players.filter(p=>!guests.has(p.id)).map(p=>p.id));
 const social={...fullSocial,funny:fullSocial.funny.filter(st=>permanent.has(st.playerId)),personality:fullSocial.personality.filter(st=>permanent.has(st.playerId)),annual:fullSocial.annual.filter(st=>permanent.has(st.playerId)),stats:fullSocial.stats.filter(st=>permanent.has(st.playerId)).map(st=>({...st,tier:realmView(st.realmScore),realmScore:visibleRealm(st.realmScore)}))};
 const drafts=s.events.filter(e=>admin||e.creatorId===a.id).map(e=>calculateSettlementPreview({...s,attendance:actualAttendance},e,now));
 return maskClubContent({
  ...(activityId?{activityScope:activityId}:{}),
  revision:s.revision,settings:{name:s.settings.name,rules:s.settings.rules,bounty:bountySettings(s),feePayees:(s.settings.feePayees??[]).map(({id,name,phone,createdBy,playerId})=>({id,name,phone,mine:createdBy===a.id,...(playerId?{playerId}:{})})),...(admin?{blockedWords:s.settings.blockedWords??[]}:{}),...(pairingOddsView(history,a,now)?{pairingOdds:pairingOddsView(history,a,now)}:{})},me:{...a,giftNotices:giftNotices(history,a,now),bonusNotices:bonusNotices(history,a,now),isOwner:isClubOwner(s,a)},permissions:{canManageRoles:admin&&isClubOwner(s,a),canManageBlockedWords:admin,canUseSimulation:canUseSimulation(a)},
  players:s.players.filter(p=>!p.guestEventId||ids.has(p.guestEventId)).map(p=>({...p,winningStreak:p.enabled&&members.has(p.id)?avatarStreaks.get(p.id)?.winningStreak??noStreak:noStreak,losingStreak:p.enabled&&members.has(p.id)?avatarStreaks.get(p.id)?.losingStreak??noStreak:noStreak,...(guests.has(p.id)?{guest:true,guestHost:guestHostName(s,p.id)??'球友',guestHostId:guestHostPlayerId(s,p.id),guestLevel:guestLevelAt(p)}:{}),profileEditMode:profileEditMode(s,p.id,a),protectedOwner:p.id===ownerPlayerId,...(p.profile?{profile:Object.fromEntries(Object.entries(p.profile).filter(([key])=>!hiddenProfileKeys.includes(key)))}:{}),...(!admin?{rating:null,initialRating:null,ratingReason:''}:{}),ownerId:p.ownerId===a.id?a.id:''})),
  events:s.events.map(e=>({...e,canViewCourtOccupancy:!!e.creatorId&&e.creatorId===a.id,mapUrl:googleMapsUrl(e.venue,e.address),
   // Bounty answers are private: each member sees their own (with its result once settled); administrators see all.
   ...(e.bounties?{bounties:e.bounties.filter(b=>admin||b.playerId===a.playerId).map(b=>({...b,outcome:bountyOutcome(s,e,b,now,b.kind==='upset'?ledger.byPlayer.get(b.playerId)??[]:undefined)}))}:{}),...(e.pointsChoice?{pointsChoice:{...e.pointsChoice,votes:e.pointsChoice.votes.map(v=>({...v,voterId:v.voterId===a.id?a.id:''}))}}:{}),...(e.shuttlePlan?{shuttlePlan:{...e.shuttlePlan,votes:e.shuttlePlan.votes.map(v=>({...v,voterId:v.voterId===a.id?a.id:''}))}}:{})})),deletedEvents,mergedEventTargets,bookings:s.bookings.map(b=>{const e=s.events.find(e=>e.id===b.eventId);return {...b,mapUrl:googleMapsUrl(b.venue??e?.venue??'',b.address??e?.address??'')}}),registrations:s.registrations.map(({cancelledAt:_at,cancelledBy:_by,cancelledAs:_as,cancelReason:_reason,noticeAcknowledgements:_notice,...r})=>{const notice=visibleActivityAcknowledgements(history,a,{...r,noticeAcknowledgements:_notice}),cancellation=cancellationView(history,{...r,cancelledAt:_at,cancelledBy:_by,cancelledAs:_as,cancelReason:_reason});return {...r,...(notice?.length?{noticeAcknowledgements:notice}:{}),...(cancellation?{cancellation}:{})}}),attendance:s.attendance,rounds:s.rounds,matches:s.matches.map(m=>withScorer(s,m)),costs:s.costs,seasons:s.seasons,
  // Compatibility for tabs opened before deployment; no monthly board is shown.
  leaderboard:board(monthly),quarterlyLeaderboard:board(quarterly),rankingQuarter:quarter,annualLeaderboard:board(annual),rankingYear:year,period,
  singlesQuarterlyLeaderboard:board(singlesQuarterly),singlesAnnualLeaderboard:board(singlesAnnual),
  social,
  pointGrants:!activityId&&isClubOwner(s,a)?pointGrants(s):[],
  treasureShop:treasureShopView(s,a),
  bonds:bondView(history,a,undefined,bonds),
  achievements:activityId?Object.fromEntries(Object.entries(achievements).filter(([id])=>id===a.playerId)):achievements,
  challenges:s.challenges.filter(c=>matchIds.has(c.sourceMatchId)&&(!c.matchId||matchIds.has(c.matchId))),
  tagVotes:[] as State['tagVotes'],awardVotes:s.awardVotes.filter(v=>v.category==='mvp').map((v,i)=>{const event=s.events.find(e=>e.id===v.eventId),voter=event&&(a.role==='admin'||isClubOwner(s,a))?s.accounts.find(x=>x.id===v.voterId):undefined;return {...v,id:v.voterId===a.id?v.id:'award:'+v.eventId+':mvp:'+i,voterId:v.voterId===a.id?a.id:'',...(voter?{voterPlayerId:voter.playerId}:{})}}),
  photos:s.photos.filter(p=>(p.kind==='avatar'||p.kind==='racket')||workspaceIds.has(p.eventId??'')).map(({key,...p})=>({...p,canDelete:canDeletePhoto(s,a,{key,...p})})),
  rotationPlans:Object.fromEntries(s.events.map(e=>[e.id,rotationPlan(s,e,now)])),settlements:s.settlements.map(x=>({...x,bills:x.bills,detail:x.detail})),
  // Only what paid status needs: who, for which activity, how much.
  payments:s.payments.map(({eventId,playerId,cents,to})=>({eventId,playerId,cents,...(to?{to}:{})})),
  audits:admin&&!activityId?privateEventState(history,a).audits.slice(-50):[],accounts:admin?s.accounts.map(account=>({...account,isOwner:account.id===ownerId,canEditProfileName:profileEditMode(s,account.playerId,a)==='full',canModify:account.id!==ownerId||isClubOwner(s,a)})):[],drafts,ratingHistory,
 },s.settings.blockedWords??[]);
}
