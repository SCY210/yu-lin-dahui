import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {applySocial} from '../lib/domain/social-commands';
import {canManageEvent} from '../lib/domain/permissions';
import {emptyState,type Account,type Event} from '../lib/domain/types';

const start=Date.parse('2026-10-04T13:00:00Z'),end=start+2*3600000;
const member:Account={id:'organizer',role:'member',playerId:'self',email:'member@example.invalid'};
const admin:Account={id:'admin',role:'admin',playerId:'admin-player',email:'admin@example.invalid'};
function fixture(){
 const s=emptyState();s.accounts.push(member,admin);
 for(const [id,ownerId] of [['self',member.id],['friend',member.id],['other','other-account'],['fourth','fourth-account'],['admin-player',admin.id]])s.players.push({id,ownerId,name:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'测试'});
 const base:Event={id:'own',creatorId:member.id,title:'球局',start,end,venue:'测试',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'live',courtMode:'interval',ballMode:'interval'};
 s.events.push(base,{...base,id:'foreign',creatorId:'another-organizer'});
 for(const e of s.events){
  s.bookings.push({id:e.id+'-court',eventId:e.id,name:'一号场',start,end,pricing:'hourly',cents:1000});
  s.costs.push({id:e.id+'-cost',eventId:e.id,type:'ball',name:'耗球',pricing:'unit',cents:200,tubeCount:12,used:1,start:null,end:null,bearer:'members'});
  s.attendance.push({id:e.id+'-attendance',eventId:e.id,playerId:'self',start,end:null,state:'ready'});
  s.rounds.push({id:e.id+'-round',eventId:e.id,start,duration:20,status:'draft',eligible:['self','friend','other','fourth'],rest:[],seed:1});
  s.matches.push({id:e.id+'-match',eventId:e.id,roundId:e.id+'-round',courtId:e.id+'-court',a:['self','friend'],b:['other','fourth'],status:'draft',start:null,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]});
 }
 return s;
}
const eventPayload={title:'普通成员新活动',start,end,venue:'测试',address:'',capacity:4,signupDeadline:start,cancelDeadline:start,note:'',status:'draft',bookings:[{name:'一号场',start,end,pricing:'hourly',cents:1000}]};
test('普通账号创建活动，创建者身份由服务端记录且不能伪造',async()=>{
 const s=fixture();await apply(s,member,'event',{...eventPayload,creatorId:'admin'},start);
 const e=s.events.at(-1)!;assert.equal(e.creatorId,member.id);assert.equal(e.status,'draft');assert.equal(s.bookings.at(-1)!.eventId,e.id);
 assert.ok(canManageEvent(member,e));assert.ok(!canManageEvent(member,{creatorId:admin.id}));assert.ok(!canManageEvent(member,{}));assert.ok(canManageEvent(admin,{}));
});

const foreignActions:Record<string,Record<string,unknown>>={
 eventStatus:{status:'ended'},eventEdit:{title:'修改',venue:'测试',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',reason:'测试'},
 booking:{name:'二号场',start,end,pricing:'hourly',cents:1000,reason:'测试'},bookingEdit:{bookingId:'foreign-court',name:'修改',start,end,pricing:'hourly',cents:1000,reason:'测试'},
 moveQueue:{playerId:'self',beforePlayerId:'other',reason:'测试'},attendance:{playerId:'self',at:start,state:'paused'},attendanceEdit:{attendanceId:'foreign-attendance',start,end,reason:'测试'},
 generate:{at:start,duration:20,seed:1},swap:{roundId:'foreign-round',p1:'self',p2:'other'},moveCourt:{matchId:'foreign-match',courtId:'own-court'},lock:{matchId:'foreign-match',locked:true},
 publish:{roundId:'foreign-round'},start:{roundId:'foreign-round',at:start,monthly:true,elo:true},cancelRound:{roundId:'foreign-round',reason:'测试'},score:{matchId:'foreign-match',a:21,b:19,end:start+60000,reason:'测试'},void:{matchId:'foreign-match',status:'cancelled',reason:'测试'},
 cost:{type:'other',name:'费用',pricing:'total',cents:100,tubeCount:12,used:0,start:null,end:null,bearer:'members',reason:'测试'},costOverride:{costId:'foreign-cost',segments:[{start,end,cents:200}],reason:'测试'},bookingBearer:{bookingId:'foreign-court',bearer:'subsidy',reason:'测试'},deleteCost:{costId:'foreign-cost',reason:'测试'},
 modes:{courtMode:'equal',ballMode:'equal',reason:'测试'},exemption:{playerId:'self',type:'ball',mode:'subsidy',reason:'测试'},settle:{confirmed:false,reason:'测试'},
 playSettings:{playMode:'balanced',identityMode:'off',arenaCourtId:'',handicap:false},handicap:{matchId:'foreign-match',applied:true},challengeMatch:{challengeId:'challenge',matchId:'foreign-match'},
};
for(const [action,payload] of Object.entries(foreignActions))test(`成员不能对他人活动执行 ${action}，嵌套记录忽略伪造 eventId`,async()=>{
 const s=fixture(),before=structuredClone(s);
 const nested=Object.keys(payload).some(k=>['bookingId','attendanceId','roundId','matchId','costId'].includes(k));
 await assert.rejects(()=>apply(s,member,action,{...payload,eventId:nested?'own':'foreign'},start),/403/);
 assert.deepEqual(s,before);
});
test('社群命令直接调用也校验活动创建者',async()=>{
 const s=fixture();await assert.rejects(()=>applySocial(s,member,'playSettings',{eventId:'foreign',playMode:'balanced',identityMode:'off',arenaCourtId:'',handicap:false},start),/403/);
 await applySocial(s,member,'playSettings',{eventId:'own',playMode:'koc',identityMode:'cp',arenaCourtId:'',handicap:true},start);assert.equal(s.events[0].playMode,'koc');
});
test('普通创建者完整管理报名、出勤、排场、比赛结果和费用，无需管理员角色',async()=>{
 const s=fixture();s.events=s.events.slice(0,1);s.rounds=[];s.matches=[];s.attendance=[];
 for(const playerId of ['self','friend','other','fourth']){
  await apply(s,member,'register',{eventId:'own',playerId,arrival:start,departure:end,note:''},start+60000);
  await apply(s,member,'attendance',{eventId:'own',playerId,at:start,state:'ready'},start);
 }
 await apply(s,member,'generate',{eventId:'own',at:start,duration:20,seed:12},start);
 const r=s.rounds[0],m=s.matches[0];
 await apply(s,member,'lock',{matchId:m.id,locked:true},start);await apply(s,member,'lock',{matchId:m.id,locked:false},start);
 await apply(s,member,'swap',{roundId:r.id,p1:'self',p2:'other'},start);await apply(s,member,'publish',{roundId:r.id},start);
 await apply(s,member,'start',{roundId:r.id,at:start,monthly:true,elo:true},start);
 await apply(s,member,'score',{matchId:m.id,a:21,b:19,end:start+20*60000,reason:'活动创建者确认'},start+20*60000);assert.equal(m.enteredBy,member.id);
 await apply(s,member,'bookingEdit',{bookingId:'own-court',name:'一号场',start,end,pricing:'total',cents:2000,reason:'费用确认'},end);
 await apply(s,member,'costOverride',{costId:'own-cost',reason:'确认耗球',segments:[{start,end,cents:200}]},end);
 for(const at of [...s.attendance])await apply(s,member,'attendanceEdit',{attendanceId:at.id,start,end,reason:'确认出勤'},end);
 await apply(s,member,'settle',{eventId:'own',confirmed:true,reason:'创建者确认分摊'},end);assert.equal(s.settlements[0].confirmed,true);assert.equal(s.settlements[0].bills.length,4);assert.equal(s.accounts[0].role,'member');
});
test('普通成员可以修改自己档案，但不可改名字、他人档案或代报朋友档案',async()=>{
 const s=fixture(),details={playerId:'self',years:3,hand:'left',preference:'doubles',style:'防守',equipment:'球拍'};
 await apply(s,member,'profileDetails',{...details,name:'越权改名'},start);assert.equal(s.players[0].profile?.hand,'left');assert.equal(s.players[0].name,'self');
 for(const playerId of ['self','other','friend'])await assert.rejects(()=>apply(s,member,'profile',{playerId,name:'改名'},start),/403/);
 for(const playerId of ['other','friend'])await assert.rejects(()=>apply(s,member,'profileDetails',{...details,playerId},start),/403/);
 await apply(s,admin,'profile',{playerId:'self',name:'管理员修改'},start);assert.equal(s.players[0].name,'管理员修改');
 await apply(s,admin,'profile',{name:'旧客户端管理员本人'},start);assert.equal(s.players.at(-1)!.name,'旧客户端管理员本人');
});
test('活动创建者没有账号权限、全局实力与历史规则管理权',async()=>{
 const s=fixture();for(const action of ['settings','rating','role','demo','historyRules','historyPreview'])await assert.rejects(()=>apply(s,member,action,{},start),/403/);
});
test('管理员仍可管理他人或未记录创建者的活动',async()=>{
 const s=fixture();delete s.events[1].creatorId;
 await apply(s,admin,'eventStatus',{eventId:'foreign',status:'ended'},start);assert.equal(s.events[1].status,'ended');
 await apply(s,admin,'bookingBearer',{bookingId:'foreign-court',bearer:'subsidy',reason:'管理员确认'},start);assert.equal(s.bookings[1].bearer,'subsidy');
});
test('管理员也不能载入虚构验收数据，空群组既有资料与审计保持不变',async()=>{
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=admin.id;
 s.accounts.push({...admin});s.players.push({id:admin.playerId,ownerId:admin.id,name:'已有管理员',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'已有资料'});
 s.audits.push({id:'existing-audit',at:start-1,actor:admin.id,action:'profile',reason:'已有操作记录'});
 const before=structuredClone(s);
 await assert.rejects(()=>apply(s,admin,'demo',{},start),/未知操作/);
 assert.deepEqual(s,before);
});
