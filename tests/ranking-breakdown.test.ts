import test from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Account,type Match} from '../lib/domain/types';
import {quarterlyLeaderboard,annualLeaderboard,singlesQuarterlyLeaderboard,replayRating} from '../lib/domain/ranking';
import {pointsBreakdown} from '../lib/client/ranking-breakdown';

const owner:Account={id:'owner',playerId:'p0',role:'admin',email:''};
const now=Date.UTC(2026,9,8);
const sum=(lines:{points:number}[])=>lines.reduce((n,line)=>n+line.points,0);

/** Fictional members: p2 and p3 win four of five games against p0 and p1, building a streak. */
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=owner.id;
 for(let i=0;i<4;i++){
  const id=i?'member'+i:'owner',rating=i<2?1300:1000;
  s.accounts.push({id,email:'',role:i?'member':'admin',playerId:'p'+i});
  s.players.push({id:'p'+i,name:'Fictional '+i,ownerId:id,initialRating:rating,rating,ratedGames:0,enabled:true,ratingReason:''});
 }
 const game=(i:number,win:boolean):Match=>({id:'m'+i,eventId:'event',roundId:'r'+i,courtId:'court',a:['p2','p3'],b:['p0','p1'],status:'complete',start:now-(10-i)*3600000,end:now-(10-i)*3600000+600000,scoreA:win?21:15,scoreB:win?15:21,monthly:true,elo:true,locked:false,enteredBy:owner.id,games:[{a:win?21:15,b:win?15:21}]});
 s.matches.push(game(0,true),game(1,true),game(2,true),game(3,false),game(4,true));
 replayRating(s,now);
 return s;
}

test('every source adds up to the ranking total, owner grants included',async()=>{
 const s=fixture();
 await apply(s,owner,'grantPoints',{playerId:'p2',period:'2026-10',points:25,reason:'Fictional reward'},now);
 await apply(s,owner,'grantPoints',{playerId:'p2',period:'2026-10',points:-8,reason:'Fictional correction'},now+1);
 for(const rows of [quarterlyLeaderboard(s,'2026-Q4',now+2),annualLeaderboard(s,2026,now+2),singlesQuarterlyLeaderboard(s,'2026-Q4',now+2)])for(const row of rows){
  const lines=pointsBreakdown(row);
  assert.equal(sum(lines),row.points,row.playerId+' adds up');
  assert.ok(!lines.some(line=>line.label==='其他调整'),row.playerId+': every point has a known source');
 }
 const p2=quarterlyLeaderboard(s,'2026-Q4',now+2).find(r=>r.playerId==='p2')!,labels=pointsBreakdown(p2).map(line=>line.label);
 assert.deepEqual(labels,['胜局 4 × 3','负局 1 × 1','连胜加分','群主调整']);
 assert.equal(pointsBreakdown(p2).find(line=>line.label==='群主调整')!.points,17);
 const p0=quarterlyLeaderboard(s,'2026-Q4',now+2).find(r=>r.playerId==='p0')!;
 assert.deepEqual(pointsBreakdown(p0).map(line=>[line.label,line.points]),[['胜局 1 × 3',3],['负局 4 × 1',-4],['强弱加成',1]],'one win against a pair rated higher at that moment carries an upset bonus');
});

test('zero sources are left out and an unexplained remainder still reconciles',()=>{
 assert.deepEqual(pointsBreakdown({points:0,wins:0,losses:0}),[]);
 assert.deepEqual(pointsBreakdown({points:11,wins:2,losses:1,upsetPoints:2,mvpPoints:5,attendancePoints:-1,bountyPoints:-1,notificationPoints:0}),[{label:'胜局 2 × 3',points:6},{label:'负局 1 × 1',points:-1},{label:'强弱加成',points:2},{label:'MVP 加分',points:5},{label:'悬赏',points:-1},{label:'迟到扣分',points:-1},{label:'其他调整',points:1}]);
 assert.deepEqual(pointsBreakdown({points:3}),[{label:'其他调整',points:3}],'a row without source fields');
});
