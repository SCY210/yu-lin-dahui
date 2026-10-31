import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type State} from '../lib/domain/types';
import {createCompetitionSimulation,changeCompetitionSimulation,competitionView,type CompetitionSimulationDocument} from '../lib/competition-simulation';
import {balancedPairs} from '../lib/domain/tournament-pairing';
import {tournamentChampion} from '../lib/domain/tournament';
import {tournamentResults} from '../lib/domain/tournament-results';
import {newEventForm} from '../app/event-create-form';

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
/** The real create form, filled in as an organiser would: mixed doubles on four courts tomorrow. */
function createPayload(by:string){
 const form=newEventForm(now,true,true,[[by,'Organiser']]),courts=[1,2,3,4].map(i=>({...form.values.courts[0],name:i+'号场',advancedBy:by}));
 return form.convert!({...form.values,category:'mixed-doubles',courts,venue:'Fixture venue'});
}

test('the competition sandbox follows the real flow from the create form to the archive, without touching the club',async()=>{
 const real=club(),before=JSON.stringify(real);
 let doc=createCompetitionSimulation(now,real);
 assert.equal(doc.state.players.length,18,'every member with an account, as on the real signup');assert.equal(doc.state.events.length,0,'no competition until it is created');
 await assert.rejects(()=>step(doc,'signupAll'),/请先创建比赛/);
 await assert.rejects(()=>step(doc,'event',{...createPayload('sim-player-1'),tournament:false}),/只能创建比赛/);
 doc=await step(doc,'event',createPayload('sim-player-1'));
 const e=()=>doc.state.events[0];
 assert.ok(e().tournament);assert.equal(e().matchFormat,'doubles');assert.equal(e().tournament!.category,'mixed-doubles','the form\'s category');assert.ok(e().start>now,'tomorrow, as in the real form');
 await assert.rejects(()=>step(doc,'event',createPayload('sim-player-1')),/已经有一场比赛/);
 doc=await step(doc,'signupAll');
 assert.equal(doc.state.registrations.filter(r=>r.status==='confirmed').length,16,'everyone signed up through court signup');
 doc=await step(doc,'signup',{playerId:'sim-player-16',cancel:true});doc=await step(doc,'signup',{playerId:'sim-player-16'});
 doc=await step(doc,'startNow');assert.ok(e().start<=now&&e().end>now);assert.ok(doc.state.bookings.every(b=>b.start===e().start));
 doc=await step(doc,'tournamentSettings',{eventId:e().id,format:'groups',category:'mixed-doubles',scoring:{games:1,points:15},knockoutScoring:{games:3,points:21},prizes:{first:3000,second:1500,third:500}});
 const confirmed=new Set(doc.state.registrations.filter(r=>r.status==='confirmed').map(r=>r.playerId)),pairs=balancedPairs(doc.state.players.filter(p=>confirmed.has(p.id)).map(p=>({id:p.id,score:1000,gender:p.profile?.gender})),'mixed-doubles');
 doc=await step(doc,'tournamentDraw',{eventId:e().id,teams:pairs.teams,groups:2,advance:2,seed:5});
 const playing=()=>doc.state.matches.filter(m=>m.status==='playing');
 assert.equal(playing().length,4,'the system puts a fixture on every court after the draw');
 await assert.rejects(()=>step(doc,'tournamentArrange',{eventId:e().id}),/没有可以开赛/);
 // The referee scores one group match live to 15 under the group rule; the shortcut then submits the referee's result.
 const live=playing()[0].id;
 await assert.rejects(()=>step(doc,'liveScore',{op:'start',matchId:live}),/请先为这场比赛指定裁判/);
 const fixture=e().tournament!.fixtures.find(f=>f.matchId===live)!,referee=doc.state.players.find(p=>!doc.state.matches.find(m=>m.id===live)!.a.concat(doc.state.matches.find(m=>m.id===live)!.b).includes(p.id))!.id;
 doc=await step(doc,'tournamentReferee',{eventId:e().id,fixtureId:fixture.id,playerId:referee});
 doc=await step(doc,'liveScore',{op:'start',matchId:live});
 for(let i=0;i<15;i++)doc=await step(doc,'liveScore',{op:'point',matchId:live,side:'b'});
 assert.equal(doc.live[live].status,'finished');assert.ok(competitionView(doc,now).live[live]);
 doc=await step(doc,'autoScore');
 assert.deepEqual(doc.state.matches.find(m=>m.id===live)!.games,[{a:0,b:15}],'the score of the referee is kept');
 // Every result frees a court and the system starts the next fixture there.
 for(let round=0;round<20&&e().tournament!.phase==='groups'&&playing().length;round++)doc=await step(doc,'autoScore');
 const groupMatches=e().tournament!.fixtures.filter(f=>f.stage==='group').map(f=>doc.state.matches.find(m=>m.id===f.matchId)!);
 assert.ok(groupMatches.every(m=>m.status==='complete'&&m.games.length===1),'group matches: one game to 15');
 // The last group result draws the knockout by itself and the system starts it.
 assert.equal(e().tournament!.phase,'knockout');assert.ok(doc.state.audits.some(a=>a.action==='tournamentKnockout'&&a.actor==='system'));
 assert.equal(e().tournament!.phase,'knockout');
 for(let round=0;round<10&&!tournamentChampion(e().tournament!,doc.state);round++)doc=await step(doc,'autoScore');
 const knockout=e().tournament!.fixtures.filter(f=>f.stage==='knockout'&&f.matchId).map(f=>doc.state.matches.find(m=>m.id===f.matchId)!);
 assert.ok(knockout.every(m=>m.games.length>=2&&Math.max(...m.games.flatMap(g=>[g.a,g.b]))>=21),'knockout matches: best of three to 21');
 assert.equal(tournamentResults(e().tournament!,doc.state)!.length,8);
 doc=await step(doc,'settle',{eventId:e().id,confirmed:true,reason:'Entry fees'});assert.equal(doc.state.settlements.at(-1)!.bills.length,16);
 doc=await step(doc,'tournamentArchive',{eventId:e().id,archived:true});assert.ok(e().tournament!.archive);
 await assert.rejects(()=>step(doc,'blockedWords',{words:[]}),/只允许比赛相关操作/);
 assert.equal(JSON.stringify(real),before,'the real club is untouched');
 const reset=await step(doc,'reset');assert.equal(reset.state.events.length,0);assert.equal(reset.state.matches.length,0);assert.equal(reset.revision,doc.revision+1);
});
