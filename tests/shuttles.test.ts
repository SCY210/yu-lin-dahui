import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {canVoteForShuttle,shuttleVoteCounts} from '../lib/domain/shuttles';
import {emptyState,type Event,type Account,type Registration} from '../lib/domain/types';
import {projectClubState} from '../lib/club-view';

const now=Date.parse('2026-10-05T10:00:00Z');
function fixture(){
 const s=emptyState();
 const e:Event={id:'shuttle-event',creatorId:'creator',title:'用球验收',start:now+3600000,end:now+4*3600000,venue:'测试球馆',address:'',capacity:12,signupDeadline:now+3600000,cancelDeadline:now+3600000,note:'',status:'open',courtMode:'interval',ballMode:'interval'};
 s.events.push(e,{...e,id:'other-event',creatorId:'outsider'});
 for(const id of ['creator','admin','formal','waitlist','cancelled','disabled','outsider','foreign']){
  const a:Account={id,playerId:id+'-player',email:'',role:id==='admin'?'admin':'member'};
  s.accounts.push(a);s.players.push({id:a.playerId,ownerId:a.id,name:id,initialRating:1000,rating:1000,ratedGames:0,enabled:id!=='disabled',ratingReason:''});
 }
 for(const [id,status] of [['formal','confirmed'],['waitlist','waitlist'],['cancelled','cancelled'],['disabled','confirmed'],['foreign','confirmed']] as const){
  const r:Registration={id:'reg-'+id,eventId:id==='foreign'?'other-event':e.id,playerId:id+'-player',sequence:s.registrations.length+1,status,arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}};s.registrations.push(r);
 }
 const account=(id:string)=>s.accounts.find(a=>a.id===id)!;
 const act=(who:string,action:string,p:Record<string,unknown>={},at=now)=>apply(s,account(who),action,{eventId:e.id,...p},at);
 const vote=(who:string,optionId:string|null,at=now)=>act(who,'shuttleVote',{optionId},at);
 return {s,e,account,act,vote};
}
async function voting(){
 const f=fixture();await f.act('creator','shuttleOption',{name:'候选A',note:'球速77'});await f.act('creator','shuttleOption',{name:'候选B',note:''});await f.act('creator','shuttleVoting',{open:true});
 return {...f,a:f.e.shuttlePlan!.options[0].id,b:f.e.shuttlePlan!.options[1].id};
}

test('旧活动无用球字段仍可读取，创建者和管理员可添加并明确选用球',async()=>{
 const {s,e,act}=fixture();assert.equal(e.shuttlePlan,undefined);
 await act('creator','shuttleOption',{name:' 测试型号 ',note:'速度77'});assert.equal(e.shuttlePlan!.options[0].name,'测试型号');assert.equal(e.shuttlePlan!.votingOpen,false);
 await act('admin','shuttleConfirm',{optionId:e.shuttlePlan!.options[0].id});assert.equal(e.shuttlePlan!.selectedId,e.shuttlePlan!.options[0].id);
 const restored=JSON.parse(JSON.stringify(s.events[0])) as Event;assert.deepEqual(restored.shuttlePlan,e.shuttlePlan);
});

for(const action of ['shuttleOption','shuttleRemove','shuttleConfirm','shuttleVoting'])test(`普通接龙成员不能绕过创建者管理权限：${action}`,async()=>{
 const {s,act,a}=await voting(),before=structuredClone(s);
 await assert.rejects(()=>act('formal',action,{name:'伪造',optionId:a,open:true}),/403/);assert.deepEqual(s,before);
});

test('正式接龙和候补都能投票，每账号一票，改投与撤回改变真实票数',async()=>{
 const {s,e,vote,a,b}=await voting();await vote('formal',a);await vote('waitlist',a);assert.equal(shuttleVoteCounts(s,e)[a],2);
 await vote('formal',b);assert.equal(e.shuttlePlan!.votes.length,2);assert.deepEqual(shuttleVoteCounts(s,e),{[a]:1,[b]:1});
 await vote('formal',b);assert.equal(e.shuttlePlan!.votes.length,2);
 await vote('formal',null);assert.deepEqual(shuttleVoteCounts(s,e),{[a]:1,[b]:0});
});

for(const who of ['creator','admin','cancelled','disabled','outsider','foreign'])test(`未接龙或无效成员不能投票：${who}`,async()=>{
 const {s,e,account,vote,a}=await voting(),before=structuredClone(s);
 assert.equal(canVoteForShuttle(s,e,account(who),now),false);await assert.rejects(()=>vote(who,a),/403/);assert.deepEqual(s,before);
});

test('不能用其他活动的选项、伪造玩家或未知球影响投票',async()=>{
 const {s,e,act,a,vote}=await voting();await act('outsider','shuttleOption',{eventId:'other-event',name:'其他活动用球'});
 const otherId=s.events[1].shuttlePlan!.options[0].id,before=structuredClone(s);
 await assert.rejects(()=>vote('formal',otherId),/候选球不存在/);assert.deepEqual(s,before);
 await act('formal','shuttleVote',{optionId:a,playerId:'outsider-player',voterId:'admin'});
 assert.equal(e.shuttlePlan!.votes[0].voterId,'formal');assert.equal(e.shuttlePlan!.votes[0].playerId,'formal-player');
});

test('最高票不自动选用；创建者可选另一款，确认后关闭投票且保留票数',async()=>{
 const {s,e,act,vote,a,b}=await voting();await vote('formal',a);await vote('waitlist',a);assert.equal(e.shuttlePlan!.selectedId,undefined);
 await act('creator','shuttleConfirm',{optionId:b});assert.equal(e.shuttlePlan!.selectedId,b);assert.equal(e.shuttlePlan!.votingOpen,false);assert.equal(shuttleVoteCounts(s,e)[a],2);
 const before=structuredClone(s);await assert.rejects(()=>vote('formal',b),/403/);assert.deepEqual(s,before);
 await act('creator','shuttleVoting',{open:true});await vote('formal',b);assert.equal(e.shuttlePlan!.selectedId,b);
});

test('取消报名、停用成员不再计票，代报朋友不带来额外账号票数',async()=>{
 const {s,e,vote,a,b,act}=await voting();await vote('formal',a);await vote('waitlist',b);
 s.registrations.find(r=>r.playerId==='formal-player')!.status='cancelled';s.players.find(p=>p.id==='waitlist-player')!.enabled=false;
 assert.deepEqual(shuttleVoteCounts(s,e),{[a]:0,[b]:0});await assert.rejects(()=>vote('formal',b),/403/);
 s.registrations.find(r=>r.playerId==='formal-player')!.status='confirmed';s.players.push({...s.players[0],id:'friend-player',ownerId:'formal'});s.registrations.push({...s.registrations[0],id:'friend-reg',playerId:'friend-player'});
 await act('formal','shuttleVote',{optionId:b,playerId:'friend-player'});assert.equal(e.shuttlePlan!.votes.filter(v=>v.voterId==='formal').length,1);
});

test('移除未选候选球清理对应票数，已确认球须先清除或更换',async()=>{
 const {s,e,act,vote,a,b}=await voting();await vote('formal',a);await vote('waitlist',b);await act('creator','shuttleConfirm',{optionId:b});
 await act('creator','shuttleRemove',{optionId:a});assert.deepEqual(e.shuttlePlan!.votes.map(v=>v.optionId),[b]);
 const before=structuredClone(s);await assert.rejects(()=>act('creator','shuttleRemove',{optionId:b}),/先更换或清除/);assert.deepEqual(s,before);
 await act('creator','shuttleConfirm',{optionId:null});await act('creator','shuttleRemove',{optionId:b});assert.equal(e.shuttlePlan!.options.length,0);assert.equal(e.shuttlePlan!.votes.length,0);assert.equal(e.shuttlePlan!.votingOpen,false);
});

test('开始时刻停止投票，不可重新开放；取消、结束及删除活动拒绝修改',async()=>{
 const {s,e,vote,a,act}=await voting();await assert.rejects(()=>vote('formal',a,e.start),/403/);await assert.rejects(()=>act('creator','shuttleVoting',{open:true},e.start),/开始前/);
 for(const status of ['ended','cancelled'] as const){e.status=status;const before=structuredClone(s);await assert.rejects(()=>act('creator','shuttleOption',{name:'新增球'}),/已结束或取消/);await assert.rejects(()=>vote('formal',a),/已结束或取消/);assert.deepEqual(s,before)}
 e.status='open';e.deletedAt=now;await assert.rejects(()=>act('creator','shuttleConfirm',{optionId:a}),/已删除/);await assert.rejects(()=>vote('formal',a),/已删除/);
});

test('候选球去重、数量和文字限制在服务端执行，错误不改变活动',async()=>{
 const {s,e,act}=await voting();let before=structuredClone(s);await assert.rejects(()=>act('creator','shuttleOption',{name:'候选A',note:'球速77'}),/已添加/);assert.deepEqual(s,before);
 for(let i=2;i<12;i++)await act('creator','shuttleOption',{name:'选项'+i});before=structuredClone(s);await assert.rejects(()=>act('creator','shuttleOption',{name:'第13款'}),/最多/);assert.deepEqual(s,before);
 assert.equal(e.shuttlePlan!.options.length,12);await assert.rejects(()=>act('creator','shuttleOption',{name:' '}));await assert.rejects(()=>act('creator','shuttleOption',{name:'过长',note:'字'.repeat(301)}));
});

test('共享活动保留票数及本人选择，隐藏其他账号ID，不改变持久化原始数据',async()=>{
 const {s,e,account,vote,a,b}=await voting();await vote('formal',a);await vote('waitlist',b);
 const before=structuredClone(s),view=projectClubState(s,account('formal'),'2026-10',2026,now),shown=view.events.find(x=>x.id===e.id)!;
 assert.equal(shown.shuttlePlan!.votes.find(v=>v.playerId==='formal-player')!.voterId,'formal');assert.equal(shown.shuttlePlan!.votes.find(v=>v.playerId==='waitlist-player')!.voterId,'');
 assert.deepEqual(shuttleVoteCounts(view,shown),{[a]:1,[b]:1});assert.deepEqual(s,before);
});
