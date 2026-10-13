import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {mvpPoints,mvpWinners} from '../lib/domain/activity-voting';
import {bonusNotices} from '../lib/domain/bonus-notices';
import {doublesLeaderboard,singlesLeaderboard} from '../lib/domain/ranking';
import {projectClubState} from '../lib/club-view';
import {emptyState,type Account,type Event,type State} from '../lib/domain/types';
import {clubViewValidUntil} from '../lib/club-read-cache';

const hour=3600000,start=Date.parse('2027-05-08T15:00:00Z'),end=start+3*hour,closes=end+24*hour;
function fixture(format:'doubles'|'singles'='doubles'){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 const e:Event={id:'e',creatorId:'host',title:'周六双打',matchFormat:format,start,end,venue:'球馆',address:'',capacity:8,signupDeadline:start-2*hour,cancelDeadline:start-24*hour,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events.push(e);
 for(const id of ['owner','host','a','b','c','d']){
  const account:Account={id,email:'',role:id==='owner'?'admin':'member',playerId:'p-'+id};s.accounts.push(account);
  s.players.push({id:account.playerId,name:'球友'+id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
  if(id!=='owner')s.registrations.push({id:'r-'+id,eventId:'e',playerId:account.playerId,sequence:1,status:'confirmed',arrival:start,departure:end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 const vote=(voter:string,target:string,at=end+hour)=>apply(s,s.accounts.find(a=>a.id===voter)!,'awardVote',{eventId:'e',playerId:'p-'+target,category:'mvp'},at);
 return {s,e,vote};
}
const points=(s:State,id:string,at:number,board=doublesLeaderboard)=>board(s,'2027-05',at).find(r=>r.playerId==='p-'+id);

test('voting closes 24 hours after the end and the most-voted player then gets 5 season points',async()=>{
 const {s,e,vote}=fixture();
 await vote('b','a');await vote('c','a');await vote('a','b');
 assert.deepEqual(mvpWinners(s,e,closes-1),[],'no MVP before voting closes');
 assert.equal(points(s,'a',closes-1)?.mvpPoints,0);
 await assert.rejects(()=>vote('d','b',closes),/投票|关闭|开放|结束/);
 assert.deepEqual(mvpWinners(s,e,closes),['p-a']);
 const row=points(s,'a',closes)!;assert.equal(row.mvpPoints,mvpPoints);assert.equal(row.points,5);
 assert.equal(points(s,'b',closes)?.mvpPoints,0);
});

test('a tie gives every leader the points; no votes gives none; singles activities count on the singles board',async()=>{
 const {s,e,vote}=fixture();await vote('a','b');await vote('b','a');
 assert.deepEqual(mvpWinners(s,e,closes),['p-a','p-b']);
 assert.equal(points(s,'a',closes)?.mvpPoints,5);assert.equal(points(s,'b',closes)?.mvpPoints,5);
 const empty=fixture();assert.deepEqual(mvpWinners(empty.s,empty.e,closes),[]);
 const single=fixture('singles');await single.vote('b','a');
 assert.equal(points(single.s,'a',closes,singlesLeaderboard)?.mvpPoints,5);assert.equal(points(single.s,'a',closes)?.mvpPoints??0,0);
});

test('votes are named for administrators and the owner only, not for an organiser who is a member',async()=>{
 const {s,vote}=fixture();await vote('b','a');
 const member=projectClubState(s,s.accounts.find(a=>a.id==='c')!,'2027-05',2027,end+2*hour).awardVotes[0];
 assert.ok(!('voterPlayerId' in member)&&member.voterId==='','members see counts only');
 const host=projectClubState(s,s.accounts.find(a=>a.id==='host')!,'2027-05',2027,end+2*hour).awardVotes[0];assert.ok(!('voterPlayerId' in host),'a member organiser sees counts only');
 for(const id of ['owner']){const v=projectClubState(s,s.accounts.find(a=>a.id===id)!,'2027-05',2027,end+2*hour).awardVotes[0] as {voterPlayerId?:string};assert.equal(v.voterPlayerId,'p-b')}
});

test('the MVP is told once on opening the app and a positive owner grant too; acknowledging hides them',async()=>{
 const {s,vote}=fixture();await vote('b','a');
 const a=()=>s.accounts.find(x=>x.id==='a')!;
 assert.deepEqual(bonusNotices(s,a(),closes-1),[]);
 const notice=bonusNotices(s,a(),closes);assert.deepEqual(notice.map(n=>[n.kind,n.points,n.title]),[['mvp',5,'周六双打']]);
 assert.equal(bonusNotices(s,a(),closes+15*24*hour).length,0,'old notices are not brought up again');
 await apply(s,a(),'bonusSeen',{ids:notice.map(n=>n.id)},closes+1);assert.deepEqual(bonusNotices(s,a(),closes+2),[]);
 await apply(s,s.accounts.find(x=>x.id==='owner')!,'grantPoints',{playerId:'p-a',period:'2027-05',points:3,reason:'帮忙订场'},closes+3);
 await apply(s,s.accounts.find(x=>x.id==='owner')!,'grantPoints',{playerId:'p-a',period:'2027-05',points:-2,reason:'扣分'},closes+4);
 assert.deepEqual(bonusNotices(s,a(),closes+5).map(n=>[n.kind,n.points,n.title]),[['grant',3,'帮忙订场']]);
 const view=projectClubState(s,a(),'2027-05',2027,closes+5);assert.equal(view.me.bonusNotices.length,1);
});

test('legacy votes outside the allowed time window cannot change the MVP or earn points',async()=>{
 const {s,e,vote}=fixture();await vote('b','a');
 for(const [i,at] of [start-1,closes,closes+hour].entries())s.awardVotes.push({id:'legacy-'+i,eventId:e.id,voterId:'legacy-'+i,playerId:'p-b',category:'mvp',at});
 const before=structuredClone(s);assert.deepEqual(mvpWinners(s,e,closes+2*hour),['p-a']);assert.equal(points(s,'a',closes+2*hour)?.mvpPoints,5);assert.equal(points(s,'b',closes+2*hour)?.mvpPoints,0);assert.deepEqual(s,before,'historical votes are retained unchanged');
});

test('practice, tournament, cancelled, draft and deleted activities never produce MVP points or notices',async()=>{
 for(const kind of ['practice','tournament','cancelled','draft','deleted']){const {s,e,vote}=fixture();await vote('b','a');if(kind==='practice')e.matchFormat='practice';if(kind==='tournament')e.tournament={status:'draft'} as never;if(kind==='cancelled'||kind==='draft')e.status=kind;if(kind==='deleted')e.deletedAt=end;assert.equal(points(s,'a',closes)?.mvpPoints,0,kind);assert.deepEqual(bonusNotices(s,s.accounts.find(a=>a.id==='a')!,closes),[],kind)}
});

test('club response validators expire at the MVP closing boundary without any write',async()=>{
 const {s,vote}=fixture();await vote('b','a');assert.equal(clubViewValidUntil(s,s.accounts[0],closes-60000),closes);
});
