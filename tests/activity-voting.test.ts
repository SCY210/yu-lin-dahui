import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {awardCandidateIds,canCastAwardVote} from '../lib/domain/activity-voting';
import {emptyState,type Account,type Event,type Registration} from '../lib/domain/types';

const now=Date.parse('2026-10-04T10:00:00Z');
function fixture(){
 const s=emptyState();
 const e:Event={id:'vote-event',creatorId:'creator',title:'虚构投票验收',start:now-3*3600000,end:now-3600000,venue:'测试',address:'',capacity:12,signupDeadline:now+3600000,cancelDeadline:now+3600000,note:'',status:'ended',courtMode:'interval',ballMode:'interval'};
 s.events.push(e,{...e,id:'other-event',creatorId:'other-creator'});
 for(const id of ['creator','admin','formal-a','formal-b','attended','outsider','waitlist','cancelled','disabled','foreign','future']){
  const a:Account={id,playerId:id+'-player',email:'',role:id==='admin'?'admin':'member'};
  s.accounts.push(a);s.players.push({id:a.playerId,name:id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:id!=='disabled',ratingReason:'测试'});
 }
 const reg=(id:string,status:Registration['status'],eventId=e.id)=>s.registrations.push({id:'reg-'+id,eventId,playerId:id+'-player',sequence:s.registrations.length+1,status,arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 reg('formal-a','confirmed');reg('formal-b','confirmed');reg('waitlist','waitlist');reg('cancelled','cancelled');reg('attended','cancelled');reg('disabled','confirmed');reg('foreign','confirmed','other-event');
 s.attendance.push({id:'past-attendance',eventId:e.id,playerId:'attended-player',start:now-60000,end:now,state:'left'},{id:'other-attendance',eventId:'other-event',playerId:'foreign-player',start:now-60000,end:null,state:'ready'},{id:'future-attendance',eventId:e.id,playerId:'future-player',start:now+3600000,end:now+7200000,state:'ready'});
 const account=(id:string)=>s.accounts.find(a=>a.id===id)!;
 const vote=(voter:string,target:string,category:'mvp'|'defense'|'net'|'effort'='mvp',eventId=e.id,at=now)=>apply(s,account(voter),'awardVote',{eventId,playerId:target+'-player',category},at);
 return {s,e,account,vote};
}

test('正式报名或已参与者为启用候选人：排除候补、未参加的取消者、停用者、其他活动与未来出勤',()=>{
 const {s,e}=fixture();assert.deepEqual(awardCandidateIds(s,e.id,now),['formal-a-player','formal-b-player','attended-player']);
});

test('活动尚未打完，正式成员、创建者及管理员都不能提前投票',async()=>{
 for(const status of ['draft','open','locked','live','ended'] as const){const {s,e,account,vote}=fixture();e.status=status;e.start=now+3600000;e.end=now+3*3600000;const before=structuredClone(s);for(const who of ['formal-a','creator','admin']){assert.equal(canCastAwardVote(s,e,account(who),now),false);await assert.rejects(()=>vote(who,'formal-b'),/尚未打完/);assert.deepEqual(s,before)}}
});

test('到达活动结束时间，未标记结束也能评选；仍有比赛进行则继续关闭',async()=>{
 for(const status of ['open','locked','live','ended'] as const){const {s,e,vote}=fixture();e.status=status;await vote('formal-a','formal-b');assert.equal(s.awardVotes.length,1)}
 const {s,e,vote}=fixture();s.matches.push({id:'still-playing',eventId:e.id,status:'playing'} as any);const before=structuredClone(s);await assert.rejects(()=>vote('admin','formal-a'),/尚未打完/);assert.deepEqual(s,before);
});

test('提前打完可标记结束后评选，未结束时不能因没有进行中比赛而提前投票',async()=>{
 const {s,e,vote}=fixture();e.start=now-3600000;e.end=now+3600000;e.status='live';await assert.rejects(()=>vote('formal-a','formal-b'),/尚未打完/);e.status='ended';await vote('formal-a','formal-b');assert.equal(s.awardVotes.length,1);
});

test('正式成员无需签到，结束后可投票，曾到场的取消者仍能投票',async()=>{
 const {s,vote}=fixture();await vote('formal-a','attended');await vote('attended','formal-b');assert.equal(s.awardVotes.length,2);
});

test('自动出勤模式的取消参与归档仍可投票，未来虚拟区间不产生资格',async()=>{
 const {s,e,vote}=fixture();e.attendanceMode='automatic';s.attendance.forEach(at=>at.source='automatic');
 await vote('attended','formal-b');assert.equal(s.awardVotes.length,1);
 await assert.rejects(()=>vote('future','formal-a'),/403/);await assert.rejects(()=>vote('admin','future'),/候选球友/);
});

test('管理员和本活动普通创建者无需报名即可投票，但没有额外候选资格',async()=>{
 const {s,e,account,vote}=fixture();assert.ok(canCastAwardVote(s,e,account('creator'),now));assert.ok(canCastAwardVote(s,e,account('admin'),now));
 await vote('creator','formal-a');await vote('admin','formal-b');assert.equal(s.awardVotes.length,2);
 await assert.rejects(()=>vote('formal-a','creator'),/候选球友/);
});

for(const id of ['outsider','waitlist','cancelled','foreign','disabled','future'])test(`${id} 未获本活动参与资格不能投票，拒绝时不改变数据`,async()=>{
 const {s,vote}=fixture(),before=structuredClone(s);await assert.rejects(()=>vote(id,'formal-a'),/403/);assert.deepEqual(s,before);
});

test('其他活动的创建者身份不授予本活动投票权限',async()=>{
 const {s,e,account,vote}=fixture();e.creatorId='other-person';assert.equal(canCastAwardVote(s,e,account('creator'),now),false);const before=structuredClone(s);await assert.rejects(()=>vote('creator','formal-a'),/403/);assert.deepEqual(s,before);
});

for(const id of ['outsider','waitlist','cancelled','foreign','disabled','future'])test(`${id} 不在本活动候选名单中，管理员也不能把票投给该人`,async()=>{
 const {s,vote}=fixture(),before=structuredClone(s);await assert.rejects(()=>vote('admin',id),/候选球友/);assert.deepEqual(s,before);
});

test('自己的账号不能给自己投票，参加活动的创建者和管理员也不能绕过',async()=>{
 const {s,e,vote}=fixture();for(const id of ['formal-a','creator','admin']){
  if(id!=='formal-a')s.registrations.push({...s.registrations[0],id:'reg-'+id,playerId:id+'-player'});
  const before=structuredClone(s);await assert.rejects(()=>vote(id,id),/其他球友/);assert.deepEqual(s,before);
 }
 assert.equal(e.status,'ended');
});

test('每活动每账号每奖项一票，改投转移真实票数而非累加',async()=>{
 const {s,vote}=fixture();await vote('formal-a','formal-b');await vote('creator','formal-b');assert.equal(s.awardVotes.filter(v=>v.playerId==='formal-b-player').length,2);
 await vote('formal-a','attended');assert.equal(s.awardVotes.length,2);assert.equal(s.awardVotes.filter(v=>v.playerId==='formal-b-player').length,1);assert.equal(s.awardVotes.filter(v=>v.playerId==='attended-player').length,1);
 await vote('formal-a','attended','mvp',undefined,now+1000);assert.equal(s.awardVotes.length,2);assert.equal(s.awardVotes.find(v=>v.voterId==='formal-a')?.at,now+1000);
 for(const category of ['defense','net','effort'] as const)await vote('formal-a','formal-b',category);
 assert.equal(s.awardVotes.filter(v=>v.voterId==='formal-a').length,4);
});

test('同一账号在两次活动的同类投票独立，不能串用另一活动候选人',async()=>{
 const {s,vote}=fixture();await vote('admin','formal-a');await vote('admin','foreign','mvp','other-event');assert.equal(s.awardVotes.length,2);
 await vote('admin','formal-b');assert.equal(s.awardVotes.find(v=>v.eventId==='other-event')?.playerId,'foreign-player');assert.equal(s.awardVotes.find(v=>v.eventId==='vote-event')?.playerId,'formal-b-player');
 await assert.rejects(()=>vote('admin','foreign'),/候选球友/);
});

test('取消活动立即停止普通成员、创建者和管理员的新增或改投，保留原票数',async()=>{
 const {s,e,account,vote}=fixture();await vote('formal-a','formal-b');e.status='cancelled';const before=structuredClone(s);
 for(const id of ['formal-a','creator','admin']){assert.equal(canCastAwardVote(s,e,account(id),now),false);await assert.rejects(()=>vote(id,'attended'),/已取消/);assert.deepEqual(s,before);}
});

test('空候选名单与零时长/未来自动出勤不产生虚构候选',()=>{
 const {s,e}=fixture();s.registrations=[];s.attendance=s.attendance.filter(at=>at.playerId==='future-player');s.attendance.push({id:'empty-span',eventId:e.id,playerId:'attended-player',start:now,end:now,state:'left'});
 assert.deepEqual(awardCandidateIds(s,e.id,now),[]);
});

test('打法标签也必须绑定已打完的活动，个人档案旧请求与提前投票被拒绝',async()=>{
 const {s,e,account}=fixture();const before=structuredClone(s);
 await assert.rejects(()=>apply(s,account('admin'),'tagVote',{playerId:'formal-a-player',tag:'防守怪',active:true},now));assert.deepEqual(s,before);
 e.end=now+3600000;e.status='live';const ongoing=structuredClone(s);
 await assert.rejects(()=>apply(s,account('admin'),'tagVote',{eventId:e.id,playerId:'formal-a-player',tag:'防守怪',active:true},now),/尚未打完/);assert.deepEqual(s,ongoing);
});

test('打法标签每活动每账号每球友每标签一票，可撤回且不能跨活动投给非参与者',async()=>{
 const {s,e,account}=fixture();
 const tag=(eventId=e.id,active=true)=>apply(s,account('admin'),'tagVote',{eventId,playerId:eventId===e.id?'formal-a-player':'foreign-player',tag:'防守怪',active},now);
 await tag();await tag();assert.equal(s.tagVotes.length,1);assert.equal(s.tagVotes[0].eventId,e.id);
 await tag('other-event');assert.equal(s.tagVotes.length,2);await tag(e.id,false);assert.equal(s.tagVotes.length,1);assert.equal(s.tagVotes[0].eventId,'other-event');
 const before=structuredClone(s);await assert.rejects(()=>apply(s,account('formal-a'),'tagVote',{eventId:'other-event',playerId:'foreign-player',tag:'防守怪',active:true},now),/403/);assert.deepEqual(s,before);
});

test('旧档案标签票数只读保留，新活动投票与撤回不会删除旧记录',async()=>{
 const {s,e,account}=fixture();s.tagVotes.push({id:'legacy-vote',voterId:'admin',playerId:'formal-a-player',tag:'防守怪',at:now-86400000});
 await apply(s,account('admin'),'tagVote',{eventId:e.id,playerId:'formal-a-player',tag:'防守怪',active:true},now);assert.equal(s.tagVotes.length,2);
 await apply(s,account('admin'),'tagVote',{eventId:e.id,playerId:'formal-a-player',tag:'防守怪',active:false},now);assert.equal(s.tagVotes.length,1);assert.equal(s.tagVotes[0].id,'legacy-vote');
});
