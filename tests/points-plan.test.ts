import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {defaultPointsMinutes,isPointsTime} from '../lib/domain/points-plan';
import {pointsChoiceCounts,canVotePointsMode} from '../lib/domain/points-choice';
import {projectClubState} from '../lib/club-view';
import {emptyState,type Event,type Account} from '../lib/domain/types';
import {roundStartTime} from '../lib/client/round-start';
import {leaderboard} from '../lib/domain/ranking';

const start=Date.parse('2026-10-06T16:00:00Z'),minute=60000,now=start-3600000;
function fixture(n=12){
 const s=emptyState(),e:Event={id:'points',creatorId:'creator',title:'预排验收',start,end:start+120*minute,venue:'测试',address:'',capacity:30,signupDeadline:start,cancelDeadline:start,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events.push(e);s.accounts.push({id:'creator',role:'member',email:'',playerId:'p0'},{id:'admin',role:'admin',email:'',playerId:'admin-player'},{id:'outsider',role:'member',email:'',playerId:'outsider-player'});
 for(let i=0;i<n;i++){const id='p'+String(i).padStart(2,'0');s.players.push({id,ownerId:i===0?'creator':'actor'+i,name:id,initialRating:1000+i*8,rating:1000+i*8,ratedGames:0,enabled:true,ratingReason:''});s.registrations.push({id:'reg'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});s.accounts.push({id:'actor'+i,role:'member',email:'',playerId:id})}
 s.accounts[0].playerId='p00';
 for(let i=0;i<2;i++)s.bookings.push({id:'court'+i,eventId:e.id,name:(i+1)+'号场',start,end:e.end,pricing:'hourly',cents:690});
 const account=(id:string)=>s.accounts.find(a=>a.id===id)!;
 const act=(action:string,p:Record<string,unknown>={},who='creator',at=now)=>apply(s,account(who),action,{eventId:e.id,...p},at);
 const plan=(pairing:'rotate'|'fixed'='rotate',p:Record<string,unknown>={})=>act('planPoints',{at:start,pointsMinutes:90,roundMinutes:15,seed:12,pairing,...p});
 return {s,e,act,plan,account};
}

test('默认按完整活动时段预排，不再留不计分时段',()=>{
 assert.equal(defaultPointsMinutes({start,end:start+120*minute}),120);assert.equal(defaultPointsMinutes({start,end:start+180*minute}),180);assert.equal(defaultPointsMinutes({start,end:start+20*minute}),20);
});
test('一次生成90分钟六轮，草稿可检查，双方四人不重复，12人每人公平上场四轮',async()=>{
 const {s,e,plan}=fixture();await plan();assert.equal(s.rounds.length,6);assert.equal(s.matches.length,12);assert.equal(e.pointsPlan!.end,start+90*minute);
 const games=new Map<string,number>();for(const [i,r] of s.rounds.entries()){
  assert.equal(r.start,start+i*15*minute);assert.equal(r.duration,15);assert.equal(r.pointsSlot,i+1);assert.equal(r.status,'draft');
  const matches=s.matches.filter(m=>m.roundId===r.id),ids=matches.flatMap(m=>[...m.a,...m.b]);assert.equal(new Set(ids).size,8);assert.equal(r.rest.length,4);assert.equal(new Set(matches.map(m=>m.courtId)).size,2);
  matches.forEach(m=>{assert.equal(m.monthly,true);assert.equal(m.elo,true);assert.equal(m.start,null)});ids.forEach(id=>games.set(id,(games.get(id)??0)+1));
 }
 assert.deepEqual([...games.values()],Array(12).fill(4));
});
test('固定搭档整场不变，也能公平轮换上场；轮换搭档模式会更换伙伴',async()=>{
 for(const pairing of ['fixed','rotate'] as const){const {s,e,plan}=fixture();await plan(pairing);const partners=new Map<string,Set<string>>();
  for(const m of s.matches)for(const team of [m.a,m.b])for(const id of team){const set=partners.get(id)??new Set();set.add(team.find(x=>x!==id)!);partners.set(id,set)}
  if(pairing==='fixed'){assert.equal(e.pointsChoice!.teams!.length,6);assert.ok([...partners.values()].every(set=>set.size===1));const counts=s.players.map(p=>s.matches.filter(m=>[...m.a,...m.b].includes(p.id)).length);assert.ok(Math.max(...counts)-Math.min(...counts)<=1)}else assert.ok([...partners.values()].some(set=>set.size>1));
 }
});
test('预排按实际接龙参加时段，排除候补、取消、停用者；晚到成员从覆盖的轮次参加',async()=>{
 const {s,plan}=fixture(14);s.registrations[0].arrival=start+30*minute;s.registrations[1].departure=start+60*minute;s.registrations[12].status='waitlist';s.registrations[13].status='cancelled';s.players[11].enabled=false;
 await plan();for(const r of s.rounds){const ids=s.matches.filter(m=>m.roundId===r.id).flatMap(m=>[...m.a,...m.b]);assert.ok(!ids.includes('p11')&&!ids.includes('p12')&&!ids.includes('p13'));if(r.start<start+30*minute)assert.ok(!ids.includes('p00'));if(r.start>=start+60*minute)assert.ok(!ids.includes('p01'))}
});
test('场地中途缺失时不会保存半份赛程，也不会取消原有有效安排',async()=>{
 const {s,plan}=fixture();await plan();s.bookings.forEach(b=>b.end=start+45*minute);const before=structuredClone(s);await assert.rejects(()=>plan(),/第4轮/);assert.deepEqual(s,before);
});
test('不足一轮的余时合并，全部轮次严格落在积分赛时段内',async()=>{
 const {s,e,plan}=fixture();await plan('rotate',{pointsMinutes:92,roundMinutes:30});assert.deepEqual(s.rounds.map(r=>r.duration),[30,30,32]);assert.equal(s.rounds.at(-1)!.start+s.rounds.at(-1)!.duration*minute,e.pointsPlan!.end);
});
test('积分赛不能越界、不能由普通成员管理，擂台仍用逐轮生成',async()=>{
 const {s,e,plan,act}=fixture();let before=structuredClone(s);await assert.rejects(()=>plan('rotate',{pointsMinutes:130}),/活动时间内/);assert.deepEqual(s,before);
 await assert.rejects(()=>act('planPoints',{at:start,pointsMinutes:90,roundMinutes:15,seed:12,pairing:'rotate'},'actor1'),/403/);assert.deepEqual(s,before);
 e.playMode='arena';before=structuredClone(s);await assert.rejects(()=>plan(),/擂台/);assert.deepEqual(s,before);
});
test('重新预排仅取消未开始轮次，开始后禁止重排，原成绩不被修改',async()=>{
 const {s,plan}=fixture();await plan();const old=s.rounds.map(r=>r.id);await plan('fixed');assert.ok(s.rounds.filter(r=>old.includes(r.id)).every(r=>r.status==='cancelled'));assert.equal(s.rounds.filter(r=>r.status==='draft').length,6);
 const m=s.matches.find(m=>m.status==='draft')!;m.status='complete';m.start=start;m.end=start+15*minute;m.scoreA=21;m.scoreB=17;const before=structuredClone(s);await assert.rejects(()=>plan(),/比赛开始或完成/);assert.deepEqual(s,before);
});
test('发布全部轮次先完整验证，名单改变时不会部分发布',async()=>{
 const {s,act,plan}=fixture();await plan();s.registrations[0].status='cancelled';const before=structuredClone(s);await assert.rejects(()=>act('publishPoints'),/参加时段/);assert.deepEqual(s,before);
 s.registrations[0].status='confirmed';await act('publishPoints');assert.ok(s.rounds.every(r=>r.status==='published'));assert.ok(s.matches.every(m=>m.status==='published'));
});
test('按赛程顺序开赛，未完成前不能跳到下一轮；计分使用活动时段而非请求开关',async()=>{
 const {s,e,act,plan}=fixture();await plan();await act('publishPoints');const [first,second]=s.rounds;
 await assert.rejects(()=>act('start',{roundId:second.id,at:second.start,monthly:true,elo:true}),/顺序/);
 await act('start',{roundId:first.id,at:start,monthly:false,elo:false});assert.ok(s.matches.filter(m=>m.roundId===first.id).every(m=>m.monthly&&m.elo));
 await assert.rejects(()=>act('start',{roundId:second.id,at:second.start,monthly:true,elo:true}),/顺序/);
 s.rounds.forEach(r=>{if(r!==second)r.status='cancelled'});s.matches.filter(m=>m.roundId!==second.id).forEach(m=>m.status='cancelled');
 await act('start',{roundId:second.id,at:e.pointsPlan!.end,monthly:true,elo:true,friendly:true});assert.ok(s.matches.filter(m=>m.roundId===second.id).every(m=>m.monthly&&m.elo));
});
test('逐轮生成保留，无预排时照常使用；有预排时不覆盖既定轮次',async()=>{
 const {s,act,plan}=fixture();await act('generate',{at:start,duration:15,seed:3});assert.equal(s.rounds.length,1);assert.equal(s.rounds[0].pointsSlot,undefined);
 await plan();const before=structuredClone(s);await assert.rejects(()=>act('generate',{at:start,duration:15,seed:3}),/预排积分赛/);assert.deepEqual(s,before);
});
test('固定搭档也适用于逐轮生成，禁止单轮换搭档破坏固定队伍',async()=>{
 const {s,e,act}=fixture();await act('pointsModeSelect',{mode:'fixed'});await act('generate',{at:start,duration:15,seed:3});const teams=e.pointsChoice!.teams!,first=s.rounds[0],partners=new Map(s.matches.flatMap(m=>[m.a,m.b]).flatMap(t=>[[t[0],t[1]],[t[1],t[0]]] as [string,string][]));
 await assert.rejects(()=>act('swap',{roundId:first.id,p1:'p00',p2:'p01'}),/固定搭档/);
 first.status='complete';s.matches.forEach(m=>m.status='complete');await act('generate',{at:start+15*minute,duration:15,seed:11});assert.deepEqual(e.pointsChoice!.teams,teams);
 for(const m of s.matches.filter(m=>m.roundId!==first.id))for(const t of [m.a,m.b])assert.ok(teams.some(team=>team.every(id=>t.includes(id))));assert.ok(partners.size>0);
});
test('搭档方式投票：正式成员一账号一票，可改投撤回，最高票不自动确认',async()=>{
 const {s,e,act}=fixture();await act('pointsModeVoting',{open:true});
 await act('pointsModeVote',{mode:'fixed'},'actor1');await act('pointsModeVote',{mode:'fixed'},'actor2');assert.deepEqual(pointsChoiceCounts(s,e),{rotate:0,fixed:2});assert.equal(e.pointsChoice!.selectedMode,undefined);
 await act('pointsModeVote',{mode:'rotate'},'actor1');assert.deepEqual(pointsChoiceCounts(s,e),{rotate:1,fixed:1});await act('pointsModeVote',{mode:null},'actor2');assert.equal(e.pointsChoice!.votes.length,1);
 await act('pointsModeSelect',{mode:'fixed'});assert.equal(e.pointsChoice!.selectedMode,'fixed');assert.equal(e.pointsChoice!.votingOpen,false);assert.equal(e.pointsChoice!.votes.length,1);
});
test('投票与方式管理权限、开始时刻限制、取消与停用不计票',async()=>{
 const {s,e,act,account}=fixture();await act('pointsModeVoting',{open:true});await assert.rejects(()=>act('pointsModeVote',{mode:'fixed'},'outsider'),/403/);await assert.rejects(()=>act('pointsModeSelect',{mode:'fixed'},'actor1'),/403/);
 await act('pointsModeVote',{mode:'fixed'},'actor1');s.registrations[1].status='cancelled';assert.deepEqual(pointsChoiceCounts(s,e),{rotate:0,fixed:0});assert.equal(canVotePointsMode(s,e,account('actor1'),now),false);
 await assert.rejects(()=>act('pointsModeVote',{mode:'rotate'},'actor2',e.start),/403/);await assert.rejects(()=>act('pointsModeVoting',{open:true},'creator',e.start),/开始前/);
});
test('活动开始后方式不能改变；更换未开打方式清理旧分组而不是混用搭档',async()=>{
 const {s,e,act,plan}=fixture();await plan();await act('pointsModeSelect',{mode:'fixed'});assert.ok(s.rounds.every(r=>r.status==='cancelled'));assert.ok(s.matches.every(m=>m.status==='cancelled'));
 await plan('fixed');await act('publishPoints');await act('start',{roundId:s.rounds.find(r=>r.status==='published')!.id,at:start,monthly:true,elo:true});const before=structuredClone(s);await assert.rejects(()=>act('pointsModeSelect',{mode:'rotate'}),/已开始/);assert.deepEqual(s,before);assert.equal(e.pointsChoice!.selectedMode,'fixed');
});
test('其他账号ID不在共享投票响应中暴露；历史接口关闭标志不会再使比赛漏积分',async()=>{
 const {s,e,act,account}=fixture();await act('pointsModeVoting',{open:true});await act('pointsModeVote',{mode:'fixed'},'actor1');await act('pointsModeVote',{mode:'rotate'},'actor2');
 const view=projectClubState(s,account('actor1'),'2026-10',2026,now),shown=view.events[0];assert.equal(shown.pointsChoice!.votes.find(v=>v.playerId==='p01')!.voterId,'actor1');assert.equal(shown.pointsChoice!.votes.find(v=>v.playerId==='p02')!.voterId,'');
 assert.equal(e.pointsPlan,undefined);assert.equal(isPointsTime(e,e.end),true);await act('generate',{at:start,duration:15,seed:3});const r=s.rounds[0];await act('publish',{roundId:r.id});await act('start',{roundId:r.id,at:start,monthly:false,elo:false});assert.ok(s.matches.every(m=>m.monthly&&m.elo));
});

test('搭档投票拒绝候补；递补为正式可投票，退回候补后不计票',async()=>{
 const {s,e,act,account}=fixture();await act('pointsModeVoting',{open:true});s.registrations[2].status='waitlist';
 const before=structuredClone(s);assert.equal(canVotePointsMode(s,e,account('actor2'),now),false);await assert.rejects(()=>act('pointsModeVote',{mode:'fixed'},'actor2'),/403/);assert.deepEqual(s,before);
 s.registrations[2].status='confirmed';await act('pointsModeVote',{mode:'fixed'},'actor2');assert.deepEqual(pointsChoiceCounts(s,e),{rotate:0,fixed:1});
 s.registrations[2].status='waitlist';assert.deepEqual(pointsChoiceCounts(s,e),{rotate:0,fixed:0});
});

test('未配置搭档投票时正式成员默认可投；显式关闭及确认后的关闭不被默认值覆盖',async()=>{
 const {s,e,act,account}=fixture();assert.equal(e.pointsChoice,undefined);assert.equal(canVotePointsMode(s,e,account('actor1'),now),true);
 await act('pointsModeVote',{mode:'fixed'},'actor1');assert.equal(e.pointsChoice!.votingOpen,true);assert.deepEqual(pointsChoiceCounts(s,e),{rotate:0,fixed:1});
 await act('pointsModeVoting',{open:false});const closed=structuredClone(s);await assert.rejects(()=>act('pointsModeVote',{mode:'rotate'},'actor2'),/403/);assert.deepEqual(s,closed);
 await act('pointsModeVoting',{open:true});await act('pointsModeVote',{mode:'rotate'},'actor2');await act('pointsModeSelect',{mode:'fixed'});const confirmed=structuredClone(s);await assert.rejects(()=>act('pointsModeVote',{mode:null},'actor1'),/403/);assert.deepEqual(s,confirmed);
});

test('连续两轮预排积分赛默认沿用各轮时间，第二局同样自动加减分',async()=>{
 const {s,e,account}=fixture(4),creator=account('creator');await apply(s,creator,'planPoints',{eventId:e.id,at:start+30*minute,pointsMinutes:90,roundMinutes:15,seed:17,pairing:'rotate'},now);await apply(s,creator,'publishPoints',{eventId:e.id},now);
 const rounds=s.rounds.filter(r=>r.pointsSlot!==undefined).sort((a,b)=>a.pointsSlot!-b.pointsSlot!);
 for(let i=0;i<2;i++){const r=rounds[i];const at=roundStartTime(e,r,now);assert.equal(at,start+(30+i*15)*minute);await apply(s,creator,'start',{roundId:r.id,at,monthly:true,elo:true},now);const before=new Map(leaderboard(s,'2026-10').map(row=>[row.playerId,row.pointsChange]));for(const m of s.matches.filter(m=>m.roundId===r.id)){await apply(s,creator,'score',{matchId:m.id,a:21,b:17,end:at+10*minute,reason:'真实两轮回归'},now);assert.equal(m.monthly,true);for(const id of m.a)assert.ok(leaderboard(s,'2026-10').find(row=>row.playerId===id)!.pointsChange>before.get(id)!,'winner gains 段位分');for(const id of m.b)assert.ok(leaderboard(s,'2026-10').find(row=>row.playerId===id)!.pointsChange<before.get(id)!,'loser drops 段位分')}}
 assert.equal(s.matches.filter(m=>m.status==='complete'&&m.monthly).length,2);assert.ok(leaderboard(s,'2026-10').every(row=>row.games===2));
});

test('积分赛预排范围外也计分，旧客户端自由赛标志不会关闭积分',async()=>{const {s,e,account}=fixture(4),creator=account('creator');await apply(s,creator,'planPoints',{eventId:e.id,at:start+30*minute,pointsMinutes:90,roundMinutes:15,seed:18,pairing:'rotate'},now);await apply(s,creator,'publishPoints',{eventId:e.id},now);const r=s.rounds.find(r=>r.pointsSlot===1)!;await apply(s,creator,'start',{roundId:r.id,at:start,monthly:false,elo:false,friendly:true},now);assert.ok(s.matches.filter(m=>m.roundId===r.id).every(m=>m.monthly&&m.elo));});

test('默认开赛时间保留预排时刻，已经迟到则使用当前时间',()=>{
 assert.equal(roundStartTime({start},{start:start+45*minute},start-60*minute),start+45*minute);assert.equal(roundStartTime({start},{start:start+45*minute},start+50*minute),start+50*minute);
});
