import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {projectClubState} from '../lib/club-view';
import {privateEventState} from '../lib/domain/event-privacy';
import {emptyState,type Account,type Event} from '../lib/domain/types';
import {replayRating} from '../lib/domain/ranking';
import {enableDefaultAttendance,applyDefaultAttendance} from '../lib/domain/attendance';

const at=Date.parse('2026-10-05T10:00:00Z');
const owner:Account={id:'owner',role:'member',playerId:'a',email:''};
const outsider:Account={id:'outsider',role:'member',playerId:'c',email:''};
const admin:Account={id:'admin',role:'admin',playerId:'d',email:''};
function fixture(){
 const s=emptyState();s.accounts=[owner,outsider,admin];s.settings.ownerAccountId=admin.id;
 s.players=['a','b','c','d'].map(id=>({id,ownerId:id==='a'||id==='b'?owner.id:id==='c'?outsider.id:admin.id,name:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 const e:Event={id:'own',creatorId:owner.id,title:'删除验收',start:at,end:at+3600000,capacity:4,signupDeadline:at+3600000,cancelDeadline:at+3600000,status:'ended',venue:'虚构球馆',address:'',note:'',courtMode:'interval',ballMode:'interval'};
 s.events=[e,{...e,id:'other',creatorId:outsider.id,title:'他人活动',status:'open'}];
 for(const e of s.events){
  s.bookings.push({id:e.id+'-court',eventId:e.id,name:'一号场',start:at,end:e.end,pricing:'total',cents:1000});
  s.registrations.push({id:e.id+'-reg',eventId:e.id,playerId:'a',status:'confirmed',sequence:1,arrival:at,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
  s.attendance.push({id:e.id+'-at',eventId:e.id,playerId:'a',start:at,end:e.end,state:'left'});
  s.rounds.push({id:e.id+'-round',eventId:e.id,start:at,duration:20,status:'complete',eligible:['a','b','c','d'],rest:[],seed:1});
  s.matches.push({id:e.id+'-match',eventId:e.id,roundId:e.id+'-round',courtId:e.id+'-court',a:['a','b'],b:['c','d'],status:'complete',start:at,end:at+1200000,scoreA:21,scoreB:19,games:[{a:21,b:19}],monthly:true,elo:true,locked:false,enteredBy:owner.id});
  s.costs.push({id:e.id+'-cost',eventId:e.id,type:'other',name:'费用',pricing:'total',cents:100,tubeCount:1,used:1,start:null,end:null,bearer:'members'});
  s.awardVotes.push({id:e.id+'-vote',eventId:e.id,playerId:'a',voterId:outsider.id,category:'mvp',at});
  s.photos.push({id:e.id+'-photo',eventId:e.id,matchId:e.id+'-match',playerIds:['a'],ownerId:owner.id,caption:'',created:at,key:'media/'+e.id,type:'image/png',size:100,kind:'photo'});
 }
 s.photos.push({...s.photos[0],id:'racket',eventId:null,matchId:null,kind:'racket'},{...s.photos[0],id:'avatar',eventId:null,matchId:null,kind:'avatar'});
 s.challenges.push({id:'revenge',challengerId:'c',targetId:'a',sourceMatchId:'own-match',matchId:null,status:'pending',created:at});
 replayRating(s);return s;
}

test('创建者删除与恢复完整活动，保存关联记录、历史实力与审计，不接受伪造删除者',async()=>{
 const s=fixture(),before=structuredClone(s);
 await apply(s,owner,'deleteEvent',{eventId:'own',reason:'误建',deletedBy:'admin'},at+3600000);
 assert.equal(s.events[0].deletedAt,at+3600000);assert.equal(s.events[0].deletedBy,owner.id);
 for(const key of ['players','matches','bookings','registrations','attendance','rounds','costs','photos','awardVotes','ratingChanges'] as const)assert.deepEqual(s[key],before[key]);
 assert.equal(s.audits.at(-1)!.actor,owner.id);assert.equal(s.audits.at(-1)!.action,'deleteEvent');
 await apply(s,owner,'restoreEvent',{eventId:'own',reason:'恢复'},at+3600001);
 assert.deepEqual(s.events,before.events);assert.equal(s.audits.at(-1)!.action,'restoreEvent');
});
for(const action of ['deleteEvent','restoreEvent'])test('普通成员不能'+action+'他人活动或伪造创建者',async()=>{
 const s=fixture();s.events[0].deletedAt=0;const before=structuredClone(s);
 await assert.rejects(()=>apply(s,outsider,action,{eventId:'own',creatorId:outsider.id,reason:'越权'},at),/403/);assert.deepEqual(s,before);
});
test('管理员可删除与恢复旧活动，重复请求不会覆盖删除时间或产生重复审计',async()=>{
 const s=fixture();delete s.events[0].creatorId;
 await apply(s,admin,'deleteEvent',{eventId:'own',reason:'清理旧活动'},0);const once=structuredClone(s);
 await apply(s,admin,'deleteEvent',{eventId:'own',reason:'重复'},1);assert.deepEqual(s,once);
 await apply(s,admin,'restoreEvent',{eventId:'own',reason:'恢复'},2);const restored=structuredClone(s);
 await apply(s,admin,'restoreEvent',{eventId:'own',reason:'重复'},3);assert.deepEqual(s,restored);
});
test('进行中的比赛阻止删除，不会修改任何状态；比赛结束后可以删除',async()=>{
 const s=fixture();s.matches[0].status='playing';const before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'deleteEvent',{eventId:'own',reason:'删除'},at),/正在进行/);assert.deepEqual(s,before);
 s.matches[0].status='complete';await apply(s,owner,'deleteEvent',{eventId:'own',reason:'结束后删除'},at);assert.equal(s.events[0].deletedAt,at);
});
test('删除活动后禁止开赛、报名、取消报名、投票和嵌套记录修改，包括管理员',async()=>{
 const s=fixture();s.events[0].deletedAt=0;
 const requests:[string,unknown][]=[['register',{eventId:'own',playerId:'a',arrival:at,departure:at+3600000,note:''}],['cancel',{eventId:'own',playerId:'a',reason:'取消'}],['eventStatus',{eventId:'own',status:'open'}],['start',{roundId:'own-round',eventId:'other',at,monthly:true,elo:true}],['bookingBearer',{bookingId:'own-court',eventId:'other',bearer:'subsidy',reason:'修改'}],['awardVote',{eventId:'own',playerId:'a',category:'mvp'}]];
 for(const account of [owner,admin])for(const [action,payload] of requests){const before=structuredClone(s);await assert.rejects(()=>apply(s,account,action,payload,at),/已删除/);assert.deepEqual(s,before);}
});
test('删除从各页面隐藏活动关联记录，恢复列表仅对创建者及管理员开放，历史榜单和档案战绩保留',async()=>{
 const s=fixture(),before=projectClubState(s,owner,'2026-10',2026,at+3600000);
 await apply(s,owner,'deleteEvent',{eventId:'own',reason:'误建'},at+3600000);
 const v=projectClubState(s,owner,'2026-10',2026,at+3600000),other=projectClubState(s,outsider,'2026-10',2026,at+3600000),av=projectClubState(s,admin,'2026-10',2026,at+3600000);
 assert.deepEqual(v.deletedEvents.map(e=>e.id),['own']);assert.deepEqual(other.deletedEvents,[]);assert.deepEqual(av.deletedEvents.map(e=>e.id),['own']);
 assert.deepEqual(Object.keys(v.deletedEvents[0]).sort(),['id','title','start','end','deletedAt'].sort());
 assert.deepEqual(v.events.map(e=>e.id),['other']);
 for(const key of ['bookings','registrations','attendance','rounds','matches','costs','settlements','awardVotes','drafts'] as const)assert.ok(v[key].every(r=>r.eventId!=='own'));
 assert.ok(!('own' in v.rotationPlans));assert.ok(!('own' in v.social.arenas));assert.ok(!('own-match' in v.social.matchLevels));assert.deepEqual(v.challenges,[]);
 assert.deepEqual(v.photos.map(p=>p.id).sort(),['other-photo','racket','avatar'].sort());
 assert.deepEqual(v.leaderboard,before.leaderboard);assert.deepEqual(v.annualLeaderboard,before.annualLeaderboard);assert.deepEqual(v.social.stats,before.social.stats);
 assert.equal(s.matches.length,2,'Projection must not persist record removal');
 await apply(s,owner,'restoreEvent',{eventId:'own',reason:'恢复'},at+3600001);const restored=projectClubState(s,owner,'2026-10',2026,at+3600000);assert.deepEqual(restored.events,before.events);assert.deepEqual(restored.matches,before.matches);assert.deepEqual(restored.deletedEvents,[]);
});
test('删除状态零值仍有效，自动维护不修改删除活动或生成计划出勤',()=>{
 const s=fixture();s.events[0].deletedAt=0;s.events[0].end=at+7200000;s.events[1].attendanceMode='manual';
 assert.equal(enableDefaultAttendance(s,at),false);assert.equal(s.events[0].attendanceMode,undefined);
 s.events[0].attendanceMode='automatic';const attendance=structuredClone(s.attendance);applyDefaultAttendance(s);assert.deepEqual(s.attendance,attendance);
});
test('不存在的活动与无效删除原因被拒绝，不修改原状态',async()=>{
 const s=fixture(),before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'deleteEvent',{eventId:'missing',reason:'删除'},at),/不存在/);
 await assert.rejects(()=>apply(s,owner,'deleteEvent',{eventId:'own',reason:' '},at));assert.deepEqual(s,before);
});

test('其他管理员也看不到删除列表、关联导出与审计，不能直接恢复；创建者和群主可恢复',async()=>{
 const s=fixture(),otherAdmin={...outsider,role:'admin' as const};s.accounts[1]=otherAdmin;
 await apply(s,owner,'deleteEvent',{eventId:'own',reason:'移除私有活动'},at+3600000);
 s.audits.push({id:'creation',actor:owner.id,at,action:'event',reason:'created',changes:{title:s.events[0].title}},
  {id:'nested',actor:owner.id,at,action:'score',reason:'score',changes:{input:{matchId:'own-match'}}},
  {id:'keep',actor:outsider.id,at,action:'eventStatus',reason:'live',changes:{eventId:'other'}});
 const before=structuredClone(s),view=projectClubState(s,otherAdmin,'2026-10',2026,at+3600000),exported=privateEventState(s,otherAdmin);
 assert.deepEqual(view.deletedEvents,[]);assert.deepEqual(view.audits.map(a=>a.id),['keep']);
 assert.deepEqual(exported.events.map(e=>e.id),['other']);assert.ok(!exported.matches.some(m=>m.eventId==='own'));
 assert.ok(!exported.photos.some(p=>p.eventId==='own'));assert.deepEqual(exported.challenges,[]);
 assert.deepEqual(exported.audits.map(a=>a.id),['keep']);assert.deepEqual(s,before);
 await assert.rejects(()=>apply(s,otherAdmin,'restoreEvent',{eventId:'own',reason:'越权恢复'},at+1),/403/);
 assert.deepEqual(s,before);assert.equal(privateEventState(s,admin),s);assert.equal(privateEventState(s,owner),s);
 await apply(s,admin,'restoreEvent',{eventId:'own',reason:'群主恢复'},at+3600001);assert.equal(s.events[0].deletedAt,undefined);
});
