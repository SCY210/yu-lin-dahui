import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Event} from '../lib/domain/types';
import {newTournament,finishedGame,fixtureSides,tournamentChampion,groupStandings,categoryProblem} from '../lib/domain/tournament';
import {seededFirstRound} from '../lib/domain/tournament-commands';
import {balancedPairs,pairingFlags} from '../lib/domain/tournament-pairing';
import {calculateSettlement,competitionCosts} from '../lib/domain/money';

const now=Date.parse('2030-10-10T13:00:00Z');
/** A fictional competition: `owner` is the club owner, `admin` an administrator, `creator` a member who created it. */
function fixture(singles=false,count=8,genders:string[]=[]){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=Array.from({length:count},(_,i)=>({id:i===0?'owner':i===1?'admin':i===2?'creator':'member'+i,email:'',playerId:'p'+i,role:i<2?'admin' as const:'member' as const}));
 s.players=s.accounts.map((a,i)=>({id:a.playerId,name:'Fictional '+i,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:'',...(genders[i]?{profile:{gender:genders[i] as 'male',years:1,hand:'right' as const,preference:'all' as const,style:'',equipment:''}}:{})}));
 const e:Event={id:'t',creatorId:'creator',title:'Fictional competition',matchFormat:singles?'singles':'doubles',tournament:{...newTournament(),autoArrange:false},start:now-3600000,end:now+24*3600000,venue:'Fixture venue',address:'',capacity:count,note:'',signupDeadline:now,cancelDeadline:now-86400000,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events=[e];s.bookings=[0,1].map(i=>({id:'court'+i,eventId:e.id,name:'Court '+i,start:e.start,end:e.end,pricing:'total',cents:1380}));
 s.registrations=s.players.map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 const teams=singles?s.players.map(p=>[p.id]):Array.from({length:count/2},(_,i)=>['p'+i*2,'p'+(i*2+1)]);
 const by=(id:string)=>s.accounts.find(a=>a.id===id)!;
 return {s,e,owner:by('owner'),admin:by('admin'),creator:by('creator'),teams};
}
const settings=(e:Event,fields:Record<string,unknown>={})=>({eventId:e.id,format:'groups',category:null,scoring:{games:3,points:21},...fields});
const win={a:2,b:0,games:[{a:21,b:15},{a:21,b:12}]};

test('games follow the scoring rule: two clear points after deuce, the cap wins outright',()=>{
 const rule={games:3 as const,points:21 as const};
 for(const [a,b] of [[21,19],[21,0],[22,20],[29,27],[30,29],[30,28]])assert.ok(finishedGame(rule,a,b),a+':'+b);
 for(const [a,b] of [[21,20],[20,18],[23,20],[31,29],[30,27],[19,21+1]])assert.ok(!finishedGame(rule,a,b),a+':'+b);
 assert.ok(finishedGame({games:1,points:15},21,20),'15-point games cap at 21');assert.ok(finishedGame({games:1,points:11},15,14));
});

test('only the owner and administrators choose the format, category, scoring and prizes, and only before the draw',async()=>{
 const {s,e,owner,admin,creator,teams}=fixture();
 await assert.rejects(()=>apply(s,creator,'tournamentSettings',settings(e,{prizes:{first:2000,second:1000,third:500}}),now),/403/);
 await apply(s,admin,'tournamentSettings',settings(e,{format:'round-robin',scoring:{games:1,points:21},prizes:{first:2000,second:1000,third:500}}),now);
 assert.deepEqual([e.tournament!.format,e.tournament!.scoring,e.tournament!.prizes],['round-robin',{games:1,points:21},{first:2000,second:1000,third:500}]);
 await apply(s,owner,'tournamentDraw',{eventId:e.id,teams,seed:3},now);
 await assert.rejects(()=>apply(s,owner,'tournamentSettings',settings(e,{format:'knockout',scoring:{games:1,points:21}}),now),/抽签后不能更改赛制/);
 await apply(s,owner,'tournamentSettings',settings(e,{format:'round-robin',scoring:{games:1,points:21},prizes:{first:3000,second:1000,third:500}}),now);assert.equal(e.tournament!.prizes!.first,3000,'prizes can still change');
 assert.equal(e.tournament!.format,'round-robin','the draw keeps the settings');
});

test('a single round robin plays everyone once and crowns the top of the table',async()=>{
 const {s,e,owner}=fixture(true,5);
 await apply(s,owner,'tournamentSettings',settings(e,{format:'round-robin',scoring:{games:1,points:21}}),now);
 await apply(s,owner,'tournamentDraw',{eventId:e.id,teams:s.players.map(p=>[p.id]),seed:9},now);
 const t=e.tournament!;assert.equal(t.phase,'groups');assert.equal(t.groups.length,1);assert.equal(t.fixtures.length,10);
 let clock=now;
 for(const f of t.fixtures){await apply(s,owner,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},clock);clock+=60000;
  // The team drawn first in the table wins all its games.
  const first=t.groups[0][0],aWins=f.a===first||f.b!==first&&f.a!<f.b!;
  await apply(s,owner,'score',{matchId:f.matchId!,a:aWins?21:15,b:aWins?15:21},clock)}
 assert.equal(tournamentChampion(t,s),t.groups[0][0]);assert.equal(groupStandings(t,s,0)[0].wins,4);
 await assert.rejects(()=>apply(s,owner,'tournamentKnockout',{eventId:e.id},clock),/没有小组赛晋级/);
});

test('a seeded knockout keeps the top seeds apart and gives them the byes',async()=>{
 assert.deepEqual(seededFirstRound(['1','2','3','4','5','6','7','8']).map(p=>p.a+'-'+p.b),['1-8','4-5','2-7','3-6']);
 const {s,e,owner}=fixture(true,6),seeds=['p5','p4','p3','p2','p1','p0'];
 await apply(s,owner,'tournamentSettings',settings(e,{format:'knockout',scoring:{games:3,points:21}}),now);
 await apply(s,owner,'tournamentDraw',{eventId:e.id,teams:seeds.map(id=>[id]),seed:1,seeded:true},now);
 const t=e.tournament!,player=(team?:string|null)=>t.teams.find(x=>x.id===team)?.players[0];
 assert.equal(t.phase,'knockout');assert.equal(t.fixtures.length,7);
 const first=t.fixtures.filter(f=>f.round===1);
 assert.deepEqual(first.map(f=>[player(f.a),player(f.b)??'bye']),[['p5','bye'],['p2','p1'],['p4','bye'],['p3','p0']]);
 let clock=now;
 for(let round=1;round<=3;round++)for(const f of t.fixtures.filter(f=>f.round===round)){
  const sides=fixtureSides(t,s,f);if(!sides.a||!sides.b)continue;
  await apply(s,owner,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},clock);clock+=60000;
  await assert.rejects(()=>apply(s,owner,'score',{matchId:f.matchId!,a:21,b:15},clock),/三局两胜/);
  await assert.rejects(()=>apply(s,owner,'score',{matchId:f.matchId!,a:2,b:0,games:[{a:21,b:20},{a:21,b:12}]},clock),/不是完整的一局/);
  await apply(s,owner,'score',{matchId:f.matchId!,...win},clock);
 }
 assert.equal(player(tournamentChampion(t,s)),'p5','the side listed first always won: the top seed');
 await assert.rejects(()=>apply(s,owner,'tournamentReopen',{eventId:e.id},clock),/不能返回小组赛/);
});

test('men\'s and mixed doubles check each team against the profile gender',async()=>{
 const genders=['male','female','male','female','male','male','female',''];
 assert.equal(categoryProblem('mixed-doubles',[{id:'a',name:'A',profile:{gender:'male'}},{id:'b',name:'B',profile:{gender:'female'}}]),null);
 const {s,e,owner}=fixture(false,8,genders);
 await apply(s,owner,'tournamentSettings',settings(e,{category:'mixed-doubles'}),now);
 await assert.rejects(()=>apply(s,owner,'tournamentDraw',{eventId:e.id,teams:[['p0','p1'],['p2','p3'],['p4','p5'],['p6','p7']],seed:1},now),/混双/);
 await apply(s,owner,'tournamentSettings',settings(e,{category:'mens-doubles'}),now);
 await assert.rejects(()=>apply(s,owner,'tournamentDraw',{eventId:e.id,teams:[['p0','p4'],['p2','p5'],['p1','p3'],['p6','p7']],seed:1},now),/男双只限男球友/);
});

test('balanced pairing evens out the team totals and mixes one man with one woman',()=>{
 const scores=[1600,1500,1400,1300,1200,1100,1000,900],players=scores.map((score,i)=>({id:'p'+i,score}));
 const {teams,left}=balancedPairs(players);assert.deepEqual(left,[]);
 const totals=teams.map(t=>t.reduce((sum,id)=>sum+players.find(p=>p.id===id)!.score,0));
 assert.ok(Math.max(...totals)-Math.min(...totals)<=0,'totals '+totals.join());
 const odd=balancedPairs([...players,{id:'late',score:1000}]);assert.deepEqual(odd.left,['late'],'the last given waits for a partner');
 const mixed=[...players.slice(0,5).map(p=>({...p,gender:'male'})),...players.slice(5).map(p=>({...p,gender:'female'})),{id:'w9',score:1650,gender:'female'}];
 // Nine players: the last one waits. Five men and three women remain, so the weakest man stands in for a woman.
 const result=balancedPairs(mixed,'mixed-doubles');assert.equal(result.teams.length,4);assert.deepEqual(result.left,['w9']);
 const genders=result.teams.map(team=>team.map(id=>mixed.find(p=>p.id===id)!.gender).sort().join());
 assert.equal(genders.filter(g=>g==='female,male').length,3);assert.equal(genders.filter(g=>g==='male,male').length,1);
 const standIn=result.teams.findIndex(team=>team.includes('p4'));assert.ok(standIn>=0,'the man with the lowest score stands in');
 assert.deepEqual(result.flags.map(f=>f.team),[standIn],'only the stand-in team is flagged');assert.match(result.flags[0].reason,/顶女位/);
 // Hand-made pairs are flagged when a team total is far from the others.
 assert.deepEqual(pairingFlags([[{id:'a',score:1600},{id:'b',score:1600}],[{id:'c',score:1000},{id:'d',score:1000}],[{id:'e',score:1300},{id:'f',score:1300}]]).map(f=>f.team),[0,1]);
});

test('the entry fee is courts, shuttles and prizes over the entrants, rounded up to a euro, never a split',async()=>{
 const {s,e,owner}=fixture(true,4);
 s.registrations[3].status='waitlist';
 // Two courts at 13.80, 18 shuttles at 2.00, and prizes of 30 + 15 + 7.50: 124.10 over three entrants.
 s.costs.push({id:'balls',eventId:e.id,type:'ball',name:'Fixture shuttles',pricing:'unit',cents:200,tubeCount:1,used:18,start:null,end:null,bearer:'members'});
 await apply(s,owner,'tournamentSettings',settings(e,{format:'round-robin',prizes:{first:3000,second:1500,third:750}}),now);
 const costs=competitionCosts(s,e);assert.deepEqual([costs.courts,costs.shuttles,costs.prizes,costs.total,costs.fee],[2760,3600,5250,11610,3900]);
 const bill=calculateSettlement(s,e,now);
 assert.deepEqual(bill.bills.map(b=>[b.playerId,b.total]),[['p0',3900],['p1',3900],['p2',3900]],'confirmed entrants only, 116.10 / 3 rounded up');
 assert.equal(bill.total,11700);assert.equal(bill.expenseTotal,11610);assert.equal(bill.roundingDifference,90);assert.deepEqual(bill.detail.map(d=>d.name),['场地费','球费','冠亚季奖品']);
 await apply(s,owner,'settle',{eventId:e.id,confirmed:true,reason:'Entry fees'},now);
 assert.equal(s.settlements.at(-1)!.confirmed,true);
});

test('men\'s singles only takes men, doubles must keep a category, and partners for men\'s doubles are men',async()=>{
 const {s,e,owner}=fixture(true,4,['male','male','female','male']);
 await assert.rejects(()=>apply(s,owner,'tournamentSettings',settings(e,{category:'mens-doubles'}),now),/单打比赛只能选择单打或男单/);
 await apply(s,owner,'tournamentSettings',settings(e,{category:'mens-singles'}),now);
 await assert.rejects(()=>apply(s,owner,'tournamentDraw',{eventId:e.id,teams:[['p0'],['p1'],['p2'],['p3']],seed:1},now),/男单只限男球友/);
 const doubles=fixture(false,4,['male','male','male','male']);
 await apply(doubles.s,doubles.owner,'tournamentSettings',settings(doubles.e,{category:'mens-doubles'}),now);
 await assert.rejects(()=>apply(doubles.s,doubles.owner,'tournamentSettings',settings(doubles.e,{category:null}),now),/请选择男双或混双/);
 const pairs=balancedPairs([{id:'m1',score:1200,gender:'male'},{id:'w1',score:1500,gender:'female'},{id:'m2',score:1000,gender:'male'}],'mens-doubles');
 assert.deepEqual([pairs.teams,pairs.left],[[['m1','m2']],['w1']]);
});

test('the group stage and the knockout follow their own scoring rule',async()=>{
 const {s,e,owner}=fixture(true,4);
 await apply(s,owner,'tournamentSettings',settings(e,{format:'groups',scoring:{games:1,points:11},knockoutScoring:{games:3,points:21}}),now);
 await apply(s,owner,'tournamentDraw',{eventId:e.id,teams:s.players.map(p=>[p.id]),groups:2,advance:1,seed:2},now);
 const t=e.tournament!;let clock=now;
 for(const f of t.fixtures){await apply(s,owner,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},clock);clock+=60000;
  await assert.rejects(()=>apply(s,owner,'score',{matchId:f.matchId!,...win},clock),/一局定胜负/);
  await apply(s,owner,'score',{matchId:f.matchId!,a:11,b:6},clock)}
 await apply(s,owner,'tournamentKnockout',{eventId:e.id},clock);
 const final=t.fixtures.find(f=>f.stage==='knockout')!;await apply(s,owner,'tournamentStart',{eventId:e.id,fixtureId:final.id,courtId:'court0'},clock);
 await assert.rejects(()=>apply(s,owner,'score',{matchId:final.matchId!,a:11,b:6},clock+60000),/三局两胜/);
 await apply(s,owner,'score',{matchId:final.matchId!,...win},clock+60000);
 assert.equal(s.matches.find(m=>m.id===final.matchId)!.status,'complete');
});

test('the system puts ready fixtures on free courts after the draw and after every result',async()=>{
 const {s,e,owner}=fixture(true,6);e.tournament!.autoArrange=true;
 await apply(s,owner,'tournamentSettings',settings(e,{format:'round-robin',scoring:{games:1,points:21}}),now);
 await apply(s,owner,'tournamentDraw',{eventId:e.id,teams:s.players.map(p=>[p.id]),seed:4},now);
 const t=e.tournament!,playing=()=>s.matches.filter(m=>m.status==='playing');
 assert.equal(playing().length,2,'both courts take a first-round fixture');assert.notEqual(playing()[0].courtId,playing()[1].courtId);
 assert.ok(playing().every(m=>t.fixtures.find(f=>f.matchId===m.id)!.round===1),'the first round goes first');
 let clock=now;
 for(let i=0;i<20&&playing().length;i++){
  clock+=60000;const m=playing()[0];await apply(s,owner,'score',{matchId:m.id,a:21,b:15},clock);
  const onCourt=new Set(playing().flatMap(x=>[...x.a,...x.b]));
  assert.ok(new Set(playing().map(x=>x.courtId)).size===playing().length,'one match per court');
  assert.ok(playing().every(x=>[...x.a,...x.b].every(id=>[...onCourt].filter(o=>o===id).length===1)),'nobody plays twice at once');
 }
 assert.equal(s.matches.filter(m=>m.status==='complete').length,15,'every fixture was arranged and played without anyone starting it by hand');
 await assert.rejects(()=>apply(s,owner,'tournamentArrange',{eventId:e.id},clock),/没有可以开赛/);
});
