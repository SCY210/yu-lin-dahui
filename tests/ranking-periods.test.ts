import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,defaultRules,type Match} from '../lib/domain/types';
import {annualLeaderboard,leaderboard} from '../lib/domain/ranking';
import {cultivationRealm,cultivationRealms} from '../lib/domain/cultivation';
import {getFeatureGuide} from '../lib/feature-guides';

function fixture() {
 const s=emptyState();
 for(const [i,id] of ['A','B','C','D','E','F','G','H'].entries())s.players.push({id,name:id,ownerId:'account',initialRating:1400-i*100,rating:1400-i*100,ratedGames:i,enabled:true,ratingReason:'test'});
 return s;
}
function match(id:string,at:string,a=21,b=10,teams=[['A','B'],['C','D']]):Match {
 const start=Date.parse(at);
 return {id,eventId:'event',roundId:'round',courtId:'court',a:teams[0],b:teams[1],status:'complete',start,end:start+60000,scoreA:a,scoreB:b,monthly:true,elo:true,locked:false,enteredBy:'account',games:[{a,b}]};
}

test('修仙境界采用更紧凑五级门槛，与积分排名分开',()=>{
 for(const [rating,realm] of [[899.999,'炼气'],[900,'筑基'],[1031.999,'筑基'],[1032,'金丹'],[1099.999,'金丹'],[1100,'元婴'],[1179.999,'元婴'],[1180,'化神']] as const)assert.equal(cultivationRealm(rating),realm);
 const s=fixture();s.matches.push(match('loss','2026-06-01T13:00:00Z',10,21));
 const before=structuredClone(s.players);
 assert.equal(leaderboard(s,'2026-06')[0].playerId,'C');
 assert.equal(annualLeaderboard(s,2026)[0].playerId,'C');
 assert.equal(annualLeaderboard(s,2026).find(r=>r.playerId==='A')?.realm,'化神');
 assert.deepEqual(s.players,before);
 assert.deepEqual(getFeatureGuide('rating').table?.rows,cultivationRealms.map(r=>[r.name,r.range]));
});

test('年度按 Madrid 开赛年份计分，跨年结束仍归属开赛年',()=>{
 const s=fixture();
 const old=match('old','2025-12-31T22:59:00Z');old.end=Date.parse('2026-01-01T00:20:00Z');
 s.matches.push(old,match('local-new-year','2025-12-31T23:00:00Z'),match('local-next-year','2026-12-31T23:00:00Z'));
 assert.equal(annualLeaderboard(s,2025).find(r=>r.playerId==='A')?.games,1);
 assert.equal(annualLeaderboard(s,2026).find(r=>r.playerId==='A')?.games,1);
 assert.equal(annualLeaderboard(s,2027).find(r=>r.playerId==='A')?.games,1);
});

test('年度每月重置个人上限，使用不同月份的历史胜负分与上限',()=>{
 const s=fixture();
 s.settings.rules={...defaultRules,win:99,loss:88,cap:99};
 s.seasons.push({id:'2026-01',rules:{...defaultRules,win:3,loss:1,cap:2}},{id:'2026-02',rules:{...defaultRules,win:7,loss:2,cap:1}});
 s.matches.push(match('j3','2026-01-03T12:00:00Z',21,0),match('j2','2026-01-02T12:00:00Z',10,21),match('j1','2026-01-01T12:00:00Z'),match('f2','2026-02-02T12:00:00Z',0,21),match('f1','2026-02-01T12:00:00Z'));
 const annual=annualLeaderboard(s,2026).find(r=>r.playerId==='A')!;
 assert.deepEqual([annual.games,annual.wins,annual.losses,annual.total,annual.points],[3,2,1,5,11]);
 assert.equal(annual.points,leaderboard(s,'2026-01').find(r=>r.playerId==='A')!.points+leaderboard(s,'2026-02').find(r=>r.playerId==='A')!.points);
 assert.equal(annual.rate,2/3);assert.equal(annual.margin,11/3);
});

test('年度全年胜率和净胜按计分场数加权，不平均月度比例',()=>{
 const s=fixture();s.settings.rules.cap=0;
 s.matches.push(match('jan','2026-01-01T12:00:00Z',21,10),match('feb1','2026-02-01T12:00:00Z',19,21),match('feb2','2026-02-02T12:00:00Z',18,21),match('feb3','2026-02-03T12:00:00Z',17,21));
 const r=annualLeaderboard(s,2026).find(r=>r.playerId==='A')!;
 assert.equal(r.rate,.25);assert.equal(r.margin,.5);
 assert.equal(r.games,4);assert.equal(r.points,3);
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
 assert.equal(rows[0].points,0);assert.equal(rows[0].rate,1);assert.equal(rows[0].margin,11);
});

test('年度同刻计分赛按 ID 取上限，说明公开年度榜并保持总结独立',()=>{
 const s=fixture();s.settings.rules.cap=1;
 s.matches.push(match('z-late-id','2026-07-01T12:00:00Z',21,0),match('a-first-id','2026-07-01T12:00:00Z',0,21));
 assert.equal(annualLeaderboard(s,2026).find(r=>r.playerId==='A')?.points,0);
 const guide=getFeatureGuide('annualRanking');
 assert.equal(guide.title,'年度积分与排名');assert.ok(guide.sections.some(section=>section.paragraphs?.some(p=>p.includes('没有额外的全年场数上限'))));
 assert.equal(getFeatureGuide('annual').title,'年度总结');
});
