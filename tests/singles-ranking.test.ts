import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Account,type Match} from '../lib/domain/types';
import {annualLeaderboard,isDoublesMatch,isSinglesMatch,leaderboard,quarterlyLeaderboard,replayRating,singlesAnnualLeaderboard,singlesLeaderboard,singlesQuarterlyLeaderboard} from '../lib/domain/ranking';
import {projectClubState} from '../lib/club-view';
import {apply} from '../lib/domain/commands';
import {ClubNavigation,type NavigationPort} from '../lib/client/club-navigation';

const now=Date.parse('2026-10-08T12:00:00Z');
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.rules={...s.settings.rules,win:10,loss:-3,cap:0};
 for(const id of ['A','B','C','D','E'])s.players.push({id,name:id,ownerId:'account-'+id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'test'});
 s.accounts=s.players.map(p=>({id:'account-'+p.id,email:'',role:'member',playerId:p.id}));
 s.accounts[0].role='admin';s.settings.ownerAccountId=s.accounts[0].id;
 return s;
}
function match(id:string,at:string,a:string[],b:string[],games:{a:number;b:number}[]=[{a:21,b:10}]):Match{
 const start=Date.parse(at),multi=games.length>1;
 return {id,eventId:'event',roundId:'round',courtId:'court',a,b,status:'complete',start,end:start+60000,scoreA:multi?games.filter(g=>g.a>g.b).length:games[0].a,scoreB:multi?games.filter(g=>g.b>g.a).length:games[0].b,monthly:true,elo:true,locked:false,enteredBy:'account-A',games};
}
const row=(rows:{playerId:string}[],id:string)=>rows.find(r=>r.playerId===id) as ReturnType<typeof leaderboard>[number]|undefined;

test('单打只认每方各1名不同球友，双打只认2对2',()=>{
 assert.equal(isSinglesMatch({a:['A'],b:['B']}),true);
 assert.equal(isSinglesMatch({a:['A','B'],b:['C','D']}),false);
 assert.equal(isSinglesMatch({a:['A'],b:['A']}),false);
 assert.equal(isSinglesMatch({a:['A'],b:['B','C']}),false);
 assert.equal(isDoublesMatch({a:['A','B'],b:['C','D']}),true);
 assert.equal(isDoublesMatch({a:['A'],b:['B']}),false);
});

test('没有单打记录时单打榜为空，综合榜照常列出全部正式球友',()=>{
 const s=fixture();s.matches.push(match('d1','2026-10-06T13:00:00Z',['A','B'],['C','D']));
 assert.deepEqual(singlesLeaderboard(s,'2026-10'),[]);assert.deepEqual(singlesQuarterlyLeaderboard(s,'2026-Q4'),[]);assert.deepEqual(singlesAnnualLeaderboard(s,2026),[]);
 assert.equal(quarterlyLeaderboard(s,'2026-Q4').length,5);
});

test('单打榜只算单打小局的赛季积分，三局逐局结算，综合榜包含双打与单打',()=>{
 const s=fixture();
 s.matches.push(match('d1','2026-10-06T13:00:00Z',['A','B'],['C','D']));
 s.matches.push(match('s1','2026-10-06T14:00:00Z',['A'],['C'],[{a:21,b:15},{a:18,b:21},{a:21,b:19}]));
 s.matches.push(match('s2','2026-10-06T15:00:00Z',['D'],['E'],[{a:21,b:15},{a:18,b:21},{a:21,b:19}]));
 const singles=singlesQuarterlyLeaderboard(s,'2026-Q4',now);
 assert.deepEqual(singles.map(r=>r.playerId).sort(),['A','C','D','E'],'only players with singles appear; B played doubles only');
 const a=row(singles,'A')!,c=row(singles,'C')!;
 // After d1 A=1016, C=984. Win 3, loss 1 per game; A's first win puts A 62 ahead, so C's win earns the +1 upset bonus.
 assert.deepEqual([a.points,a.games,a.wins,a.losses,a.totalMatches,a.manualPoints],[3-1+3,3,2,1,1,0]);
 assert.deepEqual([c.points,c.games,c.wins,c.losses,c.upsetPoints],[-1+4-1,3,1,2,1]);
 assert.equal(a.rate,2/3);assert.equal(a.margin,(6-3+2)/3);
 // D 984 against E 1000 plays the same three games; E's win comes only 18 below D, so no bonus. A and D tie on every criterion.
 assert.deepEqual(singles.map(r=>[r.playerId,r.points,r.rank]),[['A',5,1],['D',5,1],['C',2,3],['E',1,4]]);
 const combined=quarterlyLeaderboard(s,'2026-Q4',now);
 assert.equal(combined.length,5,'combined board still lists every member');
 assert.equal(row(combined,'A')!.points,3+5,'combined board keeps doubles plus singles');assert.equal(row(combined,'B')!.points,3);
 assert.equal(row(combined,'A')!.games,4);
});

test('单打榜按马德里季度、年度归属；旧的月度上限与每胜分值不再生效',()=>{
 const s=fixture();s.settings.rules.cap=1;
 s.matches.push(match('d-early','2026-01-05T10:00:00Z',['A','B'],['C','D'],[{a:10,b:21}]));
 s.matches.push(match('s-jan-1','2026-01-06T10:00:00Z',['A'],['B']),match('s-jan-2','2026-01-07T10:00:00Z',['A'],['B'],[{a:5,b:21}]));
 s.matches.push(match('s-feb','2026-02-02T10:00:00Z',['A'],['B']));
 s.seasons.push({id:'2026-02',rules:{...s.settings.rules,win:4,cap:0}});
 s.matches.push(match('s-madrid-boundary','2026-03-31T22:30:00Z',['A'],['B']));
 // A: doubles loss 1, then singles win 3, loss 1, win 3, and a win 3 on 1 April Madrid time.
 const q1=row(singlesQuarterlyLeaderboard(s,'2026-Q1',now),'A')!;
 assert.deepEqual([q1.points,q1.games,q1.wins,q1.total,q1.totalMatches],[3-1+3,3,2,3,3]);
 const q2=row(singlesQuarterlyLeaderboard(s,'2026-Q2',now),'A')!;assert.equal(q2.points,3,'Madrid 00:30 on 1 April belongs to Q2');
 const year=row(singlesAnnualLeaderboard(s,2026,now),'A')!;assert.equal(year.points,q1.points+q2.points);
 assert.equal(row(singlesLeaderboard(s,'2026-01',now),'A')!.points,3-1);
 assert.equal(row(annualLeaderboard(s,2026,now),'A')!.points,-1+3-1+3+3,'combined board sums every rated game');
});

test('单打榜排除代报名朋友与停用球友，作废、未完成和其他人数的对局不计入',async()=>{
 const s=fixture();await apply(s,s.accounts[0],'friend',{name:'朋友'},now);const guest=s.players.at(-1)!;
 s.matches.push(match('guest','2026-10-06T13:00:00Z',[guest.id],['B']),match('disabled','2026-10-06T14:00:00Z',['E'],['C']));
 const voided=match('void','2026-10-06T15:00:00Z',['A'],['D']);voided.status='cancelled';
 const playing=match('playing','2026-10-06T16:00:00Z',['A'],['D']);playing.status='playing';
 s.matches.push(voided,playing,match('three','2026-10-06T17:00:00Z',['A'],['C','D']));
 s.players.find(p=>p.id==='E')!.enabled=false;
 const rows=singlesAnnualLeaderboard(s,2026,now);
 assert.deepEqual(rows.map(r=>r.playerId).sort(),['B','C']);
 assert.equal(row(rows,'B')!.points,-1,'the loss to the guest still counts for B, as on the main board');
 assert.ok(!rows.some(r=>r.playerId===guest.id||r.playerId==='E'||r.playerId==='A'));
});

test('群主手动积分只计入综合榜，不进入单打榜',async()=>{
 const s=fixture();s.matches.push(match('s1','2026-10-06T13:00:00Z',['A'],['B']));
 await apply(s,s.accounts[0],'grantPoints',{playerId:'B',period:'2026-10',points:30,reason:'组织奖励'},now);
 await apply(s,s.accounts[0],'grantPoints',{playerId:'C',period:'2026-10',points:5,reason:'组织奖励'},now);
 assert.equal(row(quarterlyLeaderboard(s,'2026-Q4',now),'B')!.points,30-1);
 const singles=singlesQuarterlyLeaderboard(s,'2026-Q4',now);
 assert.deepEqual(singles.map(r=>[r.playerId,r.points,r.manualPoints]),[['A',3,0],['B',-1,0]]);
});

test('单打不改变分组实力：分组实力只回放双打小局，重算不会因单打报错',()=>{
 const s=fixture();s.matches.push(match('s1','2026-10-06T13:00:00Z',['A'],['B']));
 assert.deepEqual(replayRating(s,now),[]);assert.ok(s.players.every(p=>p.rating===1000&&p.ratedGames===0));
 s.matches.push(match('d1','2026-10-06T14:00:00Z',['A','B'],['C','D']));
 assert.deepEqual(replayRating(s,now).map(c=>[c.playerId,c.delta]),[['A',16],['B',16],['C',-16],['D',-16]]);assert.equal(s.players.find(p=>p.id==='A')!.rating,1016);assert.equal(s.players.find(p=>p.id==='A')!.ratedGames,1);
});

test('群组投影提供季度与年度单打榜，普通球友看不到实力分',()=>{
 const s=fixture();s.matches.push(match('s1','2026-10-06T13:00:00Z',['A'],['B']),match('d1','2026-10-06T14:00:00Z',['A','B'],['C','D']));
 const admin=projectClubState(s,s.accounts[0] as Account,'2026-10',2026,now),member=projectClubState(s,s.accounts[1] as Account,'2026-10',2026,now);
 assert.deepEqual(admin.singlesQuarterlyLeaderboard.map(r=>r.playerId),['A','B']);assert.deepEqual(admin.singlesAnnualLeaderboard.map(r=>r.playerId),['A','B']);
 assert.ok(member.singlesQuarterlyLeaderboard.every(r=>r.rating===null));assert.ok(member.singlesAnnualLeaderboard.every(r=>r.rating===null));
 // Doubles board: d1 only. Team A,B (1016, 984) averages 1000 against C,D 1000 and wins (3); 段位分 A 1016 then 1032.
 assert.equal(admin.quarterlyLeaderboard.length,5);assert.equal(row(admin.quarterlyLeaderboard,'A')!.points,3);
 assert.equal(admin.social.stats.find(p=>p.playerId==='A')!.realmScore.score,1032);
 assert.deepEqual(projectClubState(s,s.accounts[1] as Account,'2026-04',2025,now).singlesQuarterlyLeaderboard,[]);
});

test('单打榜选择随浏览器历史保存，旧记录默认综合榜',()=>{
 let state:unknown=null,href='https://club.example/?page=ranking';
 const port:NavigationPort={href:()=>href,state:()=>state,push:(next,url)=>{state=next;href=new URL(url,href).href},replace:(next,url)=>{state=next;href=new URL(url,href).href},go:()=>{},scrollY:()=>0,scrollTo:()=>{}};
 const navigation=new ClubNavigation(port,'member-A','session-one');
 navigation.updateRankingSelection({period:'2026-10',year:2026,rankingPeriod:'annual',format:'singles'});
 assert.deepEqual(new ClubNavigation(port,'member-A','session-two').rankingSelection,{period:'2026-10',year:2026,rankingPeriod:'annual',format:'singles'});
 navigation.updateRankingSelection({period:'2026-10',year:2026,rankingPeriod:'quarterly',format:'bogus' as never});
 assert.deepEqual(new ClubNavigation(port,'member-A','session-three').rankingSelection,{period:'2026-10',year:2026,rankingPeriod:'quarterly'});
});

test('单打榜积分录入即时更新，行内境界与段位分和综合榜一样在活动结束后才结算',()=>{
 const s=fixture(),start=Date.parse('2026-10-06T13:00:00Z'),end=start+3*3600000,mid=start+3600000;
 s.events.push({id:'event',creatorId:'account-A',title:'单打活动',start,end,venue:'测试',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'live',courtMode:'interval',ballMode:'interval'});
 s.matches.push(match('s1','2026-10-06T13:00:00Z',['A'],['B']));
 for(const at of [mid,end]){
  const boards=[singlesLeaderboard(s,'2026-10',at),singlesQuarterlyLeaderboard(s,'2026-Q4',at),singlesAnnualLeaderboard(s,2026,at)];
  for(const rows of boards){const a=row(rows,'A')!;assert.equal(a.points,3);assert.equal(a.pendingPoints,at===mid?3:0);assert.equal(row(rows,'B')!.points,-1);assert.deepEqual(a.realmScore,row(leaderboard(s,'2026-10',at),'A')!.realmScore)}
 }
 const during=row(singlesLeaderboard(s,'2026-10',mid),'A')!.realmScore,after=row(singlesLeaderboard(s,'2026-10',end),'A')!.realmScore;
 assert.equal(during.pendingGames,1);assert.equal(during.pendingChange,16);assert.equal(during.score,1000);assert.equal(after.pendingGames,0);assert.equal(after.score,1016);
 const member={id:'account-C',email:'',role:'member' as const,playerId:'C'};
 assert.equal(projectClubState(s,member,'2026-10',2026,mid).singlesQuarterlyLeaderboard.find(r=>r.playerId==='A')!.realmScore.score,1000);
 assert.equal(projectClubState(s,member,'2026-10',2026,end).singlesQuarterlyLeaderboard.find(r=>r.playerId==='A')!.realmScore.score,1016);
});
