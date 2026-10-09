import test from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Account} from '../lib/domain/types';
import {leaderboard,quarterlyLeaderboard,annualLeaderboard,replayRating} from '../lib/domain/ranking';
import {pointGrants,ratingAdjustments} from '../lib/domain/point-grants';
import {realmByScore,realmPolicy,realmSnapshot,replayRealmScores} from '../lib/domain/realm-rating';
import {projectClubState} from '../lib/club-view';
const owner:Account={id:'owner',playerId:'p0',role:'admin',email:''};
const admin:Account={id:'admin',playerId:'p1',role:'admin',email:''};
const member:Account={id:'member',playerId:'p2',role:'member',email:''};
const now=Date.UTC(2026,9,8),grant={playerId:'p2',period:'2026-10',points:25,reason:'活动组织奖励'};
function fixture(){const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=owner.id;s.accounts=[owner,admin,member].map(a=>({...a}));s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));return s;}
for(const actor of [admin,member])test(actor.role+'不能加分，即使伪造群主字段',async()=>{const s=fixture(),before=structuredClone(s);await assert.rejects(()=>apply(s,{...actor,isOwner:true} as Account,'grantPoints',{...grant,actor:owner.id,ownerAccountId:owner.id},now),/403/);assert.deepEqual(s,before)});
test('群主加分落入持久审计，排名改变但胜场、段位分和实力不变',async()=>{const s=fixture(),before=leaderboard(s,grant.period).find(r=>r.playerId==='p2')!;await apply(s,owner,'grantPoints',{...grant,actor:'attacker',id:'fake'},now);const row=leaderboard(s,grant.period).find(r=>r.playerId==='p2')!;assert.equal(row.points,25);assert.equal(row.manualPoints,25);assert.equal(row.matchPoints,0);assert.equal(row.rank,1);assert.equal(row.games,0);assert.equal(row.wins,0);assert.equal(row.rating,before.rating);assert.deepEqual(row.realmScore,before.realmScore);const ledger=pointGrants(s);assert.equal(ledger.length,1);assert.equal(ledger[0].actor,owner.id);assert.notEqual(ledger[0].id,'fake');assert.equal(ledger[0].reason,grant.reason);assert.equal(ledger[0].at,now)});
test('月份边界与跨季度、年度汇总互不串分，重算后仍保留加分',async()=>{const s=fixture();for(const [period,points]of [['2026-09',11],['2026-10',25],['2026-12',7],['2027-01',4]] as const)await apply(s,owner,'grantPoints',{...grant,period,points},now);replayRating(s);const points=(rows:ReturnType<typeof leaderboard>)=>rows.find(r=>r.playerId==='p2')!.points;assert.equal(points(leaderboard(s,'2026-10')),25);assert.equal(points(quarterlyLeaderboard(s,'2026-Q4')),32);assert.equal(points(quarterlyLeaderboard(s,'2026-Q3')),11);assert.equal(points(annualLeaderboard(s,2026)),43);assert.equal(points(annualLeaderboard(s,2027)),4)});
test('加分不受比赛小局封顶影响，历史规则重算不会覆盖加分',async()=>{const s=fixture();s.settings.rules.cap=1;s.seasons.push({id:grant.period,rules:{...s.settings.rules}});await apply(s,owner,'grantPoints',grant,now);await apply(s,owner,'historyRules',{season:grant.period,rules:{...s.settings.rules,win:1},reason:'规则更新'},now);assert.equal(leaderboard(s,grant.period).find(r=>r.playerId==='p2')!.points,25)});
test('拒绝无效分数、月份、原因以及不存在或已停用球友，无部分写入',async()=>{for(const bad of [{points:0},{points:-1001},{points:1.5},{points:1001},{points:'25'},{points:NaN},{period:'2026-13'},{period:'1999-12'},{period:'2101-01'},{reason:'x'.repeat(501)},{playerId:'missing'}]){const s=fixture(),before=structuredClone(s);await assert.rejects(()=>apply(s,owner,'grantPoints',{...grant,...bad},now));assert.deepEqual(s,before)}const s=fixture();s.players[2].enabled=false;await assert.rejects(()=>apply(s,owner,'grantPoints',grant,now),/停用/);assert.equal(s.audits.length,0)});
test('仅群主投影提供加分记录，所有球友可以看到排名加分明细',async()=>{const s=fixture();await apply(s,owner,'grantPoints',grant,now);for(const a of [owner,admin,member]){const v=projectClubState(s,a,grant.period,2026,now);assert.equal(v.pointGrants.length,a===owner?1:0);assert.equal(v.quarterlyLeaderboard.find(r=>r.playerId==='p2')!.manualPoints,25)}});
test('普通审计和损坏的旧记录不会被当作加分',()=>{const s=fixture();s.audits.push({id:'a',actor:owner.id,action:'rating',at:now,reason:'旧记录',changes:grant},{id:'b',actor:owner.id,action:'grantPoints',at:now,reason:'损坏记录',changes:{...grant,points:0}});assert.equal(pointGrants(s).length,0)});
test('比赛积分与手动加分相加，胜率和出场数完全沿用比赛',async()=>{const s=fixture();s.players.push({...s.players[0],id:'p3'});s.matches.push({id:'match',eventId:'event',roundId:'round',courtId:'court',a:['p2','p3'],b:['p0','p1'],status:'complete',start:now,end:now+60000,scoreA:21,scoreB:10,monthly:true,elo:true,locked:false,enteredBy:owner.id,games:[{a:21,b:10}]});const before=leaderboard(s,grant.period).find(r=>r.playerId==='p2')!;await apply(s,owner,'grantPoints',grant,now);const after=leaderboard(s,grant.period).find(r=>r.playerId==='p2')!;assert.equal(after.points,before.points+25);assert.equal(after.matchPoints,before.points);assert.equal(before.points,3);assert.equal(after.wins,before.wins);assert.equal(after.games,before.games);assert.equal(after.rate,before.rate);assert.deepEqual(after.realmScore,before.realmScore)});
for(const actor of [admin,member])test(actor.role+'不能扣积分或伪造群主身份',async()=>{const s=fixture(),before=structuredClone(s);await assert.rejects(()=>apply(s,{...actor,isOwner:true} as Account,'grantPoints',{...grant,points:-30,actor:owner.id},now),/403/);assert.deepEqual(s,before)});
test('群主扣分保留历史加分，允许低于0并在对应季度年度汇总，不影响段位分与实力',async()=>{const s=fixture(),before=leaderboard(s,grant.period).find(r=>r.playerId==='p2')!;await apply(s,owner,'grantPoints',grant,now);await apply(s,owner,'grantPoints',{...grant,points:-35,reason:'更正奖励'},now+1);for(const rows of [leaderboard(s,grant.period),quarterlyLeaderboard(s,'2026-Q4'),annualLeaderboard(s,2026)]){const row=rows.find(r=>r.playerId==='p2')!;assert.equal(row.points,-10);assert.equal(row.manualPoints,-10);assert.equal(row.games,0);assert.equal(row.rating,before.rating);assert.deepEqual(row.realmScore,before.realmScore)}assert.deepEqual(pointGrants(s).map(g=>g.points),[25,-35]);assert.equal(pointGrants(s)[1].actor,owner.id);assert.equal(leaderboard(s,'2026-11').find(r=>r.playerId==='p2')!.points,0)});
test('最多扣1000分可持久化，不接受零值或越界扣分',async()=>{const s=fixture();await apply(s,owner,'grantPoints',{...grant,points:-1000},now);assert.equal(leaderboard(s,grant.period).find(r=>r.playerId==='p2')!.points,-1000);for(const points of [-1001,0,-1.5]){const before=structuredClone(s);await assert.rejects(()=>apply(s,owner,'grantPoints',{...grant,points},now));assert.deepEqual(s,before)}});
test('群主可单独调整段位分：立即改变段位分、境界和双打分组实力，不计入比赛局数和赛季积分',async()=>{
 const s=fixture();s.players.push({...s.players[0],id:'p3',name:'p3',ownerId:'owner'});
 // Ten earlier doubles wins (one per past day, no activity record) take p2 past placement.
 for(let i=0;i<10;i++)s.matches.push({id:'w'+i,eventId:'old'+i,roundId:'r',courtId:'c',a:['p2','p3'],b:['p0','p1'],status:'complete',start:now-(20-i)*86400000,end:now-(20-i)*86400000+60000,scoreA:21,scoreB:15,monthly:true,elo:true,locked:false,enteredBy:owner.id,games:[{a:21,b:15}]});
 replayRating(s,now);const before=realmSnapshot(s,now).get('p2')!,beforeRating=s.players.find(p=>p.id==='p2')!.rating;assert.equal(before.placement,false);
 await apply(s,owner,'grantPoints',{playerId:'p2',period:'2026-10',points:0,rating:150,reason:'定级修正'},now);
 const after=realmSnapshot(s,now+1).get('p2')!;
 assert.equal(after.score,before.score+150);assert.equal(after.realm,realmByScore(after.score));assert.equal(after.ratedGames,10,'a grant is not a game');
 assert.equal(s.players.find(p=>p.id==='p2')!.rating,beforeRating+150,'doubles grouping strength moves at once');
 const row=quarterlyLeaderboard(s,'2026-Q4',now+1).find(r=>r.playerId==='p2')!;assert.equal(row.manualPoints,0);assert.equal(row.realmScore.score,after.score);
 assert.deepEqual(pointGrants(s).map(g=>[g.points,g.rating]),[[0,150]]);
 // Points and 段位分 can be adjusted together; only the points reach the board.
 await apply(s,owner,'grantPoints',{playerId:'p2',period:'2026-10',points:5,rating:-20,reason:'双项调整'},now+2);
 assert.equal(realmSnapshot(s,now+3).get('p2')!.score,before.score+130);assert.equal(quarterlyLeaderboard(s,'2026-Q4',now+3).find(r=>r.playerId==='p2')!.manualPoints,5);
});
test('段位分调整的校验：两项不能都为0，超出±300拒绝，旧记录没有段位分时按0处理',async()=>{
 for(const bad of [{points:0,rating:0},{points:0},{rating:301},{rating:-301},{rating:1.5}]){const s=fixture(),before=structuredClone(s);await assert.rejects(()=>apply(s,owner,'grantPoints',{...grant,...bad},now));assert.deepEqual(s,before)}
 const s=fixture();s.audits.push({id:'legacy',actor:owner.id,action:'grantPoints',at:now,reason:'旧记录',changes:{...grant}});
 assert.deepEqual(pointGrants(s).map(g=>[g.points,g.rating]),[[25,0]]);assert.equal(realmSnapshot(s,now).get('p2')!.score,1000);
});
test('段位分调整按时间计入：之后的比赛从调整后的分数开始，三个月未打的重置会清掉之前的调整',async()=>{
 const s=fixture();s.players.push({...s.players[0],id:'p3',name:'p3',ownerId:'owner'});
 const at=Date.UTC(2026,5,1);s.audits.push({id:'g1',actor:owner.id,action:'grantPoints',at,reason:'调整',changes:{playerId:'p2',period:'2026-06',points:0,rating:100,reason:'调整'}});
 s.matches.push({id:'after',eventId:'e1',roundId:'r',courtId:'c',a:['p2','p3'],b:['p0','p1'],status:'complete',start:at+86400000,end:at+86400000+60000,scoreA:21,scoreB:15,monthly:true,elo:true,locked:false,enteredBy:owner.id,games:[{a:21,b:15}]});
 const games=replayRealmScores(s,()=>true,()=>true,realmPolicy.doubles,at+2*86400000,ratingAdjustments(s)).games.filter(g=>g.playerId==='p2');
 assert.equal(games[0].before,1100);assert.equal(games[0].team,1050,'the team average uses the adjusted score');
 assert.equal(realmSnapshot(s,Date.UTC(2026,8,3)).get('p2')!.score,1000,'three months after the last game everything restarts at 1000');
});
