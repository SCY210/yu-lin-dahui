import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Event,type State} from '../lib/domain/types';
import {newTournament,fixtureSides,type TournamentFormat} from '../lib/domain/tournament';
import {tournamentResults} from '../lib/domain/tournament-results';

const now=Date.parse('2030-10-10T13:00:00Z');
function fixture(count:number,format:TournamentFormat){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=Array.from({length:count+1},(_,i)=>({id:i?'member'+i:'owner',email:'',playerId:'p'+i,role:i?'member' as const:'admin' as const}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.playerId,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 const e:Event={id:'cup',creatorId:'owner',title:'Fictional cup',matchFormat:'singles',tournament:{...newTournament(),autoArrange:false,format,scoring:{games:1,points:21},knockoutScoring:{games:1,points:21}},start:now-3600000,end:now+24*3600000,venue:'Fixture venue',address:'',capacity:count,note:'',signupDeadline:now,cancelDeadline:now-86400000,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events=[e];s.bookings=[{id:'court0',eventId:e.id,name:'Court 0',start:e.start,end:e.end,pricing:'total',cents:0}];
 s.registrations=s.players.slice(1).map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 return {s,e,owner:s.accounts[0],member:s.accounts[1],entrants:s.players.slice(1).map(p=>[p.id])};
}
/** Plays every playable fixture, round by round; the lower player number always wins. */
async function playAll(s:State,e:Event,owner:State['accounts'][number]){
 const t=e.tournament!,num=(team?:string|null)=>Number(t.teams.find(x=>x.id===team)!.players[0].slice(1));let clock=now;
 for(let pass=0;pass<8;pass++)for(const f of t.fixtures){
  if(f.matchId)continue;const {a,b}=fixtureSides(t,s,f);if(!a||!b)continue;
  await apply(s,owner,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},clock);clock+=60000;
  const aWins=num(a)<num(b);await apply(s,owner,'score',{matchId:f.matchId!,a:aWins?21:15,b:aWins?15:21},clock);
 }
 return clock;
}

test('a knockout places teams by the round they went out in',async()=>{
 const {s,e,owner,entrants}=fixture(8,'knockout');
 await apply(s,owner,'tournamentDraw',{eventId:e.id,teams:entrants,seed:1,seeded:true},now);
 assert.equal(tournamentResults(e.tournament!,s),null,'no results before a champion');
 await playAll(s,e,owner);
 const rows=tournamentResults(e.tournament!,s)!;
 assert.deepEqual(rows.map(r=>r.place),[1,2,3,3,5,5,5,5]);
 assert.deepEqual(rows.slice(0,3).map(r=>r.label),['冠军','亚军','并列第 3 名']);
 assert.deepEqual(rows[0].players,['p1']);assert.deepEqual([rows[0].played,rows[0].wins,rows[0].pointsFor,rows[0].pointsAgainst],[3,3,63,45]);
});

test('a round robin keeps its table order and groups then knockout place non-qualifiers by group place',async()=>{
 const rr=fixture(5,'round-robin');
 await apply(rr.s,rr.owner,'tournamentDraw',{eventId:rr.e.id,teams:rr.entrants,seed:7},now);await playAll(rr.s,rr.e,rr.owner);
 const table=tournamentResults(rr.e.tournament!,rr.s)!;
 assert.deepEqual(table.map(r=>r.players[0]),['p1','p2','p3','p4','p5']);assert.deepEqual(table.map(r=>r.place),[1,2,3,4,5]);
 const g=fixture(8,'groups');
 await apply(g.s,g.owner,'tournamentDraw',{eventId:g.e.id,teams:g.entrants,groups:2,advance:2,seed:3},now);
 let clock=await playAll(g.s,g.e,g.owner);
 await apply(g.s,g.owner,'tournamentKnockout',{eventId:g.e.id},clock);clock=await playAll(g.s,g.e,g.owner);
 const rows=tournamentResults(g.e.tournament!,g.s)!;
 assert.deepEqual(rows.map(r=>r.place),[1,2,3,3,5,5,7,7]);
 assert.equal(rows[0].players[0],'p1');assert.deepEqual(rows.slice(6).map(r=>r.label),['并列第 7 名','并列第 7 名']);
});

test('one click archives a finished competition with frozen results, and it can be undone',async()=>{
 const {s,e,owner,member,entrants}=fixture(4,'knockout');
 await apply(s,owner,'tournamentDraw',{eventId:e.id,teams:entrants,seed:1,seeded:true},now);
 await assert.rejects(()=>apply(s,owner,'tournamentArchive',{eventId:e.id,archived:true},now),/还没有决出冠军/);
 const clock=await playAll(s,e,owner);
 await assert.rejects(()=>apply(s,member,'tournamentArchive',{eventId:e.id,archived:true},clock),/403/);
 const later=e.end+86400000;
 await apply(s,owner,'tournamentArchive',{eventId:e.id,archived:true},later);
 const archive=e.tournament!.archive!;assert.equal(archive.at,later);assert.deepEqual(archive.results[0].players,[{id:'p1',name:'Fictional p1'}]);
 s.players.find(p=>p.id==='p1')!.name='Renamed';assert.equal(e.tournament!.archive!.results[0].players[0].name,'Fictional p1','names are frozen');
 await assert.rejects(()=>apply(s,owner,'tournamentDraw',{eventId:e.id,teams:entrants,seed:2,seeded:true},clock),/已归档/);
 await assert.rejects(()=>apply(s,owner,'tournamentArchive',{eventId:e.id,archived:true},later),/已经归档/);
 await apply(s,owner,'tournamentArchive',{eventId:e.id,archived:false},later);assert.equal(e.tournament!.archive,undefined);
 assert.ok(s.audits.some(x=>x.action==='tournamentArchive'));
});
