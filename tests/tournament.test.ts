import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Event} from '../lib/domain/types';
import {emptyTournament,groupStandings,fixtureSides,fixtureWinner,groupComplete,tournamentChampion} from '../lib/domain/tournament';
import {newEventForm} from '../app/event-create-form';
const now=Date.parse('2030-10-10T13:00:00Z');
function fixture(singles=false,count=8){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=Array.from({length:count},(_,i)=>({id:i?'member'+i:'owner',email:'',playerId:'p'+i,role:i?'member' as const:'admin' as const}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.playerId,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 const e:Event={id:'t',creatorId:'owner',title:'Fictional tournament',matchFormat:singles?'singles':'doubles',tournament:emptyTournament(),start:now-3600000,end:now+24*3600000,venue:'Fixture venue',address:'',capacity:count,note:'',signupDeadline:now,cancelDeadline:now-86400000,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events=[e];s.bookings=[0,1].map(i=>({id:'court'+i,eventId:e.id,name:'Court '+i,start:e.start,end:e.end,pricing:'total',cents:1380}));s.registrations=s.players.map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 const teams=singles?s.players.map(p=>[p.id]):Array.from({length:count/2},(_,i)=>['p'+i*2,'p'+(i*2+1)]);
 return {s,e,a:s.accounts[0],teams};
}
test('competition creation keeps ordinary forms and practice intact',async()=>{
 const {s,a}=fixture(),form=newEventForm(now,true);assert.equal(form.title,'创建比赛');assert.equal(form.fields.find(f=>f.key==='matchFormat'),undefined,'a competition picks its category instead');assert.deepEqual(form.fields.find(f=>f.key==='category')!.options!.map(o=>o[0]),['singles','mens-singles','mens-doubles','mixed-doubles']);
 const payload=form.convert!({...form.values,courts:form.values.courts.map((r:object)=>({...r,advancedBy:'p0'})),venue:'Fixture venue'});await apply(s,a,form.action,payload,now);assert.equal(s.events[1].tournament!.phase,'setup');assert.match(s.events[1].title,/双打比赛$/);assert.equal(s.events[1].pointsPlan,undefined);assert.equal(s.events[1].tournament!.category,'mens-doubles','the default category');assert.deepEqual(s.events[1].tournament!.knockoutScoring,{games:3,points:21});
 await assert.rejects(()=>apply(s,a,'event',{...payload,matchFormat:'singles'},now),/项目与单打/);const singles=form.convert!({...form.values,category:'mens-singles',courts:form.values.courts.map((r:object)=>({...r,advancedBy:'p0'})),venue:'Fixture venue'});assert.equal(singles.matchFormat,'singles');assert.equal(singles.category,'mens-singles');assert.equal(form.convert!({...form.values,category:'singles',courts:form.values.courts.map((r:object)=>({...r,advancedBy:'p0'})),venue:'Fixture venue'}).category,undefined,'open singles has no category');
 const ordinary=newEventForm(now);assert.equal(ordinary.values.tournament,false);assert.ok(ordinary.fields[0].options!.some(o=>o[0]==='practice'));
 await assert.rejects(()=>apply(s,a,'event',{...payload,matchFormat:'practice',note:'Practice'},now),/只能选择/);
});
test('fixed doubles and singles run from group draw through a knockout champion with scores retained',async()=>{
 for(const singles of [false,true]){const {s,e,a,teams}=fixture(singles,singles?8:16);await apply(s,a,'tournamentDraw',{eventId:e.id,teams,groups:2,advance:2,seed:4},now);
  const t=e.tournament!;assert.equal(t.fixtures.length,12);assert.equal(new Set(t.groups.flat()).size,8);assert.equal(new Set(t.fixtures.map(f=>[f.a,f.b].sort().join(':'))).size,12);
  await assert.rejects(()=>apply(s,a,'tournamentKnockout',{eventId:e.id},now),/完成所有小组赛/);
  let clock=now;for(const f of t.fixtures){await apply(s,a,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},clock);const m=s.matches.at(-1)!;assert.equal(m.a.length,singles?1:2);assert.deepEqual(m.a,t.teams.find(x=>x.id===f.a)!.players);clock+=60000;await apply(s,a,'score',{matchId:m.id,a:21,b:19},clock)}
  assert.equal(groupComplete(t,s),true);assert.ok(groupStandings(t,s,0).every(r=>r.played===3));const history=structuredClone(s.matches);
  await apply(s,a,'tournamentKnockout',{eventId:e.id},clock);assert.equal(t.fixtures.filter(f=>f.stage==='knockout').length,3);await assert.rejects(()=>apply(s,a,'score',{matchId:history[0].id,a:19,b:21},clock),/返回小组赛/);
  for(const f of t.fixtures.filter(f=>f.stage==='knockout')){const sides=fixtureSides(t,s,f);assert.ok(sides.a&&sides.b);await apply(s,a,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},clock);clock+=60000;await apply(s,a,'score',{matchId:s.matches.at(-1)!.id,a:21,b:19},clock)}
  assert.ok(tournamentChampion(t,s));assert.deepEqual(s.matches.slice(0,history.length),history);assert.equal(s.matches.length,15);assert.ok(s.matches.every(m=>m.status==='complete'&&m.monthly&&m.elo));
  const semi=t.fixtures.find(f=>f.stage==='knockout')!,before=structuredClone(s);await assert.rejects(()=>apply(s,a,'score',{matchId:semi.matchId!,a:19,b:21},clock),/后续淘汰赛/);assert.deepEqual(s,before);
 }
});
test('non-power-of-two qualifiers get explicit byes and all real first-round games cross groups',async()=>{
 const {s,e,a,teams}=fixture(true,9);await apply(s,a,'tournamentDraw',{eventId:e.id,teams,groups:3,advance:2,seed:7},now);const t=e.tournament!;let clock=now;
 for(const f of t.fixtures){await apply(s,a,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},clock);clock+=60000;await apply(s,a,'score',{matchId:f.matchId!,a:21,b:10},clock)}
 await apply(s,a,'tournamentKnockout',{eventId:e.id},clock);const first=t.fixtures.filter(f=>f.stage==='knockout'&&f.round===1);assert.equal(first.length,4);assert.equal(first.filter(f=>fixtureWinner(t,s,f)).length,2);
 for(const f of first.filter(f=>f.a&&f.b))assert.notEqual(t.groups.findIndex(g=>g.includes(f.a!)),t.groups.findIndex(g=>g.includes(f.b!)));
 for(const f of t.fixtures.filter(f=>f.stage==='knockout')){const sides=fixtureSides(t,s,f);if(!sides.a||!sides.b)continue;await apply(s,a,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},clock);clock+=60000;await apply(s,a,'score',{matchId:f.matchId!,a:21,b:10},clock)}assert.ok(tournamentChampion(t,s));
});
test('permissions, unique fixed teams, formal signups, locked scheduler and occupied courts are enforced before mutation',async()=>{
 const {s,e,a,teams}=fixture(),draw={eventId:e.id,teams,groups:2,advance:2,seed:1};let before=structuredClone(s);
 await assert.rejects(()=>apply(s,s.accounts[1],'tournamentDraw',draw,now),/403/);assert.deepEqual(s,before);
 await assert.rejects(()=>apply(s,a,'tournamentDraw',{...draw,teams:[teams[0],teams[0],...teams.slice(2)]},now),/只能参加一队/);assert.deepEqual(s,before);
 s.registrations[0].status='waitlist';await assert.rejects(()=>apply(s,a,'tournamentDraw',draw,now),/正式报名/);s.registrations[0].status='confirmed';await apply(s,a,'tournamentDraw',draw,now);
 for(const action of ['liveStart','generate','planPoints','pointsModeVote'])await assert.rejects(()=>apply(s,a,action,{eventId:e.id,at:now,duration:15,seed:1,pointsMinutes:30,roundMinutes:15,pairing:'rotate',mode:'rotate'},now),/对战表|固定搭档/);
 const t=e.tournament!,f=t.fixtures[0];await apply(s,a,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},now);before=structuredClone(s);
 await assert.rejects(()=>apply(s,a,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},now),/409/);assert.deepEqual(s,before);
 await assert.rejects(()=>apply(s,a,'tournamentStart',{eventId:e.id,fixtureId:t.fixtures[1].id,courtId:'court0'},now),/场地正在比赛/);assert.deepEqual(s,before);
 await assert.rejects(()=>apply(s,a,'tournamentDraw',draw,now),/已开打/);await assert.rejects(()=>apply(s,a,'void',{matchId:f.matchId!,status:'forfeit'},now),/不能作废/);assert.deepEqual(s,before);
});
test('unstarted knockout can reopen group scoring and regenerated standings determine new qualifiers',async()=>{
 const {s,e,a,teams}=fixture(true,4);await apply(s,a,'tournamentDraw',{eventId:e.id,teams,groups:2,advance:1,seed:2},now);const t=e.tournament!;let clock=now;
 for(const f of t.fixtures){await apply(s,a,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},clock);clock+=60000;await apply(s,a,'score',{matchId:f.matchId!,a:21,b:10},clock)}
 await apply(s,a,'tournamentKnockout',{eventId:e.id},clock);const old=t.fixtures.at(-1)!.a;await apply(s,a,'tournamentReopen',{eventId:e.id},clock);await apply(s,a,'score',{matchId:t.fixtures[0].matchId!,a:10,b:21},clock);await apply(s,a,'tournamentKnockout',{eventId:e.id},clock);assert.notEqual(t.fixtures.at(-1)!.a,old);
});
