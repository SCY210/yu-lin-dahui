import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cultivationProgress,cultivationRealm,cultivationRealms} from '../lib/domain/cultivation';
import {leaderboard,annualLeaderboard,quarterlyLeaderboard,replayRating} from '../lib/domain/ranking';
import {projectClubState} from '../lib/club-view';
import {playerStats,personality} from '../lib/domain/social';
import {emptyState,type Match,type Event} from '../lib/domain/types';

const start=Date.parse('2026-10-04T13:00:00Z');
function fixture(initialRating=1000){const s=emptyState();for(const id of ['A','B','C','D'])s.players.push({id,name:id,ownerId:id,initialRating,rating:initialRating,ratedGames:0,enabled:true,ratingReason:'测试'});return s}
function match(id:string,at=start):Match{return {id,eventId:'event',roundId:'round',courtId:'court',a:['A','B'],b:['C','D'],status:'complete',start:at,end:at+60000,scoreA:21,scoreB:19,monthly:true,elo:true,locked:false,enteredBy:'admin',games:[{a:21,b:19}]}}

test('所有默认初值球友显示炼气初期0%，各榜单和档案一致且不改写比赛或实力',()=>{
 assert.deepEqual(cultivationProgress(1000),{realm:'炼气',nextRealm:'筑基',stage:'初期',progressPercent:0});
 assert.deepEqual(Object.keys(cultivationProgress(1000)).sort(),['nextRealm','progressPercent','realm','stage']);
 const s=fixture();assert.deepEqual(playerStats(s,'A').cultivation,cultivationProgress(1000));
 assert.deepEqual(leaderboard(s,'2026-10')[0].cultivation,cultivationProgress(1000));
 assert.deepEqual(annualLeaderboard(s,2026)[0].cultivation,cultivationProgress(1000));
 assert.deepEqual(quarterlyLeaderboard(s,'2026-Q4')[0].cultivation,cultivationProgress(1000));
 const actor={id:'A',email:'',role:'member' as const,playerId:'A'};s.accounts.push(actor);
 const before=structuredClone(s),data=projectClubState(s,actor,'2026-10',2026);
 for(const row of data.social.stats){assert.equal(row.tier,'炼气');assert.deepEqual(row.cultivation,cultivationProgress(1000));}
 for(const rows of [data.leaderboard,data.quarterlyLeaderboard,data.annualLeaderboard])for(const row of rows){assert.equal(row.realm,'炼气');assert.deepEqual(row.cultivation,cultivationProgress(1000));assert.equal(row.rating,null);}
 assert.deepEqual(s,before);
});
test('境界进度在晋级边界归零，最高境界圆满且低值不会产生负百分比',()=>{
 for(const [rating,realm] of [[1099.99,'炼气'],[1100,'筑基'],[1231.999,'筑基'],[1232,'金丹'],[1299.999,'金丹'],[1300,'元婴'],[1379.999,'元婴'],[1380,'化神']] as const)assert.equal(cultivationRealm(rating),realm);
 for(const threshold of [1100,1232,1300])assert.equal(cultivationProgress(threshold).progressPercent,0);
 assert.equal(cultivationProgress(1231.999).progressPercent,99);
 assert.equal(cultivationProgress(-100).progressPercent,0);
 assert.deepEqual(cultivationProgress(1380),{realm:'化神',nextRealm:null,stage:'圆满',progressPercent:100});
 for(const rating of [-4000,0,800,899,900,1000,1032,1100,1180,4000]){const p=cultivationProgress(rating);assert.ok(Number.isFinite(p.progressPercent));assert.ok(p.progressPercent>=0&&p.progressPercent<=100)}
});
test('保留五级境界，初始值以下始终炼气0%且比赛后能正常成长',()=>{
 assert.deepEqual(cultivationRealms.map(r=>r.name),['炼气','筑基','金丹','元婴','化神']);
 for(const rating of [0,800,900,984,1000])assert.deepEqual(cultivationProgress(rating),{realm:'炼气',nextRealm:'筑基',stage:'初期',progressPercent:0});
 assert.deepEqual(cultivationProgress(1016),{realm:'炼气',nextRealm:'筑基',stage:'初期',progressPercent:16});
 assert.equal(cultivationProgress(1099.999).progressPercent,99);
});
test('K32同实力首胜仍真实增加16Elo，同时仅增加3月榜积分',()=>{
 const s=fixture();s.matches.push(match('1'));const changes=replayRating(s);
 assert.equal(s.settings.rules.k,32);assert.equal(changes.find(c=>c.playerId==='A')?.delta,16);
 assert.equal(s.players[0].rating,1016);assert.equal(cultivationProgress(s.players[0].rating).progressPercent,16);
 assert.equal(leaderboard(s,'2026-10').find(r=>r.playerId==='A')?.points,3);
 assert.equal(annualLeaderboard(s,2026).find(r=>r.playerId==='A')?.points,3);
 assert.equal(changes.reduce((total,c)=>total+c.delta,0),0);
});
test('筑基后期仍可通过真实比赛晋级金丹，不提高K或重置实力',()=>{
 assert.equal(cultivationRealm(1200+16*2),'金丹');
 const s=fixture(1200),initial=s.players.map(p=>p.initialRating);s.matches.push(match('1'),match('2',start+60000));
 replayRating(s);assert.equal(cultivationRealm(s.players[0].rating),'筑基');assert.equal(cultivationProgress(s.players[0].rating).progressPercent,98);
 s.matches.push(match('3',start+120000));replayRating(s);
 assert.equal(cultivationRealm(s.players[0].rating),'金丹');assert.ok(s.players[0].rating>1243&&s.players[0].rating<1244);
 assert.deepEqual(s.players.map(p=>p.initialRating),initial);assert.ok(s.ratingChanges.every(c=>c.k===32));
 assert.equal(leaderboard(s,'2026-10').find(r=>r.playerId==='A')?.points,9);assert.equal(annualLeaderboard(s,2026).find(r=>r.playerId==='A')?.points,9);
 const rating=s.players.map(p=>p.rating);replayRating(s);assert.deepEqual(s.players.map(p=>p.rating),rating);
});
test('失败反映真实修为回落，友谊赛不会制造境界成长或积分',()=>{
 const s=fixture(),loss=match('loss');loss.scoreA=19;loss.scoreB=21;loss.games=[{a:19,b:21}];s.matches.push(loss);
 replayRating(s);assert.equal(s.players[0].rating,984);assert.equal(cultivationProgress(984).progressPercent,0);
 const friendly=match('friendly',start+60000);friendly.elo=false;friendly.monthly=false;s.matches.push(friendly);replayRating(s);
 assert.equal(s.players[0].rating,984);assert.equal(s.players[0].ratedGames,1);assert.equal(leaderboard(s,'2026-10').find(r=>r.playerId==='A')?.points,0);
});
test('境界和修为不改变月度年度积分排序或真实并列名次',()=>{
 const s=fixture();s.players[0].rating=4000;s.players[1].rating=1400;s.players[2].rating=900;s.players[3].rating=0;
 const m=match('winners');m.a=['C','D'];m.b=['A','B'];s.matches.push(m);
 for(const rows of [leaderboard(s,'2026-10'),annualLeaderboard(s,2026)])assert.deepEqual(rows.map(r=>[r.playerId,r.rank,r.points]),[['C',1,3],['D',1,3],['A',3,0],['B',3,0]]);
});
test('自动预计出勤不产生早到或压线称号，手动和旧历史出勤保持实际记录',()=>{
 const s=fixture();const e:Event={id:'manual',creatorId:'A',title:'活动',start,end:start+3600000,venue:'测试',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'live',courtMode:'interval',ballMode:'interval'};
 s.events.push(e,{...e,id:'legacy'},{...e,id:'automatic'});
 s.attendance.push({id:'expected',eventId:'manual',playerId:'A',start:start-600000,end:null,state:'ready',source:'automatic'},
  {id:'actual',eventId:'manual',playerId:'A',start:start+120000,end:null,state:'ready'},
  {id:'legacy',eventId:'legacy',playerId:'A',start:start-300000,end:null,state:'ready'},
  {id:'only-expected',eventId:'automatic',playerId:'A',start,end:null,state:'ready',source:'automatic'});
 const p=personality(s,2026).find(p=>p.playerId==='A')!;assert.equal(p.early,1);assert.equal(p.onTime,1);
});
