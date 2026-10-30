import {apply} from './domain/commands';
import {emptyState,month,fail,type State} from './domain/types';
import {projectClubState} from './club-view';
import type {ClubData} from './contracts/club';
import {pendingSchedulingIds,schedulingMode} from './domain/scheduling';
import {realmSnapshot,realmPolicy} from './domain/realm-rating';
import type {PairingOdds} from './domain/pairing-odds';
export const simulationKey='admin-simulation-v1';
/** sources: the real member behind each sandbox player, so production pairing odds can be carried over. */
export type SimulationDocument={version:1|2;revision:number;state:State;requests:string[];sources?:Record<string,string>};
export type SimulationView={revision:number;data:ClubData};
const commands=new Set(['eventRanking','pointsParticipation','noShow','noShowArrived','pointsStart','pointsLate','pointsPresence','pointsReplace','liveStart','livePause','livePreference','liveReady','liveLineup','liveSwap','liveNext','schedulingMode','pointsNext','planPoints','publishPoints','pointsModeVote','pointsModeVoting','pointsModeSelect','generate','publish','start','swap','moveCourt','cancelRound','score','void','matchScoring','playSettings','handicap']);
/** Copy member display/strength snapshots into a closed graph with sandbox-only IDs. */
/** limit: how many members to copy (twelve for an activity, sixteen for a competition). */
export function createSimulation(now:number,club?:State,limit=12):SimulationDocument{
 const s=emptyState(),start=Math.floor(now/1800000)*1800000,end=start+6*3600000;
 s.settings.initialized=true;s.settings.name='排场模拟活动';s.settings.ownerAccountId='sim-admin';
 const memberIds=new Set(club?.accounts.map(a=>a.playerId)),members=club?.players.filter(p=>p.enabled&&memberIds.has(p.id)).slice(0,limit),ratings=club?realmSnapshot(club,now):null;
 if(members&&!members.length)fail('暂无可用于模拟的真实球友');
 if(club)s.settings.rules=structuredClone(club.settings.rules);
 for(let i=0;i<(members?.length??limit);i++){
  const id='sim-player-'+(i+1),account=i?'sim-account-'+(i+1):'sim-admin';
  const source=members?.[i],rating=source?ratings!.get(source.id)!.score:realmPolicy.start;
  s.accounts.push({id:account,email:'',role:i?'member':'admin',playerId:id});
  s.players.push({id,name:source?.name??'模拟球友 '+String(i+1).padStart(2,'0'),ownerId:account,enabled:true,initialRating:rating,rating,ratedGames:0,ratingReason:'',...(source?.avatarId?{avatarId:source.avatarId}:{}),...(source?.profile?{profile:{gender:source.profile.gender,years:0,hand:'right',preference:'all',style:'',equipment:''}}:{})});
  // The existing replay derives strength from its own ledger, not mutable player.rating.
  // Rating-only chunks seed that ledger without copying historical games or season points.
  let remaining=rating-realmPolicy.start,part=0;while(remaining){const delta=Math.sign(remaining)*Math.min(300,Math.abs(remaining));s.audits.push({id:'sim-rating-'+(i+1)+'-'+part++,actor:'sim-admin',action:'grantPoints',reason:'模拟修为快照',at:now-1,changes:{playerId:id,period:month(now),points:0,rating:delta,reason:'模拟修为快照'}});remaining-=delta}
 }
 const e={id:'sim-event',creatorId:'sim-admin',title:'模拟活动 · '+s.players.length+'人 / 两场地',matchFormat:'doubles' as const,schedulingMode:'live' as const,start,end,venue:'模拟球馆',address:'',capacity:s.players.length,signupDeadline:end,cancelDeadline:start-86400000,note:'管理员专用排场模拟，使用真实球友资料快照。',status:'open' as const,attendanceMode:'automatic' as const,courtMode:'interval' as const,ballMode:'interval' as const};
 s.events=[e];s.bookings=[1,2].map(i=>({id:'sim-court-'+i,eventId:e.id,name:'模拟 '+i+' 号场',start,end,pricing:'hourly',cents:690,signupCapacity:s.players.length}));
 s.registrations=s.players.map((p,i)=>({id:'sim-registration-'+(i+1),eventId:e.id,playerId:p.id,sequence:i+1,status:'confirmed',arrival:start,departure:end,registeredAt:start,note:'模拟接龙',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 const doc:SimulationDocument={version:2,revision:0,state:s,requests:[],...(members?{sources:Object.fromEntries(members.map((p,i)=>['sim-player-'+(i+1),p.id]))}:{})};
 if(club)syncPairingOdds(doc,club,now);
 return doc;
}
/** Scheduling in the sandbox must match production: it uses the current pairing odds of the next real activity that
 * has any (docs/PAIRING_ODDS.md), on the sandbox players behind the same members. Members outside the sandbox drop out
 * of the rules. The rules themselves never reach the simulation view. */
export function syncPairingOdds(doc:SimulationDocument,club:Pick<State,'events'|'settings'>,now:number){
 const s=doc.state,toSim=new Map(Object.entries(doc.sources??{}).map(([sim,real])=>[real,sim]));
 const next=club.events.filter(e=>e.deletedAt===undefined&&e.end>now&&!['ended','cancelled'].includes(e.status)&&club.settings.pairingOdds?.some(o=>o.eventId===e.id)).sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id))[0];
 const odds=next&&club.settings.pairingOdds!.find(o=>o.eventId===next.id)!;
 const map=(ids:string[])=>ids.flatMap(id=>toSim.has(id)?[toSim.get(id)!]:[]);
 const mapped:PairingOdds|undefined=odds&&{eventId:s.events[0].id,
  defaults:odds.defaults.map(d=>({...d,players:map(d.players),targets:map(d.targets)})).filter(d=>d.players.length&&d.targets.length),
  conditions:odds.conditions.flatMap(c=>{const pair=map(c.pair),members=map(c.members);return pair.length===2&&members.length?[{...c,pair:pair as [string,string],members}]:[]})};
 if(mapped&&(mapped.defaults.length||mapped.conditions.length))s.settings.pairingOdds=[mapped];else delete s.settings.pairingOdds;
}
export function simulationView(doc:SimulationDocument,now:number):SimulationView{
 const a=doc.state.accounts[0],data=projectClubState(doc.state,a,month(now),new Date(now).getUTCFullYear(),now);
 // Testers open the sandbox too: they never receive pairing odds.
 const settings:typeof data.settings&{pairingOdds?:unknown}={...data.settings};delete settings.pairingOdds;
 return {revision:doc.revision,data:{...data,settings,accountNotice:{required:false,currentVersion:'local-preview',contentHash:'',acceptedAt:null,acceptedVersion:null,currentConfirmed:false,receipts:[]},loginAccounts:[],auth:{method:'password',username:null,passwordEnabled:false,isOwner:true,canChangeUsername:false,usernameChangedAt:null}}};
}
/** club: the full club, read only for a reset. odds: the club settings and the activities that have pairing odds. */
export async function changeSimulation(doc:SimulationDocument,action:string,payload:unknown,requestId:string,now:number,club?:State,odds?:Pick<State,'events'|'settings'>){
 if(action!=='reset'&&action!=='preplan'&&!commands.has(action))fail('模拟空间只允许排场、到场确认和比分操作');
 const next=action==='reset'?createSimulation(now,club??doc.state):structuredClone(doc),s=next.state,a=s.accounts[0],e=s.events[0];
 if(action!=='reset'&&(odds??club))syncPairingOdds(next,(odds??club)!,now);
 if(action!=='reset'){
  if(now>=e.end)fail('模拟活动已过期，请重置模拟活动后再测试');
  if(s.matches.length>500)fail('模拟记录过多，请重置模拟活动');
  if(action==='preplan'){
   if(s.matches.some(m=>m.status==='playing'))fail('请先录完当前两场比分，或重置模拟活动，再预排赛程');
   const mode=schedulingMode(s,e);if(mode!=='planned')await apply(s,a,'schedulingMode',{eventId:e.id,mode:'planned',expectedMode:mode,expectedPendingIds:pendingSchedulingIds(s,e.id)},now);
   await apply(s,a,'planPoints',{eventId:e.id,at:now,pointsMinutes:90,roundMinutes:15,seed:1,pairing:e.pointsChoice?.selectedMode??'rotate'},now);
  }else await apply(s,a,action,payload,now);
 }
 next.revision=doc.revision+1;s.revision=next.revision;next.requests=[...doc.requests,requestId].slice(-100);
 return next;
}
