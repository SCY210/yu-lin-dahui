import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type State} from '../lib/domain/types';
import {createCompetitionSimulation,changeCompetitionSimulation,competitionView,type CompetitionSimulationDocument} from '../lib/competition-simulation';
import {balancedPairs} from '../lib/domain/tournament-pairing';
import {tournamentChampion} from '../lib/domain/tournament';
import {tournamentResults} from '../lib/domain/tournament-results';

const now=Date.parse('2030-10-10T13:05:00Z');
/** A fictional club of eighteen members, half men and half women. */
function club():State{
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=Array.from({length:18},(_,i)=>({id:i?'member'+i:'owner',email:'',playerId:'p'+i,role:i?'member' as const:'admin' as const}));
 s.players=s.accounts.map((a,i)=>({id:a.playerId,name:'Fictional '+i,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:'',profile:{gender:i%2?'female' as const:'male' as const,years:1,hand:'right' as const,preference:'all' as const,style:'',equipment:''}}));
 return s;
}
let request=0;
const step=(doc:CompetitionSimulationDocument,action:string,payload:Record<string,unknown>={},at=now)=>changeCompetitionSimulation(doc,action,payload,'request-'+(++request),at);

test('the competition sandbox runs a whole competition, from format to archive, without touching the club',async()=>{
 const real=club(),before=JSON.stringify(real);
 let doc=createCompetitionSimulation(now,real);
 const e=()=>doc.state.events[0];
 assert.equal(doc.state.players.length,16,'sixteen members');assert.equal(doc.state.bookings.length,4,'four courts');
 assert.equal(e().tournament!.phase,'setup');assert.ok(doc.state.players.every(p=>!real.players.some(r=>r.id===p.id)),'sandbox ids');
 doc=await step(doc,'tournamentSettings',{eventId:e().id,format:'groups',category:'mixed-doubles',scoring:{games:1,points:21},fee:2000});
 const pairs=balancedPairs(doc.state.players.map(p=>({id:p.id,score:1000,gender:p.profile?.gender})),'mixed-doubles');
 assert.equal(pairs.teams.length,8);
 doc=await step(doc,'tournamentDraw',{eventId:e().id,teams:pairs.teams,groups:2,advance:2,seed:5});
 doc=await step(doc,'autoStart');
 const playing=()=>doc.state.matches.filter(m=>m.status==='playing');
 assert.equal(playing().length,4,'every court takes a fixture');
 // The referee scores one match live inside the sandbox; the shortcut then submits the referee's result.
 const live=playing()[0].id;
 doc=await step(doc,'liveScore',{op:'start',matchId:live});
 for(let i=0;i<21;i++)doc=await step(doc,'liveScore',{op:'point',matchId:live,side:'b'});
 assert.equal(doc.live[live].status,'finished');assert.ok(competitionView(doc,now).live[live]);
 doc=await step(doc,'autoScore');
 assert.deepEqual(doc.state.matches.find(m=>m.id===live)!.games,[{a:0,b:21}],'the referee\'s score is kept');
 for(let round=0;round<10&&e().tournament!.phase==='groups';round++){
  try{doc=await step(doc,'autoStart')}catch{doc=await step(doc,'tournamentKnockout',{eventId:e().id});continue}
  doc=await step(doc,'autoScore');
 }
 assert.equal(e().tournament!.phase,'knockout');
 for(let round=0;round<5&&!tournamentChampion(e().tournament!,doc.state);round++){doc=await step(doc,'autoStart');doc=await step(doc,'autoScore')}
 assert.ok(tournamentChampion(e().tournament!,doc.state),'a champion');
 assert.equal(tournamentResults(e().tournament!,doc.state)!.length,8);
 doc=await step(doc,'tournamentArchive',{eventId:e().id,archived:true});assert.ok(e().tournament!.archive);
 await assert.rejects(()=>step(doc,'eventStatus',{eventId:e().id,status:'ended'}),/比赛模拟只允许/);
 assert.equal(JSON.stringify(real),before,'the real club is untouched');
 const reset=await step(doc,'reset',{matchFormat:'singles'});assert.equal(reset.state.events[0].matchFormat,'singles');assert.equal(reset.state.matches.length,0);assert.equal(reset.revision,doc.revision+1);
});
