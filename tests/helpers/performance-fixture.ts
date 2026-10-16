import {emptyState,type Event,type Match,type Registration} from '../../lib/domain/types';
import {strengthAlgorithm} from '../../lib/domain/ranking';
const hour=3600000,day=24*hour,base=Date.parse('2026-07-01T17:00:00Z');

/** A fictional club about the size of the real one: 22 players, two weekly activities of 14 players and 20 matches. */
export function club(weeks:number,members=22){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='p0';s.settings.strengthVersion=strengthAlgorithm;
 const ids=Array.from({length:members},(_,i)=>'p'+i);let seed=1;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 for(const id of ids){s.accounts.push({id,email:'',role:id==='p0'?'admin':'member',playerId:id});s.players.push({id,name:'球友'+id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})}
 for(let w=0;w<weeks;w++){
  const pool=[...ids].sort(()=>rnd()-.5).slice(0,14),start=base+w*3.5*day,end=start+3*hour,eventId='e'+w;
  s.events.push({id:eventId,creatorId:w%7===3?'p5':'p0',title:'活动'+w,matchFormat:'doubles',start,end,venue:'v',address:'',capacity:16,signupDeadline:start-2*hour,cancelDeadline:start-day,note:'',status:w%7===3?'draft':'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',ranked:true} as Event);
  s.bookings.push({id:'b'+w,eventId,name:'1号场',start,end,pricing:'total',cents:2000},{id:'c'+w,eventId,name:'2号场',start,end,pricing:'total',cents:2000});
  for(const id of pool)s.registrations.push({id:eventId+id,eventId,playerId:id,sequence:1,status:'confirmed',arrival:start,departure:end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}} as Registration);
  for(let r=0;r<10;r++){
   const roundId=eventId+'r'+r,at=start+r*15*60000;s.rounds.push({id:roundId,eventId,start:at,duration:15,status:'complete',eligible:pool,rest:[],seed:1});
   for(const court of ['b'+w,'c'+w]){
    const pick=[...pool].sort(()=>rnd()-.5).slice(0,4),won=rnd()>.5;
    s.matches.push({id:roundId+court,eventId,roundId,courtId:court,a:pick.slice(0,2),b:pick.slice(2),status:'complete',start:at,end:at+12*60000,scoreA:won?21:15,scoreB:won?15:21,games:[{a:won?21:15,b:won?15:21}],monthly:true,elo:true,locked:false,enteredBy:'p0'} as Match);
   }
  }
 }
 return {s,now:base+weeks*3.5*day};
}
