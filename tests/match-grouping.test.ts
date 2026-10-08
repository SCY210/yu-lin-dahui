import {test} from 'node:test';
import assert from 'node:assert/strict';
import {propose} from '../lib/domain/grouping';
import {proposeFixed} from '../lib/domain/fixed-partners';
import {apply} from '../lib/domain/commands';
import {replayRating} from '../lib/domain/ranking';
import {BALANCE_TOLERANCE} from '../lib/domain/match-balance';
import {emptyState,type Event,type Match,type Player} from '../lib/domain/types';

const start=Date.parse('2026-10-07T12:00:00Z');
const profile:NonNullable<Player['profile']>={years:2,hand:'right',preference:'doubles',style:'',equipment:''};
function fixture(ratings=[1500,1300,1100,900]) {
 const s=emptyState();
 const e:Event={id:'event',title:'分组测试',start,end:start+3*3600000,venue:'测试球馆',address:'',capacity:16,signupDeadline:start,cancelDeadline:start,note:'',status:'live',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events.push(e);s.accounts.push({id:'admin',email:'',playerId:'A',role:'admin'},{id:'member',email:'',playerId:'B',role:'member'});
 ratings.forEach((rating,i)=>{
  const id=String.fromCharCode(65+i);
  s.players.push({id,name:id,ownerId:i===1?'member':'admin',rating,initialRating:rating,ratedGames:20,enabled:true,ratingReason:'现场评估',profile:{...profile}});
  s.registrations.push({id:'reg-'+id,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 });
 for(let i=0;i<Math.floor(ratings.length/4);i++)s.bookings.push({id:'court-'+i,eventId:e.id,name:String(i),start,end:e.end,pricing:'hourly',cents:1000});
 return {s,e};
}
function match(id:string,a:string[],b:string[]):Match {
 return {id,eventId:'event',roundId:id,courtId:'court-0',a,b,status:'complete',start,end:start+60000,scoreA:21,scoreB:19,games:[{a:21,b:19}],monthly:true,elo:true,locked:false,enteredBy:'admin'};
}
const gap=(s:ReturnType<typeof fixture>['s'],m:{a:string[];b:string[]})=>Math.abs(m.a.reduce((n,id)=>n+s.players.find(p=>p.id===id)!.rating,0)-m.b.reduce((n,id)=>n+s.players.find(p=>p.id===id)!.rating,0))/2;

test('balanced pairing wins over pressure to avoid the previous partners',()=>{
 const {s,e}=fixture();s.matches.push(match('previous',['A','D'],['B','C']));
 for(let seed=1;seed<=20;seed++)assert.equal(gap(s,propose(s,e,start+120000,15,seed).courts[0]),0);
});
test('equal-level players still change partners and seeded results are reproducible',()=>{
 const {s,e}=fixture([1000,1000,1000,1000]);s.matches.push(match('previous',['A','B'],['C','D']));
 const next=propose(s,e,start+120000,15,17);
 assert.deepEqual(next,propose(s,e,start+120000,15,17));
 assert.ok([next.courts[0].a,next.courts[0].b].every(t=>!(t.includes('A')&&t.includes('B'))&&!(t.includes('C')&&t.includes('D'))));
});
test('several courts are balanced without duplicates or losing the resting players',()=>{
 const {s,e}=fixture([1600,1400,1200,1000,1500,1300,1100,900,1000,1000]);
 const next=propose(s,e,start,15,7),playing=next.courts.flatMap(m=>[...m.a,...m.b]);
 assert.equal(new Set(playing).size,8);assert.equal(next.rest.length,2);
 assert.ok(next.courts.every(m=>gap(s,m)<=BALANCE_TOLERANCE));
});
test('self-declared years, gender and a retired level field do not influence Elo or grouping',async()=>{
 const {s,e}=fixture();s.matches.push(match('rated',['A','D'],['B','C']));replayRating(s);
 const before=s.players.map(p=>({rating:p.rating,initialRating:p.initialRating,ratedGames:p.ratedGames}));
 const grouping=propose(s,e,start+120000,15,5);
 await apply(s,s.accounts[1],'profileDetails',{playerId:'B',...profile,years:80,level:'advanced',gender:'other'},start);
 assert.equal(s.players[1].profile?.gender,'other');
 assert.deepEqual(propose(s,e,start+120000,15,5),grouping);
 replayRating(s);assert.deepEqual(s.players.map(p=>({rating:p.rating,initialRating:p.initialRating,ratedGames:p.ratedGames})),before);
});
test('four gender options persist, old clients preserve the choice, invalid options and foreign edits fail',async()=>{
 const {s}=fixture();
 for(const gender of ['male','female','other','undisclosed']){
  await apply(s,s.accounts[1],'profileDetails',{playerId:'B',...profile,gender},start);
  assert.equal(s.players[1].profile?.gender,gender);
 }
 await apply(s,s.accounts[1],'profileDetails',{playerId:'B',...profile,years:3},start);
 assert.equal(s.players[1].profile?.gender,'undisclosed');
 await assert.rejects(()=>apply(s,s.accounts[1],'profileDetails',{playerId:'B',...profile,gender:'joke'},start));
 await assert.rejects(()=>apply(s,s.accounts[1],'profileDetails',{playerId:'A',...profile,gender:'male'},start),/403/);
});
test('fixed teams prioritize balanced opponents over repeating a match',()=>{
 const {s,e}=fixture([1500,1500,1400,1400,1000,1000,900,900]);
 const teams=[['A','B'],['C','D'],['E','F'],['G','H']];
 s.matches.push(match('previous1',teams[0],teams[1]),match('previous2',teams[2],teams[3]));
 const next=proposeFixed(s,e,start+120000,15,5,teams);
 assert.ok(next.courts.every(m=>gap(s,m)===100));
 assert.ok(next.courts.flatMap(m=>[m.a,m.b]).every(t=>teams.some(original=>original.every(id=>t.includes(id)))));
});
