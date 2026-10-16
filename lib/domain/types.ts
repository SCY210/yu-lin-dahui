import type {PointsSession} from './points-attendance';
import type {Tournament} from './tournament';
export type Account={id:string;email:string;role:'admin'|'member';playerId:string;/** Sandbox-only permission; never grants real administrator authority. */simulationTester?:boolean;/** Extra-point notices already acknowledged (lib/domain/bonus-notices.ts). */bonusSeen?:string[]};
import type {ProfileGender} from '../player-profile-options';
/** cultivationBase: legacy weekly-v2 offset, retained but no longer used. */
/** guestEventId identifies a minimal activity participant, never a reusable member profile. */
export type Player={guestEventId?:string;guestGender?:'male'|'female';guestLevels?:{at:number;level:number}[];cultivationBase?:number;id:string;name:string;ownerId:string;initialRating:number;rating:number;ratedGames:number;enabled:boolean;ratingReason:string;avatarId?:string;profile?:{gender?:ProfileGender;years:number;hand:'right'|'left'|'both';preference:'doubles'|'singles'|'mixed'|'all';style:string;equipment:string;racket?:string;strings?:string;tension?:string;tensionMin?:number|null;tensionMax?:number|null;grip?:string;shoes?:string;motto?:string}};

export type ShuttleOption={id:string;name:string;note:string};
export type ShuttleVote={id:string;voterId:string;playerId:string;optionId:string;at:number};
export type ShuttlePlan={options:ShuttleOption[];votes:ShuttleVote[];votingOpen:boolean;selectedId?:string};
export type PointsChoice={votes:{id:string;voterId:string;playerId:string;mode:'rotate'|'fixed';at:number}[];votingOpen:boolean;selectedMode?:'rotate'|'fixed';teams?:string[][]};
export type PointsPlan={start:number;end:number;roundMinutes:number;seed?:number;generatedAt?:number};
export type LivePlay={enabled:boolean;paused:boolean;preferences:{playerId:string;avoidConsecutive:boolean}[];completions:{venue:string;count:number}[];rest:{playerId:string;venue:string;after:number}[]};
export type Event={ranked?:boolean;matchingStopped?:string[];noShowHold?:string[];pointsSession?:PointsSession;tournament?:Tournament;schedulingMode?:'planned'|'round'|'live';automaticTitle?:boolean;matchFormat?:'singles'|'doubles'|'practice';practiceShuttleCents?:number;feeAdvances?:boolean;feeRecipient?:{name:string;phone:string;playerId?:string};livePlay?:LivePlay;pointsChoice?:PointsChoice;pointsPlan?:PointsPlan;shuttlePlan?:ShuttlePlan;id:string;title:string;start:number;end:number;venue:string;address:string;capacity:number;signupDeadline:number;cancelDeadline:number;note:string;status:'draft'|'open'|'locked'|'live'|'ended'|'cancelled';courtMode:Mode;ballMode:Mode;creatorId?:string;deletedAt?:number;deletedBy?:string;mergedInto?:string;attendanceMode?:'automatic'|'manual';playMode?:'balanced'|'arena'|'koc';identityMode?:'off'|'cp'|'mentor'|'carry';arenaCourtId?:string;handicap?:boolean};
/** advancedBy: the member who booked and paid for the court slot (docs/FEE_ADVANCES.md). */
export type Booking={advancedBy?:string;id:string;eventId:string;name:string;start:number;end:number;pricing:'hourly'|'total';cents:number;bearer?:'members'|'subsidy';signupCapacity?:number;venue?:string;address?:string};
export type BookingSignup={bookingId:string;status:'confirmed'|'waitlist'|'cancelled';sequence:number;arrival:number;departure:number;note:string;cancelRequested:boolean;registeredAt:number;joinedAsWaitlist:boolean;promotedAt?:number};
export type AccountNoticeReceipt={id:string;accountId:string;playerId:string;version:string;contentHash:string;contentSnapshot:string;acceptedAt:number;method:'explicit-account-confirmation'};
export type ActivityAcknowledgement={id:string;eventId:string;bookingId?:string;playerId:string;version:string;at:number;actorId:string;kind:'self'|'proxy'};
export type Registration={noticeAcknowledgements?:ActivityAcknowledgement[];/** Set when the signup became fully cancelled: time, account and the reason typed (see lib/domain/cancellations.ts). */cancelledAt?:number;cancelledBy?:string;cancelledAs?:'self'|'registrant'|'organizer';cancelReason?:string;id:string;eventId:string;playerId:string;sequence:number;status:'confirmed'|'waitlist'|'cancelled';arrival:number;departure:number;note:string;cancelRequested:boolean;courtExempt:Exemption;ballExempt:Exemption;registeredAt?:number;joinedAsWaitlist?:boolean;promotedAt?:number;bookingSignups?:BookingSignup[]};
export type Exemption={mode:'none'|'redistribute'|'subsidy';reason:string};
export type Attendance={id:string;eventId:string;playerId:string;start:number;end:number|null;state:'ready'|'paused'|'left';source?:'automatic';bookingId?:string};
export type Round={live?:boolean;liveSequence?:number;pointsSlot?:number;id:string;eventId:string;start:number;duration:number;status:'draft'|'published'|'playing'|'complete'|'cancelled';eligible:string[];rest:string[];seed:number};
export type Match={earlyScoreAt?:number;noShow?:string[];id:string;eventId:string;roundId:string;courtId:string;a:string[];b:string[];status:'draft'|'published'|'playing'|'complete'|'cancelled'|'forfeit';start:number|null;end:number|null;scoreA:number|null;scoreB:number|null;monthly:boolean;elo:boolean;locked:boolean;enteredBy:string|null;games:{a:number;b:number}[];playMode?:'balanced'|'arena'|'koc';identity?:{playerId:string;label:string}[];handicap?:{side:'a'|'b';points:number;applied:boolean}};
export type Challenge={id:string;challengerId:string;targetId:string;sourceMatchId:string;created:number;status:'pending'|'accepted'|'declined'|'cancelled';matchId:string|null};
export type TagVote={eventId?:string;id:string;voterId:string;playerId:string;tag:string;at:number};
export type AwardVote={id:string;eventId:string;voterId:string;playerId:string;category:'mvp'|'defense'|'net'|'effort';at:number};
export type Photo={id:string;eventId:string|null;matchId:string|null;playerIds:string[];ownerId:string;caption:string;created:number;key:string;type:string;size:number;kind:'avatar'|'photo'|'racket'};
export type Mode='equal'|'duration'|'interval';
/** advancedBy: the member who bought the balls or paid the expense. */
export type Cost={advancedBy?:string;id:string;eventId:string;type:'ball'|'other';name:string;pricing:'tube'|'unit'|'total';cents:number;tubeCount:number;used:number;start:number|null;end:number|null;bearer:'members'|'subsidy';overrides?:{start:number;end:number;cents:number}[]};
export type Bill={playerId:string;court:number;ball:number;other:number;total:number;minutes:number};
export type Settlement={expenseTotal?:number;roundingDifference?:number;id:string;eventId:string;version:number;created:number;reason:string;confirmed:boolean;total:number;subsidy:number;unallocated:number;bills:Bill[];/** advances/transfers/collector: the fee-advance settlement of this version (lib/domain/fee-transfers.ts); absent
 * when some court or expense has no recorded advancer, in which case bills are paid as before. */
advances?:{playerId:string;cents:number}[];transfers?:{from:string;to:string;cents:number}[];collector?:string;
detail:{item?:string;type?:'court'|'ball'|'other';roundingDifference?:number;name:string;start:number;end:number;cents:number;shares:Record<string,number>;subsidy:number;unallocated:number;estimated:boolean}[]};
/** to: for a transfer between members (fee advances), the player who received it; playerId is the payer. */
export type Payment={to?:string;id:string;eventId:string;playerId:string;cents:number;method:string;at:number;reason:string;actor:string};
export type Rules={win:number;loss:number;minimum:number;cap:number;target:number;ceiling:number;lead:number;k:number;algorithm:string};
export type Season={id:string;rules:Rules;version?:number};
export type RatingChange={id:string;matchId:string;playerId:string;before:number;after:number;delta:number;algorithm:string;k:number};
export type Audit={id:string;at:number;actor:string;action:string;reason:string;changes?:unknown};
export type AutomaticCoinPolicy={version:'win-points-v1';activatedAt:number;excludedEventIds:string[]};
export type Settings={automaticCoins?:AutomaticCoinPolicy;rankedEventsVersion?:'admins-v1';name:string;inviteHash:string;rules:Rules;initialized:boolean;ownerAccountId?:string;blockedWords?:string[];progressionVersion?:'weekly-v2';realmVersion?:'elo-v1';rankingVersion?:'signed-v1';scoringPolicy?:'all-ranked-v1';strengthVersion?:'realm-elo-v2';feePayees?:FeePayee[]}
/** A saved transfer recipient, offered when setting an activity's fee recipient; newest use first. */
export type FeePayee={playerId?:string;id:string;name:string;phone:string;createdBy:string;usedAt:number};
export type ProfileRestrictions={genderOnlyPlayerIds:string[]};
export type TreasureProduct={id:string;name:string;description:string;price:number;stock:number;kind:'physical'|'digital';active:boolean;created:number;updated:number;version?:number};
export type TreasureLedger={id:string;playerId:string;delta:number;balance:number;sequence?:number;kind:'grant'|'redeem'|'refund'|'automatic_reward'|'automatic_correction';reason:string;actor:string;at:number;requestId:string;orderId?:string};
/** Reconciled reward entitlement, independent of spending and owner adjustments. Zero rows retain source history. */
export type TreasureRewardClaim={id:string;playerId:string;eventId:string;source:'participation'|'match_win';matchId?:string;gameIndex?:number;amount:number;updated:number};
export type TreasureOrder={id:string;playerId:string;accountId:string;productId:string;productName:string;kind:'physical'|'digital';price:number;quantity:number;total:number;status:'pending'|'fulfilled'|'cancelled';created:number;updated:number;requestId:string;handledBy?:string};
export type State={treasureRewardClaims:TreasureRewardClaim[];accountNoticeReceipts:AccountNoticeReceipt[];profileRestrictions?:ProfileRestrictions;revision:number;settings:Settings;accounts:Account[];players:Player[];events:Event[];bookings:Booking[];registrations:Registration[];attendance:Attendance[];rounds:Round[];matches:Match[];costs:Cost[];settlements:Settlement[];payments:Payment[];seasons:Season[];audits:Audit[];ratingChanges:RatingChange[];challenges:Challenge[];tagVotes:TagVote[];awardVotes:AwardVote[];photos:Photo[];treasureProducts:TreasureProduct[];treasureLedger:TreasureLedger[];treasureOrders:TreasureOrder[]};
export const defaultRules:Rules={win:10,loss:-3,minimum:0,cap:0,target:21,ceiling:30,lead:2,k:32,algorithm:'doubles-elo-v1'};
export function emptyState():State{return {treasureRewardClaims:[],accountNoticeReceipts:[],revision:0,settings:{name:'羽林大会',inviteHash:'',rules:{...defaultRules},initialized:false},accounts:[],players:[],events:[],bookings:[],registrations:[],attendance:[],rounds:[],matches:[],costs:[],settlements:[],payments:[],seasons:[],audits:[],ratingChanges:[],challenges:[],tagVotes:[],awardVotes:[],photos:[],treasureProducts:[],treasureLedger:[],treasureOrders:[]};}
export class DomainError extends Error{constructor(message:string){super(message);this.name='DomainError'}}
export function fail(message:string):never{throw new DomainError(message)}
const monthFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'});
/** Madrid changes month only at local midnight, and its UTC offset is a whole hour, so the month is constant within
 * any UTC hour. Caching by hour avoids a time-zone format per call (thousands per projection); results are identical. */
const monthByHour=new Map<number,string>();
export function month(t:number){
 const hour=Math.floor(t/3600000);let value=monthByHour.get(hour);
 if(value===undefined){const p=monthFormatter.formatToParts(t);value=`${p.find(x=>x.type==='year')!.value}-${p.find(x=>x.type==='month')!.value}`;if(monthByHour.size>=20000)monthByHour.clear();monthByHour.set(hour,value)}
 return value;
}
