import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Match,type Event} from '../lib/domain/types';
import {playerStats,annual,funnyStats,arenaStatus,relationships,winner,tier} from '../lib/domain/social';
import {apply} from '../lib/domain/commands';
import {propose} from '../lib/domain/grouping';
import {decorateMatch,rotationPlan} from '../lib/domain/play';
import {leaderboard,replayRating} from '../lib/domain/ranking';
import {tensionRange,tensionLabel} from '../lib/domain/tension';
const start=Date.parse('2026-10-04T10:00:00Z');
function fixture(n=6){const s=emptyState();const e:Event={id:'e',title:'虚构社群测试',start,end:start+6*3600000,venue:'测试',address:'',capacity:30,signupDeadline:start,cancelDeadline:start,note:'',status:'live',courtMode:'interval',ballMode:'interval'};s.events.push(e);for(let i=0;i<n;i++){const id=String.fromCharCode(65+i),owner='u'+id;s.players.push({id,ownerId:owner,name:'虚构'+id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'测试'});s.accounts.push({id:owner,email:owner+'@example.invalid',role:i===0?'admin':'member',playerId:id});s.attendance.push({id:'at'+id,eventId:e.id,playerId:id,start,end:null,state:'ready'})}for(let i=0;i<3;i++)s.bookings.push({id:'c'+i,eventId:e.id,name:'场'+i,start,end:e.end,pricing:'hourly',cents:0});return {s,e}}
function match(id:string,a=['A','B'],b=['C','D'],win=true,at=start):Match{return {id,eventId:'e',roundId:'r',courtId:'c0',a,b,status:'complete',start:at,end:at+20*60000,scoreA:win?21:19,scoreB:win?19:21,games:[{a:win?21:19,b:win?19:21}],monthly:true,elo:true,locked:false,enteredBy:'uA'}}
test('搭档默契与克制关系按真实双打对位统计，低样本不产生最佳标签',()=>{const {s}=fixture();s.matches=[match('1')];assert.equal(playerStats(s,'A').bestPartner,null);for(let i=2;i<=4;i++)s.matches.push(match(String(i),['A','B'],['C','D'],i!==4,start+i*60000));for(let i=5;i<=7;i++)s.matches.push(match(String(i),['A','E'],['B','C'],false,start+i*60000));const a=playerStats(s,'A');assert.equal(a.bestPartner?.playerId,'B');assert.equal(a.worstPartner?.playerId,'E');assert.equal(a.partners.find(r=>r.playerId==='B')?.rate,.75);assert.equal(a.opponents.find(r=>r.playerId==='D')?.wins,3);assert.equal(a.opponents.find(r=>r.playerId==='D')?.losses,1)});
test('状态取最近10场，年度按Madrid自然年归属，趣味榜仅用真实多局',()=>{const {s}=fixture();for(let i=0;i<12;i++)s.matches.push(match(String(i),undefined,undefined,i>=5,start+i*60000));assert.equal(playerStats(s,'A').formValue,70);assert.equal(playerStats(s,'A').form,'🔥 火热');const multi=match('three');multi.games=[{a:21,b:19},{a:19,b:21},{a:21,b:19}];multi.scoreA=2;multi.scoreB=1;s.matches.push(multi);assert.equal(funnyStats(s,'2026-10').find(r=>r.playerId==='A')?.threeGames,1);s.matches.push(match('newyear',undefined,undefined,true,Date.parse('2025-12-31T23:30:00Z')));assert.equal(annual(s,'A',2026).games,14);assert.equal(annual(s,'A',2025).games,0);assert.equal(tier(1000),'炼气')});
test('三局两胜以局数确定胜者，而非总分；Elo及月榜正确',async()=>{const {s,e}=fixture(4);const m=match('multi');m.status='playing';m.scoreA=null;m.scoreB=null;m.games=[];s.matches.push(m);s.rounds.push({id:'r',eventId:e.id,start,duration:20,status:'playing',eligible:['A','B','C','D'],rest:[],seed:1});await apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:19,games:[{a:21,b:19},{a:0,b:21},{a:21,b:19}],end:start+3600000,reason:'三局测试'},start+3600000);assert.equal(winner(m),'a');assert.equal(m.scoreA,2);assert.equal(m.scoreB,1);assert.ok(s.players[0].rating>1000);assert.equal(leaderboard(s,'2026-10').find(r=>r.playerId==='A')?.points,3);assert.equal(leaderboard(s,'2026-10').find(r=>r.playerId==='A')?.margin,-17);await assert.rejects(()=>apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:15,games:[{a:21,b:15},{a:15,b:21}],end:start+3600000,reason:'未完成'},start),/赢两局/)});
test('复仇挑战必须来源于失利，只有目标可以接受，管理员关联双方对位比赛',async()=>{const {s}=fixture();s.matches.push(match('loss',['A','B'],['C','D'],false));await assert.rejects(()=>apply(s,s.accounts[1],'challenge',{targetId:'E'},start),/尚未/);await apply(s,s.accounts[1],'challenge',{targetId:'C'},start);const c=s.challenges[0];await assert.rejects(()=>apply(s,s.accounts[3],'challengeRespond',{challengeId:c.id,status:'accepted'},start),/403/);await apply(s,s.accounts[2],'challengeRespond',{challengeId:c.id,status:'accepted'},start);const m=match('next');m.status='draft';s.matches.push(m);await apply(s,s.accounts[0],'challengeMatch',{challengeId:c.id,matchId:m.id},start);assert.equal(c.matchId,m.id);await assert.rejects(()=>apply(s,s.accounts[1],'challengeMatch',{challengeId:c.id,matchId:m.id},start),/403/)});
test('活动打完后标签与奖项开放，每账号每类一票且权限正确',async()=>{const {s,e}=fixture();await assert.rejects(()=>apply(s,s.accounts[1],'awardVote',{eventId:e.id,playerId:'A',category:'mvp'},start),/尚未打完/);e.status='ended';const payload={eventId:e.id,playerId:'A',tag:'防守怪',active:true};await apply(s,s.accounts[1],'tagVote',payload,e.end);await apply(s,s.accounts[1],'tagVote',payload,e.end);assert.equal(s.tagVotes.length,1);await apply(s,s.accounts[1],'tagVote',{...payload,active:false},e.end);assert.equal(s.tagVotes.length,0);await apply(s,s.accounts[1],'awardVote',{eventId:e.id,playerId:'A',category:'mvp'},e.end);await apply(s,s.accounts[1],'awardVote',{eventId:e.id,playerId:'C',category:'mvp'},e.end);assert.equal(s.awardVotes.length,1);assert.equal(s.awardVotes[0].playerId,'C');await assert.rejects(()=>apply(s,s.accounts[1],'awardVote',{eventId:e.id,playerId:'B',category:'mvp'},e.end),/其他球友/)});
test('球友档案只允许自己、代报者或管理员编辑',async()=>{const {s}=fixture();const p={playerId:'B',years:3,hand:'left',preference:'doubles',style:'防守',equipment:'测试球拍',level:'intermediate'};await apply(s,s.accounts[1],'profileDetails',p,start);assert.equal(s.players[1].profile?.hand,'left');await assert.rejects(()=>apply(s,s.accounts[2],'profileDetails',p,start),/403/)});

test('个人口号按本人档案保存并trim，空白可清空且不修改姓名',async()=>{
 const {s}=fixture(),owner=s.accounts[1],player=s.players[1],name=player.name;
 const p={playerId:player.id,years:3,hand:'left',preference:'doubles',style:'防守',equipment:'测试球拍',level:'intermediate'};
 await apply(s,owner,'profileDetails',{...p,motto:'  每一拍都全力以赴  ',name:'不能自行改名'},start);
 assert.equal(player.profile?.motto,'每一拍都全力以赴');assert.equal(player.name,name);
 await apply(s,owner,'profileDetails',{...p,motto:'球'.repeat(80)},start);assert.equal(player.profile?.motto?.length,80);
 await apply(s,owner,'profileDetails',{...p,motto:'   '},start);assert.equal(player.profile?.motto,'');
});

test('个人口号超过80字时拒绝且State完全不变',async()=>{
 const {s}=fixture(),owner=s.accounts[1];
 const p={playerId:'B',years:3,hand:'left',preference:'doubles',style:'防守',equipment:'测试球拍',level:'intermediate'};
 await apply(s,owner,'profileDetails',{...p,motto:'保留口号'},start);const before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'profileDetails',{...p,motto:'球'.repeat(81),style:'不应被保存'},start));
 assert.deepEqual(s,before);
});

test('旧档案payload省略或undefined口号时保留旧值',async()=>{
 const {s}=fixture(),owner=s.accounts[1],player=s.players[1];
 const p={playerId:'B',years:3,hand:'left',preference:'doubles',style:'防守',equipment:'测试球拍',level:'intermediate'};
 await apply(s,owner,'profileDetails',{...p,motto:'球场见'},start);
 await apply(s,owner,'profileDetails',{...p,style:'新打法'},start);assert.equal(player.profile?.motto,'球场见');
 await apply(s,owner,'profileDetails',{...p,motto:undefined},start);assert.equal(player.profile?.motto,'球场见');
});

test('口号字段沿用本人编辑与群主保护，普通成员不能改他人或姓名',async()=>{
 const {s}=fixture();s.settings.ownerAccountId=s.accounts[0].id;
 s.accounts[2].role='admin';
 const profile={years:3,hand:'left',preference:'doubles',style:'防守',equipment:'测试球拍',level:'intermediate',motto:'越权口号'};
 for(const [actor,target] of [[s.accounts[1],'C'],[s.accounts[2],'A']] as const){
  const before=structuredClone(s);await assert.rejects(()=>apply(s,actor,'profileDetails',{...profile,playerId:target},start),/403/);assert.deepEqual(s,before);
 }
 const before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[1],'profile',{playerId:'B',name:'越权改名'},start),/403/);assert.deepEqual(s,before);
 await apply(s,s.accounts[0],'profileDetails',{...profile,playerId:'A',motto:'群主自己的口号'},start);assert.equal(s.players[0].profile?.motto,'群主自己的口号');
});
test('穿线磅数范围验证、兼容旧值、空值清除及旧客户端保留',async()=>{
 const {s}=fixture();const player=s.players[1],owner=s.accounts[1];
 const p={playerId:'B',years:3,hand:'left',preference:'doubles',style:'防守',equipment:'测试球拍',level:'intermediate'};
 await apply(s,owner,'profileDetails',{...p,tension:'26磅'},start);
 assert.deepEqual(tensionRange(player.profile),{min:26,max:26});
 assert.equal(tensionLabel(player.profile),'26–26 磅');
 assert.deepEqual(tensionRange({tension:'24～28 lbs'}),{min:24,max:28});
 assert.equal(tensionLabel({tension:'约26磅'}),'旧记录：约26磅');
 await apply(s,owner,'profileDetails',{...p,tensionMin:24.5,tensionMax:28},start);
 assert.equal(tensionLabel(player.profile),'24.5–28 磅');
 await apply(s,owner,'profileDetails',{...p,style:'新打法'},start);
 assert.equal(tensionLabel(player.profile),'24.5–28 磅');
 await assert.rejects(()=>apply(s,owner,'profileDetails',{...p,tensionMin:28,tensionMax:24},start),/最高磅数/);
 await assert.rejects(()=>apply(s,owner,'profileDetails',{...p,tensionMin:24},start),/同时填写/);
 await assert.rejects(()=>apply(s,owner,'profileDetails',{...p,tensionMin:0,tensionMax:28},start));
 await assert.rejects(()=>apply(s,s.accounts[2],'profileDetails',{...p,tensionMin:24,tensionMax:28},start),/403/);
 assert.equal(tensionLabel(player.profile),'24.5–28 磅');
 await apply(s,owner,'profileDetails',{...p,tensionMin:null,tensionMax:null},start);
 assert.equal(tensionLabel(player.profile),'');assert.equal(player.profile?.tension,'');
});
test('智能搭档避免连续重复；CP种子可重现，师徒按实力标注',()=>{const {s,e}=fixture(4);const first=propose(s,e,start,20,42);const m=match('prev',first.courts[0].a,first.courts[0].b);s.matches.push(m);const second=propose(s,e,start+3600000,20,42);for(const pair of [second.courts[0].a,second.courts[0].b])assert.ok(![m.a,m.b].some(t=>pair.every(id=>t.includes(id))));assert.deepEqual(propose(s,e,start+3600000,20,42).courts,second.courts);e.identityMode='mentor';s.players[0].rating=1400;s.players[1].rating=800;decorateMatch(s,e,m);assert.equal(m.identity?.find(r=>r.playerId==='A')?.label,'师傅');assert.equal(m.identity?.find(r=>r.playerId==='B')?.label,'徒弟')});
test('11人3片场自动使用2片，8人上场3人轮休',()=>{const {s,e}=fixture(11);const p=rotationPlan(s,e,start,20);assert.equal(p.usedCourts,2);assert.equal(p.playing,8);assert.equal(p.rest,3);assert.equal(p.cycle,11);assert.equal(propose(s,e,start,20,1).courts.length,2)});
test('擂台固定赢方，新接擂者替换败方，连胜与物理场地跨时段正确',()=>{const {s,e}=fixture(6);e.playMode='arena';e.arenaCourtId='c0';const m=match('arena');m.playMode='arena';s.matches.push(m);const p=propose(s,e,start+3600000,20,1);assert.deepEqual(p.courts[0].a,['A','B']);assert.deepEqual(new Set(p.courts[0].b),new Set(['E','F']));assert.equal(arenaStatus(s,e.id).streak,1);s.bookings[0].end=start+2*3600000;s.bookings.push({...s.bookings[0],id:'c0-later',start:start+3*3600000,end:e.end});assert.equal(propose(s,e,start+3*3600000,20,1).courts[0].courtId,'c0-later')});
test('让分建议须确认；确认的比赛不更新月榜和Elo',async()=>{const {s,e}=fixture(4);e.handicap=true;s.players[0].rating=1800;s.players[1].rating=1700;const m=match('handicap');m.status='published';m.start=null;m.end=null;m.scoreA=null;m.scoreB=null;m.games=[];decorateMatch(s,e,m);s.matches.push(m);s.rounds.push({id:'r',eventId:e.id,start,duration:20,status:'published',eligible:['A','B','C','D'],rest:[],seed:1});assert.equal(m.handicap?.applied,false);await apply(s,s.accounts[0],'handicap',{matchId:m.id,applied:true},start);await apply(s,s.accounts[0],'start',{roundId:'r',at:start,monthly:true,elo:true},start);assert.equal(m.monthly,false);assert.equal(m.elo,false)});
test('接龙上限由创建者填写并独立保存，排场不覆盖人数上限',async()=>{const {s}=fixture();s.events=[];s.bookings=[];const payload={title:'创建者的球局',start,end:start+3600000,venue:'虚构球馆',address:'',capacity:2,signupDeadline:start,cancelDeadline:start,note:'',status:'open',bookings:[{name:'场地',start,end:start+3600000,pricing:'total',cents:0}]};await apply(s,s.accounts[0],'event',payload,start);assert.equal(s.events[0].capacity,2);assert.equal(s.events[0].creatorId,s.accounts[0].id);const e=s.events[0];rotationPlan(s,e,start);assert.equal(e.capacity,2)});
test('擂台仅固定一片场，其他场地正常轮转，败者不立即回擂台',()=>{const {s,e}=fixture(16);e.playMode='arena';e.arenaCourtId='c0';const m=match('arena');m.playMode='arena';s.matches.push(m);const next=propose(s,e,start+3600000,20,7);assert.equal(next.courts.length,3);assert.deepEqual(next.courts[0].a,['A','B']);assert.ok(next.courts[0].b.every(id=>!['C','D'].includes(id)));const ids=next.courts.flatMap(c=>[...c.a,...c.b]);assert.equal(new Set(ids).size,12);assert.equal(next.rest.length,4)});
test('King个人得分来自每局实际得分，轮转只接受一局制',async()=>{const {s,e}=fixture(4);e.playMode='koc';const m=match('koc');m.playMode='koc';s.matches.push(m);const {courtLeaderboard}=await import('../lib/domain/social');assert.equal(courtLeaderboard(s,e.id).find(r=>r.playerId==='A')?.points,21);s.rounds.push({id:'r',eventId:e.id,start,duration:20,status:'complete',eligible:['A','B','C','D'],rest:[],seed:1});await assert.rejects(()=>apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:19,games:[{a:21,b:19},{a:21,b:19}],end:start+3600000,reason:'不能固定搭档打多局'},e.end),/一局制/)});
