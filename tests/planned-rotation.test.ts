import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Event} from '../lib/domain/types';

const now=Date.parse('2030-10-10T15:00:00Z');
/** Ten fictional players on two courts for four hours: eight play and two rest in every planned round. */
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 const e:Event={id:'event',creatorId:'owner',title:'Fictional planned rotation',start:now,end:now+4*3600000,venue:'Fixture venue',address:'',capacity:10,signupDeadline:now,cancelDeadline:now-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal'};
 s.events.push(e);
 for(let i=0;i<10;i++){
  const id='p'+i,account=i?'member'+i:'owner',rating=800+(i*137)%600;
  s.players.push({id,name:'Fictional '+i,ownerId:account,initialRating:rating,rating,ratedGames:0,enabled:true,ratingReason:''});
  s.accounts.push({id:account,email:'',role:i?'member':'admin',playerId:id});
  s.registrations.push({id:'reg'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 for(let i=0;i<2;i++)s.bookings.push({id:'court'+i,eventId:e.id,name:'Court '+i,start:e.start,end:e.end,pricing:'total',cents:1000});
 return {s,e};
}

test('planned rounds follow live rotation: no block from one game and hardly any immediate partner repeat',async()=>{
 // The partner cost is soft, as in live rotation: a large strength gap may still keep a pair together now and then.
 for(const seed of [1,2,3,4]){
  const {s,e}=fixture();
  await apply(s,s.accounts[0],'planPoints',{eventId:e.id,at:now,pointsMinutes:240,roundMinutes:15,seed,pairing:'rotate'},now-1);
  const rounds=s.rounds.filter(r=>r.eventId===e.id).sort((a,b)=>a.start-b.start);
  assert.equal(rounds.length,16);
  const lastGame=new Map<string,string>(),lastPartner=new Map<string,string>(),games=new Map<string,number>();let repeats=0;
  for(const r of rounds){
   const matches=s.matches.filter(m=>m.roundId===r.id&&m.status!=='cancelled');
   for(const m of matches){
    const ids=[...m.a,...m.b],from=ids.map(id=>lastGame.get(id)).filter(Boolean);
    assert.ok(!from.some(g=>from.filter(x=>x===g).length>=3),'seed '+seed+': three players straight from one game');
    for(const team of [m.a,m.b])if(lastPartner.get(team[0])===team[1])repeats++;
   }
   for(const m of matches){for(const id of [...m.a,...m.b]){lastGame.set(id,m.id);games.set(id,(games.get(id)??0)+1)}for(const team of [m.a,m.b]){lastPartner.set(team[0],team[1]);lastPartner.set(team[1],team[0])}}
  }
  assert.ok(repeats<=2,'seed '+seed+': '+repeats+' immediate partner repeats in 32 games');
  const counts=[...games.values()];assert.ok(Math.max(...counts)-Math.min(...counts)<=1,'games stay even');
 }
});
