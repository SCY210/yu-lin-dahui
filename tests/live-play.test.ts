import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {liveAppearances,liveResting} from '../lib/domain/live-play';
import {emptyState,type Event} from '../lib/domain/types';

const now=Date.parse('2026-10-10T15:00:00Z');
function fixture(count=8,courts=1){
 const s=emptyState();s.settings.initialized=true;
 const e:Event={id:'event',creatorId:'owner',title:'虚构实时活动',start:now-3600000,end:now+3*3600000,venue:'球馆',address:'',capacity:count,signupDeadline:now,cancelDeadline:now-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal'};
 s.events.push(e);s.settings.ownerAccountId='owner';
 for(let i=0;i<count;i++){
  const id='p'+String(i).padStart(2,'0'),accountId=i?'member'+i:'owner';
  s.players.push({id,name:id,ownerId:accountId,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
  s.accounts.push({id:accountId,email:'',role:i?'member':'admin',playerId:id});
  s.registrations.push({id:'reg'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 for(let i=0;i<courts;i++)s.bookings.push({id:'court'+i,eventId:e.id,name:'场地'+i,start:e.start,end:e.end,pricing:'total',cents:1000});
 return {s,e,owner:s.accounts[0]};
}
const active=(s:ReturnType<typeof emptyState>)=>s.matches.filter(m=>m.status==='playing');
const score=(s:ReturnType<typeof emptyState>,matchId:string,at=now+60000)=>apply(s,s.accounts[1],'score',{matchId,a:21,b:19,reason:'本局结束'},at);

test('各场独立推进，录分后自动开下一局且不重复安排正在打的人',async()=>{
 const {s,e,owner}=fixture(12,2);await apply(s,owner,'liveStart',{eventId:e.id},now);
 const original=active(s);assert.equal(original.length,2);assert.equal(e.status,'open');
 await score(s,original[0].id);
 assert.equal(s.matches.find(m=>m.id===original[0].id)!.status,'complete');
 assert.equal(s.matches.find(m=>m.id===original[1].id)!.status,'playing');
 assert.equal(active(s).length,2);assert.equal(s.matches.length,3);
 const ids=active(s).flatMap(m=>[...m.a,...m.b]);assert.equal(new Set(ids).size,ids.length);
 const replacement=active(s).find(m=>m.id!==original[1].id)!;
 assert.equal(s.rounds.find(r=>r.id===replacement.roundId)!.liveSequence,2);
 assert.equal(s.rounds.find(r=>r.id===replacement.roundId)!.duration,0);
 assert.equal(s.matches[0].end,now+60000);
});

test('不连续上场跳过下一局，再下一局恢复候选且偏好仍保留',async()=>{
 const {s,e,owner}=fixture();
 for(const account of s.accounts.slice(0,4))await apply(s,account,'livePreference',{eventId:e.id,playerId:account.playerId,avoidConsecutive:true},now);
 await apply(s,owner,'liveStart',{eventId:e.id},now);
 const first=active(s)[0],firstPlayers=[...first.a,...first.b];await score(s,first.id);
 const second=active(s)[0];assert.ok([...second.a,...second.b].every(id=>!firstPlayers.includes(id)));
 assert.ok(firstPlayers.every(id=>liveResting(e,id)));
 await score(s,second.id,now+120000);
 assert.deepEqual(new Set([...active(s)[0].a,...active(s)[0].b]),new Set(firstPlayers));
 assert.ok(firstPlayers.every(id=>!liveResting(e,id)));
 assert.equal(e.livePlay!.preferences.filter(p=>p.avoidConsecutive).length,4);
});

test('没有替补就等待，球友可在休息好后主动准备，不强迫连续上场',async()=>{
 const {s,e,owner}=fixture(4);
 for(const a of s.accounts)await apply(s,a,'livePreference',{eventId:e.id,playerId:a.playerId,avoidConsecutive:true},now);
 await apply(s,owner,'liveStart',{eventId:e.id},now);await score(s,active(s)[0].id);
 assert.equal(active(s).length,0);assert.equal(s.matches.length,1);
 for(const a of s.accounts)await apply(s,a,'liveReady',{eventId:e.id,playerId:a.playerId},now+120000);
 assert.equal(active(s).length,1);assert.ok(e.livePlay!.preferences.every(p=>p.avoidConsecutive));
});

test('另一片场仍在打的上一轮结束，不会误清除刚申请的轮休',async()=>{
 const {s,e,owner}=fixture(8,2);
 await apply(s,owner,'livePreference',{eventId:e.id,playerId:'p00',avoidConsecutive:true},now);
 await apply(s,owner,'liveStart',{eventId:e.id},now);const first=[...active(s)];
 await score(s,first[0].id,now+60000);assert.ok(liveResting(e,'p00'));
 await score(s,first[1].id,now+65000);assert.ok(liveResting(e,'p00'));
 assert.ok(active(s).every(m=>![...m.a,...m.b].includes('p00')));
 await score(s,active(s)[0].id,now+120000);assert.equal(liveResting(e,'p00'),false);
 assert.ok(active(s).some(m=>[...m.a,...m.b].includes('p00')));
});

test('静态14人两片场反复推进时，上场次数差保持不超过一次',async()=>{
 const {s,e,owner}=fixture(14,2);await apply(s,owner,'liveStart',{eventId:e.id},now);
 for(let cycle=0;cycle<24;cycle++){
  for(const match of [...active(s)])await score(s,match.id,now+(cycle+1)*60000);
  const counts=s.players.map(p=>liveAppearances(s,e.id,p.id));
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1,JSON.stringify(counts));
  assert.equal(new Set(active(s).flatMap(m=>[...m.a,...m.b])).size,8);
 }
});

test('权限按存储身份验证，成员不能替别人设轮休或启动排场',async()=>{
 const {s,e,owner}=fixture(),member=s.accounts[1];const before=structuredClone(s);
 await assert.rejects(()=>apply(s,member,'liveStart',{eventId:e.id,isOwner:true},now),/403/);
 await assert.rejects(()=>apply(s,member,'livePreference',{eventId:e.id,playerId:owner.playerId,avoidConsecutive:true,role:'admin'},now),/403/);
 assert.deepEqual(s,before);
 const friend={...s.players[0],id:'friend',ownerId:member.id};s.players.push(friend);s.registrations.push({...s.registrations[0],id:'friend-reg',playerId:friend.id});
 await apply(s,member,'livePreference',{eventId:e.id,playerId:friend.id,avoidConsecutive:true},now);
 assert.equal(e.livePlay!.preferences[0].playerId,friend.id);
});

test('候补、未到、停用和其他活动正在打的人不会被安排',async()=>{
 const {s,e,owner}=fixture();s.registrations[4].status='waitlist';s.registrations[5].arrival=now+60000;s.players[6].enabled=false;
 s.matches.push({id:'elsewhere',eventId:'other',roundId:'other-round',courtId:'other-court',a:['p07','x'],b:['y','z'],start:now,end:null,status:'playing',scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]});
 await apply(s,owner,'liveStart',{eventId:e.id},now);
 assert.deepEqual(new Set(s.matches.find(m=>m.eventId===e.id)!.a.concat(s.matches.find(m=>m.eventId===e.id)!.b)),new Set(['p00','p01','p02','p03']));
});

test('固定搭档完整上场，搭档轮休时不拆队',async()=>{
 const {s,e,owner}=fixture();e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:[['p00','p01'],['p02','p03'],['p04','p05'],['p06','p07']]};
 await apply(s,owner,'livePreference',{eventId:e.id,playerId:'p00',avoidConsecutive:true},now);
 await apply(s,owner,'liveStart',{eventId:e.id},now);await score(s,active(s)[0].id);
 const next=active(s)[0];assert.ok(![...next.a,...next.b].includes('p00'));
 assert.ok([next.a,next.b].every(team=>e.pointsChoice!.teams!.some(t=>t.every(id=>team.includes(id)))));
});

test('同一真实场地不会被重复使用；暂停允许录分但不继续排场',async()=>{
 const {s,e,owner}=fixture(8,2);s.bookings[1].name=s.bookings[0].name;
 await apply(s,owner,'liveStart',{eventId:e.id},now);assert.equal(active(s).length,1);
 await apply(s,owner,'livePause',{eventId:e.id,paused:true},now);
 await score(s,active(s)[0].id);assert.equal(active(s).length,0);
 await apply(s,owner,'livePause',{eventId:e.id,paused:false},now+120000);assert.equal(active(s).length,1);
});

test('纠正已完成比分不重复推进，实时对局不接受三局结果',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'liveStart',{eventId:e.id},now);
 const first=active(s)[0];await assert.rejects(()=>apply(s,owner,'score',{matchId:first.id,a:21,b:19,games:[{a:21,b:19},{a:21,b:17}],reason:'测试'},now+60000),/一局/);
 await score(s,first.id);const count=s.matches.length,cooldown=structuredClone(e.livePlay);
 await apply(s,s.accounts[1],'score',{matchId:first.id,a:19,b:21,reason:'纠正比分'},now+120000);
 assert.equal(s.matches.length,count);assert.deepEqual(e.livePlay,cooldown);assert.equal(first.end,now+60000);
});

test('未来活动不启动且不留下部分配置，既有完成结果保留',async()=>{
 const {s,e,owner}=fixture();e.start=now+60000;const before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'liveStart',{eventId:e.id},now),/活动进行/);assert.deepEqual(s,before);
});
