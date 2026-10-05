import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Account} from '../lib/domain/types';
import {archiveTrials,restoreTrials,trialCleanupStatus,trialTargets} from '../lib/domain/trial-cleanup';
const now=Date.parse('2026-10-06T00:00:00Z');
function fixture(){
 const s=emptyState();s.settings.ownerAccountId='owner';
 const owner:Account={id:'owner',playerId:'owner-player',email:'',role:'admin'};s.accounts.push(owner);
 s.players.push({id:owner.playerId,ownerId:owner.id,name:'正式群主',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
 for(const t of trialTargets){s.accounts.push({id:t.accountId,playerId:t.playerId,email:'',role:'member'});s.players.push({id:t.playerId,ownerId:t.accountId,name:t.name,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:'试用账号初始水平'})}
 s.events.push({id:'event',creatorId:owner.id,title:'将来的球局',start:now+2*86400000,end:now+2*86400000+3600000,venue:'测试',address:'',capacity:1,signupDeadline:now,cancelDeadline:now,note:'',status:'open',courtMode:'interval',ballMode:'interval'});
 s.registrations.push({id:'trial-registration',eventId:'event',playerId:trialTargets[0].playerId,sequence:1,status:'confirmed',arrival:s.events[0].start,departure:s.events[0].end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 return {s,owner};
}
test('准确移除三组试用身份和未来报名，正式球友不变；重复清理幂等',()=>{
 const {s,owner}=fixture(),real=structuredClone(s.players[0]),events=structuredClone(s.events);
 assert.equal(archiveTrials(s,owner,now),true);assert.deepEqual(s.players,[real]);assert.equal(s.accounts.length,1);assert.equal(s.registrations.length,0);assert.deepEqual(s.events,events);
 assert.equal(trialCleanupStatus(s,owner).canRestore,true);const saved=structuredClone(s);assert.equal(archiveTrials(s,owner,now),false);assert.deepEqual(s,saved);
});
test('普通成员和其他管理员都不能清理或恢复试用账号',()=>{
 for(const role of ['member','admin'] as const){const {s}=fixture(),a={id:'other',playerId:'other',email:'',role},before=structuredClone(s);assert.throws(()=>archiveTrials(s,a,now),/403/);assert.throws(()=>restoreTrials(s,a,now),/403/);assert.throws(()=>trialCleanupStatus(s,a),/403/);assert.deepEqual(s,before)}
});
test('试用账号发出的旧打法标签票一并存档，可随账号恢复且不覆盖其他投票',()=>{
 const {s,owner}=fixture(),vote={id:'trial-style-vote',voterId:trialTargets[0].accountId,playerId:owner.playerId,tag:'网前雨刮器',at:now-1000};
 s.tagVotes.push(vote);archiveTrials(s,owner,now);assert.equal(s.tagVotes.length,0);restoreTrials(s,owner,now);assert.deepEqual(s.tagVotes,[vote]);
 archiveTrials(s,owner,now);s.tagVotes.push({...vote,tag:'其他已存在记录'});const before=structuredClone(s);assert.throws(()=>restoreTrials(s,owner,now),/不能覆盖恢复/);assert.deepEqual(s,before);
});
test('改名、身份被替换、已有计分比赛或参与记录时拒绝且不改变数据',()=>{
 for(const mutation of [(s:any)=>s.players[1].name='正式成员',(s:any)=>s.accounts[1].role='admin',(s:any)=>s.players[1].ratedGames=1,(s:any)=>s.registrations[0].arrival=now,(s:any)=>s.attendance.push({id:'attendance',eventId:'event',playerId:trialTargets[0].playerId,start:now,end:now+1000,state:'left'})]){const {s,owner}=fixture();mutation(s);const before=structuredClone(s);assert.throws(()=>archiveTrials(s,owner,now));assert.deepEqual(s,before)}
});
test('恢复原身份及档案但不夺回报名名额；恢复冲突拒绝且幂等',()=>{
 const {s,owner}=fixture(),players=structuredClone(s.players),accounts=structuredClone(s.accounts);archiveTrials(s,owner,now);assert.equal(restoreTrials(s,owner,now),true);assert.deepEqual(s.players,players);assert.deepEqual(s.accounts,accounts);assert.equal(s.registrations.length,0);assert.equal(restoreTrials(s,owner,now),false);
 archiveTrials(s,owner,now);s.accounts.push(accounts[1]);const before=structuredClone(s);assert.throws(()=>restoreTrials(s,owner,now),/不能覆盖恢复/);assert.deepEqual(s,before);
});
