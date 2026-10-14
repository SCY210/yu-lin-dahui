import {emptyState,type Event,type Match,type Registration,type State} from '../../lib/domain/types';

export const coinEpoch=Date.UTC(2035,0,3,12);
export function coinFixture():State{
 const s=emptyState();
 Object.assign(s.settings,{initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',rankedEventsVersion:'admins-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=Array.from({length:8},(_,i)=>({id:i?'member'+i:'owner',email:'',role:i?'member' as const:'admin' as const,playerId:'p'+i}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 return s;
}
export function coinEvent(s:State,id:string,end=coinEpoch+60000,fields:Partial<Event>={}):Event{
 const e:Event={id,creatorId:'owner',title:'Fictional '+id,start:end-3600000,end,venue:'Fictional court',address:'',capacity:8,signupDeadline:end-7200000,cancelDeadline:end-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal',ranked:true,...fields};
 s.events.push(e);s.bookings.push({id:id+'-court',eventId:id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:0});
 return e;
}
export function coinSignup(s:State,e:Event,playerId:string,fields:Partial<Registration>={}):Registration{
 const r:Registration={id:e.id+'-'+playerId,eventId:e.id,playerId,sequence:s.registrations.length+1,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''},...fields};s.registrations.push(r);return r;
}
export function coinMatch(s:State,e:Event,id:string,fields:Partial<Match>={}):Match{
 const start=e.start+60000,end=start+900000,roundId=id+'-round';
 s.rounds.push({id:roundId,eventId:e.id,start,duration:15,status:'complete',eligible:['p0','p1','p2','p3'],rest:[],seed:1});
 const m:Match={id,eventId:e.id,roundId,courtId:e.id+'-court',a:['p0','p1'],b:['p2','p3'],status:'complete',start,end,scoreA:21,scoreB:19,games:[{a:21,b:19}],monthly:true,elo:true,locked:false,enteredBy:'owner',...fields};s.matches.push(m);return m;
}
