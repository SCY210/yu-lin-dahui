import {projectClubState} from '../lib/club-view';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cultivationProgress,cultivationRealm,cultivationRealms,cultivationSnapshot,enableWeeklyProgression} from '../lib/domain/cultivation';
import {leaderboard,annualLeaderboard,quarterlyLeaderboard,replayRating} from '../lib/domain/ranking';
import {playerStats,personality} from '../lib/domain/social';
import {emptyState,type Match,type Event} from '../lib/domain/types';
const start=Date.parse('2026-10-04T13:00:00Z'),now=start+20*86400000;
function fixture(){const s=emptyState();for(const id of ['A','B','C','D'])s.players.push({id,name:id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'测试'});s.accounts=s.players.map(p=>({id:p.ownerId,email:'',role:'member',playerId:p.id}));return s}
function match(id:string,at=start,win=true):Match{return {id,eventId:'event',roundId:'round',courtId:'court',a:['A','B'],b:['C','D'],status:'complete',start:at,end:at+60000,scoreA:win?21:19,scoreB:win?19:21,monthly:true,elo:true,locked:false,enteredBy:'admin',games:[{a:win?21:19,b:win?19:21}]}}
test('修为门槛及进度使用长期成长，低值和无穷值保持有效',()=>{
 assert.deepEqual(cultivationRealms.map(r=>r.minimum),[0,60,180,400,800]);
 for(const [xp,realm] of [[0,'炼气'],[59,'炼气'],[60,'筑基'],[179,'筑基'],[180,'金丹'],[399,'金丹'],[400,'元婴'],[799,'元婴'],[800,'化神']] as const)assert.equal(cultivationRealm(xp),realm);
 assert.equal(cultivationProgress(60).progressPercent,0);assert.equal(cultivationProgress(60).remaining,120);assert.equal(cultivationProgress(180).progressPercent,0);assert.equal(cultivationProgress(850).experience,850);assert.equal(cultivationProgress(850).progressPercent,100);
 for(const xp of [-100,NaN,Infinity])assert.equal(cultivationProgress(xp).experience,0);
});
test('一晚6小局3胜3负：榜单21、修为49，不用等待全群',()=>{
 const s=fixture();for(let i=0;i<6;i++)s.matches.push(match('m'+i,start+i*60000,i<3));
 const progress=cultivationSnapshot(s,now).get('A')!;assert.equal(progress.earned,49);assert.equal(progress.trainingDays,1);assert.equal(progress.wins,3);assert.equal(progress.losses,3);assert.equal(leaderboard(s,'2026-10').find(r=>r.playerId==='A')!.points,21);
 const before=structuredClone(s.matches);s.players.push({id:'absent',name:'缺席',ownerId:'other',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});assert.equal(cultivationSnapshot(s,now).get('A')!.experience,49);assert.equal(cultivationSnapshot(s,now).get('absent')!.experience,0);assert.deepEqual(s.matches,before);
});
test('三局两胜2:1按实际小局统计17与4分，实力每场仍更新一次',()=>{
 const s=fixture(),m=match('multi');m.games=[{a:21,b:19},{a:19,b:21},{a:21,b:19}];m.scoreA=2;m.scoreB=1;s.matches=[m];const changes=replayRating(s),rows=leaderboard(s,'2026-10');
 const a=rows.find(r=>r.playerId==='A')!,c=rows.find(r=>r.playerId==='C')!;assert.equal(a.points,17);assert.equal(c.points,4);assert.equal(a.games,3);assert.equal(a.wins,2);assert.equal(a.rate,2/3);assert.equal(c.rate,1/3);assert.equal(s.players[0].ratedGames,1);assert.equal(changes.length,4);assert.equal(s.players[0].rating,1016);assert.equal(changes.reduce((n,r)=>n+r.delta,0),0);assert.equal(playerStats(s,'A').wins,2);assert.equal(playerStats(s,'A').games,3);assert.equal(cultivationSnapshot(s,now).get('A')!.experience,33);
});
test('默认不再每月12场封顶，而成长一天只计前12局，跨活动也不重复签到奖励',()=>{
 const s=fixture();for(let i=0;i<13;i++){const m=match('m'+String(i).padStart(2,'0'),start+i*60000);m.eventId='event'+i;s.matches.push(m)}
 assert.equal(leaderboard(s,'2026-10').find(r=>r.playerId==='A')!.games,13);assert.equal(leaderboard(s,'2026-10').find(r=>r.playerId==='A')!.points,130);const xp=cultivationSnapshot(s,now).get('A')!;assert.equal(xp.earned,130);assert.equal(xp.creditedGames,12);assert.equal(xp.trainingDays,1);
 s.matches.push(match('next-week',start+7*86400000));assert.equal(cultivationSnapshot(s,now).get('A')!.earned,150);
});
test('旧默认规则升级、保留旧境界的冻结补差额不重奖，自定义赛季和Elo不被修改',()=>{
 const s=fixture();s.settings.initialized=true;s.settings.rules={...s.settings.rules,win:3,loss:0,cap:12};s.seasons=[{id:'2026-10',rules:{...s.settings.rules}},{id:'2026-09',rules:{...s.settings.rules,win:7,loss:2,cap:8}}];s.players[0].rating=1300;s.matches=[match('old')];const scores=s.players.map(p=>p.rating),records=structuredClone(s.matches);
 assert.equal(enableWeeklyProgression(s,now),true);assert.equal(s.players[0].cultivationBase,380);assert.equal(cultivationSnapshot(s,now).get('A')!.realm,'元婴');assert.equal(s.settings.rules.win,10);assert.equal(s.settings.rules.loss,3);assert.equal(s.settings.rules.cap,0);assert.equal(s.seasons[0].rules.win,10);assert.equal(s.seasons[1].rules.win,7);assert.equal(s.seasons[1].rules.cap,8);assert.deepEqual(s.players.map(p=>p.rating),scores);assert.deepEqual(s.matches,records);
 const base=s.players[0].cultivationBase;assert.equal(enableWeeklyProgression(s,now),false);s.matches.push(match('next',start+7*86400000));assert.equal(cultivationSnapshot(s,now).get('A')!.experience,420);assert.equal(s.players[0].cultivationBase,base);
});
test('缺席不降境界，作废纠错会回放；友谊、让分、弃权与未来完赛不制造修为',()=>{
 const s=fixture();s.matches=[match('real')];assert.equal(cultivationSnapshot(s,now).get('A')!.experience,20);assert.equal(cultivationSnapshot(s,now+30*86400000).get('A')!.experience,20);
 const friendly=match('friend');friendly.monthly=false;const handicap=match('handicap');handicap.handicap={side:'a',points:4,applied:true};const forfeit=match('forfeit');forfeit.status='forfeit';const future=match('future',now+86400000);s.matches.push(friendly,handicap,forfeit,future);assert.equal(cultivationSnapshot(s,now).get('A')!.experience,20);
 s.matches[0].status='cancelled';assert.equal(cultivationSnapshot(s,now).get('A')!.experience,0);s.matches[0]=match('real',start,false);assert.equal(cultivationSnapshot(s,now).get('A')!.experience,13);
});
test('修为奖励采用马德里完赛日期，跨午夜与重放稳定且重复ID不多发',()=>{
 const s=fixture();const first=match('first',Date.parse('2026-10-04T21:40:00Z'));first.end=Date.parse('2026-10-04T21:59:00Z');const second=match('second',Date.parse('2026-10-04T21:50:00Z'));second.end=Date.parse('2026-10-04T22:10:00Z');s.matches=[second,first,{...first}];assert.equal(cultivationSnapshot(s,now).get('A')!.experience,40);assert.equal(cultivationSnapshot(s,now).get('A')!.trainingDays,2);assert.equal(cultivationSnapshot(s,now).get('A')!.creditedGames,2);
});
test('隐藏实力初值不再单独决定可见境界或打破积分并列',()=>{const s=fixture();s.players[0].rating=4000;assert.equal(playerStats(s,'A').tier,'炼气');s.matches=[match('one')];const rows=annualLeaderboard(s,2026);assert.equal(rows.find(r=>r.playerId==='A')!.points,10);assert.equal(rows.find(r=>r.playerId==='C')!.points,-3);assert.equal(rows.find(r=>r.playerId==='A')!.rank,rows.find(r=>r.playerId==='B')!.rank)});
test('自动预计出勤不产生早到或压线称号，手动和旧历史出勤保持实际记录',()=>{
 const s=fixture();const e:Event={id:'manual',creatorId:'A',title:'活动',start,end:start+3600000,venue:'测试',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'live',courtMode:'interval',ballMode:'interval'};
 s.events.push(e,{...e,id:'legacy'},{...e,id:'automatic'});
 s.attendance.push({id:'expected',eventId:'manual',playerId:'A',start:start-600000,end:null,state:'ready',source:'automatic'},
  {id:'actual',eventId:'manual',playerId:'A',start:start+120000,end:null,state:'ready'},
  {id:'legacy',eventId:'legacy',playerId:'A',start:start-300000,end:null,state:'ready'},
  {id:'only-expected',eventId:'automatic',playerId:'A',start,end:null,state:'ready',source:'automatic'});
 const p=personality(s,2026).find(p=>p.playerId==='A')!;assert.equal(p.early,1);assert.equal(p.onTime,1);
});

test('保留并行更新的默认炼气零修为：新建与已有默认实力球友在各页面一致',()=>{const s=fixture();s.settings.initialized=true;enableWeeklyProgression(s,now);assert.ok(s.players.every(p=>p.cultivationBase===0));for(const rows of [leaderboard(s,'2026-10'),quarterlyLeaderboard(s,'2026-Q4'),annualLeaderboard(s,2026)])for(const row of rows){assert.equal(row.realm,'炼气');assert.equal(row.cultivation.experience,0);assert.equal(row.cultivation.progressPercent,0)}assert.equal(playerStats(s,'A').cultivation.experience,0);const data=projectClubState(s,{id:'member',email:'',role:'member',playerId:'A'},'2026-10',2026,now);assert.ok(data.players.every(p=>p.rating===null));assert.ok(data.social.stats.every(p=>p.tier==='炼气'&&p.cultivation.experience===0));assert.ok(s.players.every(p=>p.rating===1000&&p.initialRating===1000));});
