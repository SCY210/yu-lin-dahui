export type Account={id:string;email:string;role:'admin'|'member';playerId:string};
export type Player={id:string;name:string;ownerId:string;initialRating:number;rating:number;ratedGames:number;enabled:boolean;ratingReason:string};
export type Event={id:string;title:string;start:number;end:number;venue:string;address:string;capacity:number;signupDeadline:number;cancelDeadline:number;note:string;status:'draft'|'open'|'locked'|'live'|'ended'|'cancelled';courtMode:Mode;ballMode:Mode};
export type Booking={id:string;eventId:string;name:string;start:number;end:number;pricing:'hourly'|'total';cents:number;bearer?:'members'|'subsidy'};
export type Registration={id:string;eventId:string;playerId:string;sequence:number;status:'confirmed'|'waitlist'|'cancelled';arrival:number;departure:number;note:string;cancelRequested:boolean;courtExempt:Exemption;ballExempt:Exemption};
export type Exemption={mode:'none'|'redistribute'|'subsidy';reason:string};
export type Attendance={id:string;eventId:string;playerId:string;start:number;end:number|null;state:'ready'|'paused'|'left'};
export type Round={id:string;eventId:string;start:number;duration:number;status:'draft'|'published'|'playing'|'complete'|'cancelled';eligible:string[];rest:string[];seed:number};
export type Match={id:string;eventId:string;roundId:string;courtId:string;a:string[];b:string[];status:'draft'|'published'|'playing'|'complete'|'cancelled'|'forfeit';start:number|null;end:number|null;scoreA:number|null;scoreB:number|null;monthly:boolean;elo:boolean;locked:boolean;enteredBy:string|null;games:{a:number;b:number}[]};
export type Mode='equal'|'duration'|'interval';
export type Cost={id:string;eventId:string;type:'ball'|'other';name:string;pricing:'tube'|'unit'|'total';cents:number;tubeCount:number;used:number;start:number|null;end:number|null;bearer:'members'|'subsidy';overrides?:{start:number;end:number;cents:number}[]};
export type Bill={playerId:string;court:number;ball:number;other:number;total:number;minutes:number};
export type Settlement={id:string;eventId:string;version:number;created:number;reason:string;confirmed:boolean;total:number;subsidy:number;unallocated:number;bills:Bill[];detail:{name:string;start:number;end:number;cents:number;shares:Record<string,number>;subsidy:number;unallocated:number;estimated:boolean}[]};
export type Payment={id:string;eventId:string;playerId:string;cents:number;method:string;at:number;reason:string;actor:string};
export type Rules={win:number;loss:number;minimum:number;cap:number;target:number;ceiling:number;lead:number;k:number;algorithm:string};
export type Season={id:string;rules:Rules;version?:number};
export type RatingChange={id:string;matchId:string;playerId:string;before:number;after:number;delta:number;algorithm:string;k:number};
export type Audit={id:string;at:number;actor:string;action:string;reason:string;changes?:unknown};
export type Settings={name:string;inviteHash:string;rules:Rules;initialized:boolean};
export type State={revision:number;settings:Settings;accounts:Account[];players:Player[];events:Event[];bookings:Booking[];registrations:Registration[];attendance:Attendance[];rounds:Round[];matches:Match[];costs:Cost[];settlements:Settlement[];payments:Payment[];seasons:Season[];audits:Audit[];ratingChanges:RatingChange[]};
export const defaultRules:Rules={win:3,loss:0,minimum:6,cap:12,target:21,ceiling:30,lead:2,k:32,algorithm:'doubles-elo-v1'};
export function emptyState():State{return {revision:0,settings:{name:'羽球局',inviteHash:'',rules:{...defaultRules},initialized:false},accounts:[],players:[],events:[],bookings:[],registrations:[],attendance:[],rounds:[],matches:[],costs:[],settlements:[],payments:[],seasons:[],audits:[],ratingChanges:[]};}
export function fail(message:string):never{throw new Error(message)}
export function month(t:number){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).formatToParts(t);return `${p.find(x=>x.type==='year')!.value}-${p.find(x=>x.type==='month')!.value}`}
