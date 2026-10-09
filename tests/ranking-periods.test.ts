import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,defaultRules,type Match} from '../lib/domain/types';
import {annualLeaderboard,quarterlyLeaderboard,leaderboard,replayRating} from '../lib/domain/ranking';
import {rankingQuarter,quarterMonths,quarterLabel} from '../lib/ranking-quarter';
import {realmByScore,realms} from '../lib/domain/realm-rating';
import {getFeatureGuide} from '../lib/feature-guides';
import {projectClubState} from '../lib/club-view';
import {apply} from '../lib/domain/commands';

/** Far enough ahead that every fixture match has finished. */
const later=Date.parse('2028-06-01T00:00:00Z');
function fixture() {
 const s=emptyState();
 for(const [i,id] of ['A','B','C','D','E','F','G','H'].entries())s.players.push({id,name:id,ownerId:'account',initialRating:1400-i*100,rating:1400-i*100,ratedGames:i,enabled:true,ratingReason:'test'});
 s.accounts=s.players.map(p=>({id:'account-'+p.id,email:'',role:'member',playerId:p.id}));
 return s;
}
function match(id:string,at:string,a=21,b=10,teams=[['A','B'],['C','D']]):Match {
 const start=Date.parse(at);
 return {id,eventId:'event',roundId:'round',courtId:'court',a:teams[0],b:teams[1],status:'complete',start,end:start+60000,scoreA:a,scoreB:b,monthly:true,elo:true,locked:false,enteredBy:'account',games:[{a,b}]};
}

test('邀请的代报名朋友不入任何积分榜，正式成员战绩不受影响且名次重新排列',async()=>{
 const s=fixture(),actor=s.accounts[0];
 s.settings.rules={...s.settings.rules,win:10,loss:3,cap:0};
 await apply(s,actor,'friend',{name:'邀请朋友'},Date.parse('2026-10-06T12:00:00Z'));
 const guest=s.players.at(-1)!;
 assert.equal(guest.ownerId,actor.id);
 s.matches.push(match('with-guest','2026-10-06T13:00:00Z',21,19,[[guest.id,'A'],['B','C']]));
 const before=structuredClone(s);
 for(const rows of [leaderboard(s,'2026-10'),quarterlyLeaderboard(s,'2026-Q4'),annualLeaderboard(s,2026)]){
  assert.equal(rows.length,8);assert.ok(!rows.some(row=>row.playerId===guest.id));
  assert.equal(rows.find(row=>row.playerId==='A')!.points,3);
  assert.equal(rows.find(row=>row.playerId==='B')!.points,-1);
  assert.equal(rows.find(row=>row.playerId==='C')!.points,-1);
  assert.deepEqual(rows.map(row=>row.rank),[1,2,2,2,2,2,7,7]);
 }
 for(const role of ['admin','member'] as const){
  const view=projectClubState(s,{...actor,role},'2026-10',2026);
  for(const rows of [view.leaderboard,view.quarterlyLeaderboard,view.annualLeaderboard])assert.ok(!rows.some(row=>row.playerId===guest.id));
  assert.ok(view.players.some(p=>p.id===guest.id));
  assert.equal(view.social.stats.find(p=>p.playerId===guest.id)!.games,1);
 }
 assert.deepEqual(s,before);
});

test('朋友开通正式账号后能按原有比赛记录入榜，停用成员仍不入榜',()=>{
 const s=fixture(),guest={...s.players[0],id:'guest',name:'代报名朋友',ownerId:s.accounts[0].id};s.players.push(guest);
 s.matches.push(match('guest-history','2026-10-06T13:00:00Z',21,19,[[guest.id,'A'],['B','C']]));
 const history=structuredClone(s.matches);
 assert.ok(!annualLeaderboard(s,2026).some(row=>row.playerId===guest.id));
 s.accounts.push({id:'guest-login',email:'',role:'member',playerId:guest.id});guest.ownerId='guest-login';
 for(const rows of [leaderboard(s,'2026-10'),quarterlyLeaderboard(s,'2026-Q4'),annualLeaderboard(s,2026)])assert.equal(rows.find(row=>row.playerId===guest.id)!.games,1);
 guest.enabled=false;assert.ok(!annualLeaderboard(s,2026).some(row=>row.playerId===guest.id));
 assert.deepEqual(s.matches,history);
});

test('修仙境界按段位分五级门槛，与积分排名分开',()=>{
 for(const [score,realm] of [[0,'炼气'],[849,'炼气'],[850,'筑基'],[999,'筑基'],[1000,'金丹'],[1149,'金丹'],[1150,'元婴'],[1299,'元婴'],[1300,'化神'],[1600,'化神']] as const)assert.equal(realmByScore(score),realm);
 const s=fixture();s.matches.push(match('loss','2026-06-01T13:00:00Z',10,21));
 const before=structuredClone(s.players);
 const next=Date.parse('2026-06-02T00:00:00Z');
 assert.equal(leaderboard(s,'2026-06',next)[0].playerId,'C');
 assert.equal(annualLeaderboard(s,2026,next)[0].playerId,'C');
 assert.equal(annualLeaderboard(s,2026,next).find(r=>r.playerId==='A')?.realm,'筑基','984 after one loss, still placing');assert.equal(annualLeaderboard(s,2026,next).find(r=>r.playerId==='A')?.provisional,true);
 assert.deepEqual(s.players,before);
 assert.deepEqual(getFeatureGuide('rating').table?.rows,realms.map(r=>[r.name,r.range]));
});

test('年度按 Madrid 开赛年份计分，跨年结束仍归属开赛年',()=>{
 const s=fixture();
 const old=match('old','2025-12-31T22:59:00Z');old.end=Date.parse('2026-01-01T00:20:00Z');
 s.matches.push(old,match('local-new-year','2025-12-31T23:00:00Z'),match('local-next-year','2026-12-31T23:00:00Z'));
 assert.equal(annualLeaderboard(s,2025,later).find(r=>r.playerId==='A')?.games,1);
 assert.equal(annualLeaderboard(s,2026,later).find(r=>r.playerId==='A')?.games,1);
 assert.equal(annualLeaderboard(s,2027,later).find(r=>r.playerId==='A')?.games,1);
});

test('旧的月度上限与各月胜负分值不再生效，年度为各月积分之和',()=>{
 const s=fixture();
 s.settings.rules={...defaultRules,win:99,loss:88,cap:99};
 s.seasons.push({id:'2026-01',rules:{...defaultRules,win:3,loss:1,cap:2}},{id:'2026-02',rules:{...defaultRules,win:7,loss:2,cap:1}});
 s.matches.push(match('j3','2026-01-03T12:00:00Z',21,0),match('j2','2026-01-02T12:00:00Z',10,21),match('j1','2026-01-01T12:00:00Z'),match('f2','2026-02-02T12:00:00Z',0,21),match('f1','2026-02-01T12:00:00Z'));
 const annual=annualLeaderboard(s,2026).find(r=>r.playerId==='A')!;
 assert.deepEqual([annual.games,annual.wins,annual.losses,annual.total],[5,3,2,5]);
 assert.equal(annual.points,leaderboard(s,'2026-01').find(r=>r.playerId==='A')!.points+leaderboard(s,'2026-02').find(r=>r.playerId==='A')!.points);
 assert.equal(annual.rate,3/5);assert.equal(annual.margin,11/5);
});

test('年度全年胜率和净胜按计分场数加权，不平均月度比例',()=>{
 const s=fixture();s.settings.rules.cap=0;
 s.matches.push(match('jan','2026-01-01T12:00:00Z',21,10),match('feb1','2026-02-01T12:00:00Z',19,21),match('feb2','2026-02-02T12:00:00Z',18,21),match('feb3','2026-02-03T12:00:00Z',17,21));
 const r=annualLeaderboard(s,2026).find(r=>r.playerId==='A')!;
 assert.equal(r.rate,.25);assert.equal(r.margin,.5);
 assert.equal(r.games,4);assert.equal(r.points,3-1-1-1);
});

test('年度所有启用球友都入榜，排除非计分和非完整赛，保留实际场数',()=>{
 const s=fixture();s.settings.rules.minimum=99;s.players.find(p=>p.id==='H')!.enabled=false;
 const friendly={...match('friendly','2026-03-01T12:00:00Z'),monthly:false};
 const cancelled={...match('cancelled','2026-03-02T12:00:00Z'),status:'cancelled' as const};
 const forfeit={...match('forfeit','2026-03-03T12:00:00Z'),status:'forfeit' as const};
 const playing={...match('playing','2026-03-04T12:00:00Z'),status:'playing' as const};
 s.matches.push(friendly,cancelled,forfeit,playing,match('complete','2026-03-05T12:00:00Z'));
 const rows=annualLeaderboard(s,2026),a=rows.find(r=>r.playerId==='A')!,e=rows.find(r=>r.playerId==='E')!;
 assert.equal(rows.length,7);assert.ok(rows.every(r=>r.qualified));assert.equal(a.games,1);assert.equal(a.total,2);assert.equal(e.games,0);assert.equal(e.points,0);assert.equal(rows.find(r=>r.playerId==='H'),undefined);
 assert.equal(annualLeaderboard(s,2024).length,7);assert.ok(annualLeaderboard(s,2024).every(r=>r.rank===1));
});

test('年度按积分、胜率、场均净胜排序，三项相同并列且稳定跳号',()=>{
 const s=fixture();s.settings.rules={...defaultRules,win:0,loss:0,cap:0};
 s.matches.push(match('first','2026-05-01T12:00:00Z',21,15),match('second','2026-05-02T12:00:00Z',21,10,[['E','F'],['G','H']]));
 const rows=annualLeaderboard(s,2026);
 assert.deepEqual(rows.map(r=>[r.playerId,r.rank]),[['E',1],['F',1],['A',3],['B',3],['C',5],['D',5],['G',7],['H',7]]);
 assert.equal(rows[0].points,3);assert.equal(rows[0].rate,1);assert.equal(rows[0].margin,11);
});

test('同刻完赛按比赛编号确定回放顺序，旧上限不再截取，说明公开年度榜并保持总结独立',()=>{
 const s=fixture();s.settings.rules.cap=1;s.settings.rules.loss=0;
 s.matches.push(match('z-late-id','2026-07-01T12:00:00Z',21,0),match('a-first-id','2026-07-01T12:00:00Z',0,21));
 assert.equal(annualLeaderboard(s,2026).find(r=>r.playerId==='A')?.points,-1+3);replayRating(s,Date.parse('2026-07-02T00:00:00Z'));assert.equal(s.players[0].rating,1000-16+17,'a-first-id (loss) replays before z-late-id (win)');
 const guide=getFeatureGuide('annualRanking');
 assert.equal(guide.title,'年度积分与排名');assert.ok(guide.sections.some(section=>section.paragraphs?.some(p=>p.includes('没有月度或全年小局上限'))));
 assert.equal(getFeatureGuide('annual').title,'年度总结');
});

test('自然季度覆盖三个月，选择器跨年时仍能正确确定季度',()=>{
 for(let m=1;m<=12;m++)assert.equal(rankingQuarter('2026-'+String(m).padStart(2,'0')),'2026-Q'+Math.ceil(m/3));
 assert.deepEqual(quarterMonths('2026-Q1'),['2026-01','2026-02','2026-03']);assert.deepEqual(quarterMonths('2026-Q4'),['2026-10','2026-11','2026-12']);assert.equal(quarterLabel('2025-Q2'),'2025年第2季度（4–6月）');
 assert.throws(()=>quarterMonths('2026-Q5'));assert.throws(()=>rankingQuarter('2026-13'));
});
test('季度按马德里开赛时刻归属，跨季度结束不会移动积分',()=>{
 const s=fixture();s.settings.rules.cap=0;const q1=match('q1','2026-03-31T21:59:00Z');q1.end=Date.parse('2026-04-01T01:00:00Z');
 s.matches.push(q1,match('q2','2026-03-31T22:00:00Z'),match('q3','2026-06-30T22:00:00Z'),match('next-year','2026-12-31T23:00:00Z'));
 for(const q of ['2026-Q1','2026-Q2','2026-Q3','2027-Q1'])assert.equal(quarterlyLeaderboard(s,q,later).find(r=>r.playerId==='A')?.games,1);
 assert.equal(quarterlyLeaderboard(s,'2026-Q4',later).find(r=>r.playerId==='A')?.games,0);
});
test('季度汇总三个月的积分，友谊赛只保留实际场数',()=>{
 const s=fixture();s.settings.rules={...defaultRules,win:99,loss:88,cap:0};s.seasons.push({id:'2026-01',rules:{...defaultRules,win:3,loss:1,cap:2}},{id:'2026-02',rules:{...defaultRules,win:7,loss:2,cap:1}},{id:'2026-03',rules:{...defaultRules,win:4,loss:0,cap:0}});
 s.matches.push(match('j3','2026-01-03T12:00:00Z'),match('j2','2026-01-02T12:00:00Z',10,21),match('j1','2026-01-01T12:00:00Z'),match('f2','2026-02-02T12:00:00Z'),match('f1','2026-02-01T12:00:00Z'),match('march','2026-03-01T12:00:00Z'),{...match('friendly','2026-03-02T12:00:00Z'),monthly:false},match('outside','2026-04-01T12:00:00Z'));
 const r=quarterlyLeaderboard(s,'2026-Q1').find(r=>r.playerId==='A')!;assert.deepEqual([r.games,r.wins,r.losses,r.total],[6,5,1,7]);
 assert.equal(r.points,['2026-01','2026-02','2026-03'].reduce((sum,m)=>sum+leaderboard(s,m).find(p=>p.playerId==='A')!.points,0));
});
test('季度胜率和净胜按整体场数加权，年度等于四个季度积分之和',()=>{
 const s=fixture();s.settings.rules.cap=0;s.matches.push(match('jan','2026-01-01T12:00:00Z',21,10),match('feb1','2026-02-01T12:00:00Z',19,21),match('feb2','2026-02-02T12:00:00Z',18,21),match('feb3','2026-02-03T12:00:00Z',17,21),match('apr','2026-04-01T12:00:00Z'),match('jul','2026-07-01T12:00:00Z'),match('oct','2026-10-01T12:00:00Z'));
 const r=quarterlyLeaderboard(s,'2026-Q1').find(r=>r.playerId==='A')!;assert.equal(r.rate,.25);assert.equal(r.margin,.5);
 assert.equal(annualLeaderboard(s,2026).find(r=>r.playerId==='A')!.points,[1,2,3,4].reduce((sum,q)=>sum+quarterlyLeaderboard(s,'2026-Q'+q).find(p=>p.playerId==='A')!.points,0));
});
test('季度保持并列、启用成员、空榜和排名说明的正确口径',()=>{
 const s=fixture();s.settings.rules={...defaultRules,win:0,loss:0,cap:0};s.matches.push(match('first','2026-05-01T12:00:00Z',21,15),match('second','2026-05-02T12:00:00Z',21,10,[['E','F'],['G','H']]));
 assert.deepEqual(quarterlyLeaderboard(s,'2026-Q2').map(r=>[r.playerId,r.rank]),[['E',1],['F',1],['A',3],['B',3],['C',5],['D',5],['G',7],['H',7]]);
 s.players[7].enabled=false;assert.equal(quarterlyLeaderboard(s,'2025-Q1').length,7);assert.ok(quarterlyLeaderboard(s,'2025-Q1').every(r=>r.rank===1&&r.games===0));assert.equal(getFeatureGuide('ranking').title,'季度积分与排名');
});
test('季度响应标识所选季度，普通成员看不到精确实力分',()=>{
 const s=fixture();s.matches.push(match('quarter-response','2026-05-01T12:00:00Z'));const account={id:'account',email:'',role:'member' as const,playerId:'A'};
 const data=projectClubState(s,account,'2026-06',2026);assert.equal(data.rankingQuarter,'2026-Q2');assert.equal(data.quarterlyLeaderboard.find(r=>r.playerId==='A')!.points,3);assert.ok(data.quarterlyLeaderboard.every(r=>r.rating===null));
});
