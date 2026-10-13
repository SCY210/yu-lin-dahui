import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {projectClubState} from '../lib/club-view';
import {emptyState,type Account,type Event} from '../lib/domain/types';

const hour=3600000,start=Date.parse('2027-05-08T15:00:00Z'),end=start+3*hour,at=start+hour;
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 const e:Event={id:'e',creatorId:'host',title:'周六双打',matchFormat:'doubles',start,end,venue:'球馆',address:'',capacity:8,signupDeadline:start-2*hour,cancelDeadline:start-24*hour,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events.push(e);
 for(const id of ['owner','host','a','b','c','d']){
  const account:Account={id,email:'',role:id==='owner'?'admin':'member',playerId:'p-'+id};s.accounts.push(account);
  s.players.push({id:account.playerId,name:'球友'+id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
  if(id!=='owner')s.registrations.push({id:'r-'+id,eventId:'e',playerId:account.playerId,sequence:1,status:'confirmed',arrival:start,departure:end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 s.bookings.push({id:'court',eventId:'e',name:'1 号场',start,end,pricing:'total',cents:0});
 s.rounds.push({id:'round',eventId:'e',start,duration:15,status:'playing',eligible:['p-a','p-b','p-c','p-d'],rest:[],seed:1});
 s.matches.push({id:'m',eventId:'e',roundId:'round',courtId:'court',a:['p-a','p-b'],b:['p-c','p-d'],status:'playing',start,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]});
 const score=(who:string,a:number,b:number,expectedGames:{a:number;b:number}[]=[])=>apply(s,s.accounts.find(x=>x.id===who)!,'score',{matchId:'m',a,b,games:[{a,b}],reason:'接龙球友确认比赛完成',expectedA:['p-a','p-b'],expectedB:['p-c','p-d'],expectedGames},at);
 return {s,score};
}

test('two players scoring the same game: the same score is accepted once, a different one is refused with who entered what',async()=>{
 const {s,score}=fixture();
 await score('a',21,17);
 const m=s.matches[0];assert.equal(m.status,'complete');assert.deepEqual(m.games,[{a:21,b:17}]);assert.equal(m.enteredBy,'a');
 const beforeDuplicate=structuredClone(s);
 await score('c',21,17);
 assert.deepEqual(s,beforeDuplicate,'an identical second score must not append another score audit');
 assert.equal(m.enteredBy,'a','an identical second entry changes nothing');
 await assert.rejects(()=>score('d',17,21),(e:Error)=>/409/.test(e.message)&&e.message.includes('球友a')&&e.message.includes('21 : 17'));
 assert.deepEqual(m.games,[{a:21,b:17}],'the first score is kept');
 await score('d',21,19,[{a:21,b:17}]);
 assert.deepEqual(m.games,[{a:21,b:19}],'a correction made after seeing the saved score goes through');assert.equal(m.enteredBy,'d');
});

test('members see which player saved a score, without account details',async()=>{
 const {s,score}=fixture();await score('a',21,17);
 const view=projectClubState(s,s.accounts.find(x=>x.id==='c')!,'2027-05',2027,at+1);
 assert.equal((view.matches[0] as {enteredByPlayerId?:string}).enteredByPlayerId,'p-a');
 assert.deepEqual(view.accounts,[]);
});
