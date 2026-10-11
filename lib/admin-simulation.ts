import {apply} from './domain/commands';
import {emptyState,month,fail,type State} from './domain/types';
import {projectClubState} from './club-view';
import type {ClubData} from './contracts/club';
import {pendingSchedulingIds,schedulingMode} from './domain/scheduling';
export const simulationKey='admin-simulation-v1';
export type SimulationDocument={version:1;revision:number;state:State;requests:string[]};
export type SimulationView={revision:number;data:ClubData};
const commands=new Set(['pointsStart','pointsLate','pointsPresence','pointsReplace','liveStart','livePause','livePreference','liveReady','liveLineup','schedulingMode','planPoints','publishPoints','pointsModeVote','pointsModeVoting','pointsModeSelect','generate','publish','start','swap','lock','moveCourt','cancelRound','score','void','matchScoring','playSettings','handicap']);
/** A separate, persisted sandbox. No real member or activity enters this graph. */
export function createSimulation(now:number):SimulationDocument{
 const s=emptyState(),start=Math.floor(now/1800000)*1800000,end=start+6*3600000;
 s.settings.initialized=true;s.settings.name='排场模拟活动';s.settings.ownerAccountId='sim-admin';
 for(let i=0;i<12;i++){
  const id='sim-player-'+(i+1),account=i?'sim-account-'+(i+1):'sim-admin';
  s.accounts.push({id:account,email:'',role:i?'member':'admin',playerId:id});
  s.players.push({id,name:'模拟球友 '+String(i+1).padStart(2,'0'),ownerId:account,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
 }
 const e={id:'sim-event',creatorId:'sim-admin',title:'模拟活动 · 12人 / 两场地',matchFormat:'doubles' as const,schedulingMode:'live' as const,start,end,venue:'模拟球馆',address:'',capacity:12,signupDeadline:end,cancelDeadline:start-86400000,note:'管理员专用排场模拟，全部是虚拟球友。',status:'open' as const,attendanceMode:'automatic' as const,courtMode:'interval' as const,ballMode:'interval' as const};
 s.events=[e];s.bookings=[1,2].map(i=>({id:'sim-court-'+i,eventId:e.id,name:'模拟 '+i+' 号场',start,end,pricing:'hourly',cents:690,signupCapacity:12}));
 s.registrations=s.players.map((p,i)=>({id:'sim-registration-'+(i+1),eventId:e.id,playerId:p.id,sequence:i+1,status:'confirmed',arrival:start,departure:end,registeredAt:start,note:'模拟接龙',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 return {version:1,revision:0,state:s,requests:[]};
}
export function simulationView(doc:SimulationDocument,now:number):SimulationView{
 const a=doc.state.accounts[0];return {revision:doc.revision,data:{...projectClubState(doc.state,a,month(now),new Date(now).getUTCFullYear(),now),loginAccounts:[],auth:{method:'password',username:null,passwordEnabled:false,isOwner:true,canChangeUsername:false,usernameChangedAt:null}}};
}
export async function changeSimulation(doc:SimulationDocument,action:string,payload:unknown,requestId:string,now:number){
 if(action!=='reset'&&action!=='preplan'&&!commands.has(action))fail('模拟空间只允许排场、到场确认和比分操作');
 const next=action==='reset'?createSimulation(now):structuredClone(doc),s=next.state,a=s.accounts[0],e=s.events[0];
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
