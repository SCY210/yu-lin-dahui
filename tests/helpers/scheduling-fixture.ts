import {emptyState} from '../../lib/domain/types';
import {realmPolicy} from '../../lib/domain/realm-rating';

/** Test-only fictional club graph, never imported by production code or persisted remotely. */
export function createSimulation(now:number){
 const s=emptyState(),start=Math.floor(now/1800000)*1800000,end=start+6*3600000;
 s.settings.initialized=true;s.settings.name='排场测试';s.settings.ownerAccountId='sim-admin';
 for(let i=0;i<12;i++){
  const id='sim-player-'+(i+1),account=i?'sim-account-'+(i+1):'sim-admin',rating=realmPolicy.start;
  s.accounts.push({id:account,email:'',role:i?'member':'admin',playerId:id});
  s.players.push({id,name:'模拟球友 '+String(i+1).padStart(2,'0'),ownerId:account,enabled:true,initialRating:rating,rating,ratedGames:0,ratingReason:''});
 }
 const e={id:'sim-event',creatorId:'sim-admin',title:'虚构排场测试',matchFormat:'doubles' as const,schedulingMode:'live' as const,start,end,venue:'模拟球馆',address:'',capacity:s.players.length,signupDeadline:end,cancelDeadline:start-86400000,note:'仅本地测试数据',status:'open' as const,attendanceMode:'automatic' as const,courtMode:'interval' as const,ballMode:'interval' as const};
 s.events=[e];s.bookings=[1,2].map(i=>({id:'sim-court-'+i,eventId:e.id,name:'模拟 '+i+' 号场',start,end,pricing:'hourly',cents:690,signupCapacity:s.players.length}));
 s.registrations=s.players.map((p,i)=>({id:'sim-registration-'+(i+1),eventId:e.id,playerId:p.id,sequence:i+1,status:'confirmed',arrival:start,departure:end,registeredAt:start,note:'模拟接龙',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 return {version:2 as const,revision:0,state:s,requests:[] as string[]};
}
