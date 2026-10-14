import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Match} from '../lib/domain/types';
import {realmLedger,type RatedGame} from '../lib/domain/realm-rating';
import {annualLeaderboard,doublesAnnualLeaderboard,doublesQuarterlyLeaderboard,leaderboard,singlesAnnualLeaderboard} from '../lib/domain/ranking';
import {gamePoints,scoreSeasonGames,winningStreakBonus} from '../lib/domain/season-points';
import {projectClubState} from '../lib/club-view';
import {clubViewValidUntil} from '../lib/club-read-cache';
import {nextQuarterStart} from '../lib/ranking-quarter';

const now=Date.parse('2028-01-01T00:00:00Z');
function fixture(){
 const s=emptyState();
 for(const id of ['A','B','C','D']){s.players.push({id,name:id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});s.accounts.push({id,email:'',role:'member',playerId:id})}
 return s;
}
function match(id:string,start:string,won=true,singles=false,games?:{a:number;b:number}[]):Match{
 const at=Date.parse(start),scores=games??[{a:won?21:10,b:won?10:21}];
 return {id,eventId:'event-'+id,roundId:'round-'+id,courtId:'court',a:singles?['A']:['A','B'],b:singles?['C']:['C','D'],status:'complete',start:at,end:at+60000,scoreA:scores.length>1?scores.filter(g=>g.a>g.b).length:scores[0].a,scoreB:scores.length>1?scores.filter(g=>g.b>g.a).length:scores[0].b,games:scores,monthly:true,elo:true,locked:false,enteredBy:'A'};
}
function row(s:ReturnType<typeof fixture>){return doublesQuarterlyLeaderboard(s,'2026-Q4',now).find(r=>r.playerId==='A')!}

test('winning bonus starts on the second win and caps at three, stacking only on wins',()=>{
 assert.deepEqual([-1,0,1,2,3,4,5,100,NaN,Infinity,1.5].map(winningStreakBonus),[0,0,0,1,2,3,3,3,0,0,0]);
 const upset={won:true,team:1000,opponent:1150};assert.deepEqual([1,2,3,4,8].map(n=>gamePoints(upset,n)),[5,6,7,8,8]);assert.equal(gamePoints({...upset,won:false},8),-1);
});

test('consecutive rated games earn 0, 1, 2, 3, 3; a loss resets without changing sporting facts or Elo',()=>{
 const s=fixture();for(let i=0;i<5;i++)s.matches.push(match('win-'+i,`2026-10-0${i+1}T12:00:00Z`));
 const history=structuredClone(s),elo=realmLedger(s,now);const a=row(s);
 assert.deepEqual([a.points,a.streakPoints,a.upsetPoints,a.games,a.wins],[24,9,0,5,5]);
 assert.deepEqual(s,history);assert.deepEqual(realmLedger(s,now),elo);
 s.matches.push(match('loss','2026-10-06T12:00:00Z',false),match('again-1','2026-10-07T12:00:00Z'),match('again-2','2026-10-08T12:00:00Z'));
 assert.equal(row(s).streakPoints,10);assert.equal(row(s).wins,7);assert.equal(row(s).losses,1);
});

test('a best-of-three counts each played game; correcting and voiding an earlier result rebuilds later bonuses',()=>{
 const s=fixture();s.matches.push(match('best-three','2026-10-01T12:00:00Z',true,false,[{a:21,b:10},{a:10,b:21},{a:21,b:10}]),match('later','2026-10-02T12:00:00Z'));
 assert.deepEqual([row(s).wins,row(s).losses,row(s).streakPoints],[3,1,1]);
 s.matches[0].games=[{a:21,b:10},{a:21,b:10}];s.matches[0].scoreA=2;s.matches[0].scoreB=0;
 assert.deepEqual([row(s).wins,row(s).losses,row(s).streakPoints],[3,0,3]);
 s.matches[0].status='cancelled';assert.deepEqual([row(s).wins,row(s).streakPoints,row(s).points],[1,0,3]);
});

test('singles and doubles streaks stay independent even on the combined compatibility board',()=>{
 const s=fixture();s.matches.push(match('double-1','2026-10-01T12:00:00Z'),match('single-loss','2026-10-02T12:00:00Z',false,true),match('double-2','2026-10-03T12:00:00Z'),match('single-win','2026-10-04T12:00:00Z',true,true),match('double-3','2026-10-05T12:00:00Z'));
 const doubles=doublesAnnualLeaderboard(s,2026,now).find(r=>r.playerId==='A')!,singles=singlesAnnualLeaderboard(s,2026,now).find(r=>r.playerId==='A')!,all=annualLeaderboard(s,2026,now).find(r=>r.playerId==='A')!;
 assert.equal(doubles.streakPoints,3);assert.equal(singles.streakPoints,0);assert.equal(all.streakPoints,3);assert.equal(all.points,doubles.points+singles.points);
});

test('Madrid quarter boundaries reset streaks; month views keep prior wins in the same quarter and annual totals add up',()=>{
 const s=fixture();s.matches.push(match('jan','2026-01-31T12:00:00Z'),match('feb','2026-02-01T12:00:00Z'),match('q1-last','2026-03-31T21:59:00Z'),match('q2-first','2026-03-31T22:00:00Z'),match('q2-next','2026-04-02T12:00:00Z'));
 assert.equal(leaderboard(s,'2026-02',now).find(r=>r.playerId==='A')!.streakPoints,1);
 const q1=doublesQuarterlyLeaderboard(s,'2026-Q1',now).find(r=>r.playerId==='A')!,q2=doublesQuarterlyLeaderboard(s,'2026-Q2',now).find(r=>r.playerId==='A')!,year=doublesAnnualLeaderboard(s,2026,now).find(r=>r.playerId==='A')!;
 assert.equal(q1.streakPoints,3);assert.equal(q2.streakPoints,1);assert.equal(year.streakPoints,4);assert.equal(year.points,q1.points+q2.points);
});

test('friendly, handicap, cancelled, unfinished and future results do not affect streaks; no-show losses do',()=>{
 const s=fixture();s.matches.push(match('first','2026-10-01T12:00:00Z'));
 s.matches.push({...match('friendly','2026-10-02T12:00:00Z',false),monthly:false}, {...match('handicap','2026-10-03T12:00:00Z',false),handicap:{side:'a',points:2,applied:true}}, {...match('cancel','2026-10-04T12:00:00Z',false),status:'cancelled'}, {...match('playing','2026-10-05T12:00:00Z',false),status:'playing'},match('future','2029-10-01T12:00:00Z',false),match('second','2026-10-06T12:00:00Z'));
 assert.equal(row(s).streakPoints,1);
 s.matches.push({...match('absent','2026-10-07T12:00:00Z',false),status:'forfeit',noShow:['A']},match('after-absence','2026-10-08T12:00:00Z'));
 assert.equal(row(s).streakPoints,1);assert.equal(row(s).losses,1);
 const b=doublesQuarterlyLeaderboard(s,'2026-Q4',now).find(r=>r.playerId==='B')!;assert.equal(b.streakPoints,3,'Present partner receives no fake forfeit result or broken streak');
});

test('pending points include the same streak award; settling the activity does not add it twice',()=>{
 const s=fixture(),at=Date.parse('2026-10-06T13:00:00Z');s.matches.push(match('settled','2026-10-05T12:00:00Z'),match('pending','2026-10-06T12:00:00Z'));
 s.events.push({id:'event-pending',title:'Pending',start:at-7200000,end:at+3600000,venue:'',address:'',capacity:4,signupDeadline:at,cancelDeadline:at,note:'',status:'live',courtMode:'equal',ballMode:'equal'});
 const read=(time:number)=>projectClubState(s,s.accounts[0],'2026-10',2026,time).quarterlyLeaderboard.find(r=>r.playerId==='A')!;
 assert.deepEqual([read(at).points,read(at).streakPoints,read(at).pendingPoints,read(at).pendingGames],[7,1,4,1]);
 assert.deepEqual([read(at+7200000).points,read(at+7200000).streakPoints,read(at+7200000).pendingPoints],[7,1,0]);
});

test('replay order is deterministic for tied finish times and scopes isolate every player',()=>{
 const make=(id:string,index:number,won:boolean,playerId='A'):RatedGame=>({matchId:id,eventId:'event',gameIndex:index,playerId,side:'a',won,before:1000,after:1000,delta:0,k:16,expected:.5,opponent:1000,team:1000,start:1,end:2,margin:0,settled:true,reset:false});
 const games=[make('z',0,true),make('a',1,true),make('a',0,true),make('a',0,true,'B')];
 const scored=scoreSeasonGames(games,()=> 'quarter:singles');assert.deepEqual(scored.filter(r=>r.game.playerId==='A').map(r=>r.streakPoints),[0,1,2]);assert.equal(scored.find(r=>r.game.playerId==='B')!.streakPoints,0);assert.equal(games[0].matchId,'z');
});

test('avatar fire uses current-quarter rated streaks even when the selected leaderboard is historical',()=>{
 const s=fixture();s.matches.push(match('first','2026-10-01T12:00:00Z'),match('second','2026-10-02T12:00:00Z'));
 const at=Date.parse('2026-10-03T12:00:00Z'),view=projectClubState(s,s.accounts[0],'2025-01',2025,at);
 assert.deepEqual(view.players.find(p=>p.id==='A')!.winningStreak,{singles:0,doubles:2});
 s.matches.push(match('loss','2026-10-03T14:00:00Z',false));
 assert.equal(projectClubState(s,s.accounts[0],'2025-01',2025,at+3*3600000).players.find(p=>p.id==='A')!.winningStreak.doubles,0);
 const next=projectClubState(s,s.accounts[0],'2026-10',2026,Date.parse('2026-12-31T23:00:00Z'));
 assert.deepEqual(next.players.find(p=>p.id==='C')!.winningStreak,{singles:0,doubles:0},'Historical winning runs do not persist into the new quarter');
});

test('disabled and friend profiles get no fire; hidden draft results cannot reveal an avatar streak',()=>{
 const s=fixture();s.matches.push(match('first','2026-10-01T12:00:00Z'),match('second','2026-10-02T12:00:00Z'));
 s.players.find(p=>p.id==='B')!.enabled=false;s.accounts=s.accounts.filter(a=>a.playerId!=='B');
 const at=Date.parse('2026-10-03T12:00:00Z');
 const visible=projectClubState(s,s.accounts[0],'2026-10',2026,at);assert.deepEqual(visible.players.find(p=>p.id==='B')!.winningStreak,{singles:0,doubles:0});
 for(const m of s.matches)s.events.push({id:m.eventId,title:'Hidden draft',creatorId:'C',start:m.start!,end:m.end!,capacity:4,venue:'',address:'',signupDeadline:m.start!,cancelDeadline:m.start!,note:'',status:'draft',courtMode:'equal',ballMode:'equal'});
 assert.deepEqual(projectClubState(s,s.accounts[0],'2026-10',2026,at).players.find(p=>p.id==='A')!.winningStreak,{singles:0,doubles:0});
 assert.equal(projectClubState(s,s.accounts.find(a=>a.id==='C')!,'2026-10',2026,at).players.find(p=>p.id==='A')!.winningStreak.doubles,2,'The draft creator may see the authorized results');
});

test('conditional reads expire exactly at the Madrid quarter reset in both summer and winter',()=>{
 assert.equal(nextQuarterStart('2026-03'),Date.parse('2026-03-31T22:00:00Z'));assert.equal(nextQuarterStart('2026-12'),Date.parse('2026-12-31T23:00:00Z'));
 const s=fixture(),boundary=nextQuarterStart('2026-03');assert.equal(clubViewValidUntil(s,s.accounts[0],boundary-1),boundary);
});
