import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Event,type Match,type Round} from '../lib/domain/types';
import {calculateSettlementPreview} from '../lib/domain/money';

const hour=3600000,start=Date.parse('2030-11-10T17:00:00Z'),end=start+2*hour,early=start-3*86400000;
function fixture(){
 const s=emptyState();s.settings.ownerAccountId='owner';
 s.accounts=[{id:'owner',playerId:'p0',role:'admin',email:''},{id:'creator',playerId:'p1',role:'member',email:''},{id:'outsider',playerId:'p2',role:'member',email:''}];
 for(let i=0;i<10;i++)s.players.push({id:'p'+i,name:'虚构球友'+i,ownerId:i===1?'creator':i===2?'outsider':'owner',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
 const e:Event={id:'event',creatorId:'creator',title:'虚构取消场地活动',start,end,venue:'虚构球馆',address:'',capacity:8,status:'open',signupDeadline:start-2*hour,cancelDeadline:start-24*hour,note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events.push(e);s.bookings.push(...['A','B'].map(id=>({id,eventId:e.id,name:id+'号场',start,end,signupCapacity:4,pricing:'total' as const,cents:1200})));
 const join=(i:number,bookingId='A',arrival=start,departure=end)=>apply(s,s.accounts[0],'courtRegister',{bookingId,playerId:'p'+i,arrival,departure,note:'原接龙'},early);
 const cancel=(bookingId='A',actor=s.accounts[1],now=early)=>apply(s,actor,'bookingCancel',{bookingId},now);
 const round:Round={id:'round',eventId:e.id,start,duration:15,status:'published',eligible:[],rest:[],seed:7};
 const match=(id:string,courtId:string,players=['p1','p2','p3','p4']):Match=>({id,eventId:e.id,roundId:round.id,courtId,a:players.slice(0,2),b:players.slice(2),status:'published',start:null,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]});
 return {s,e,join,cancel,round,match};
}

test('创建者可取消单场，正式及候补接龙撤销，其他场地及原审计数据保留',async()=>{
 const {s,e,join,cancel}=fixture();s.bookings[0].signupCapacity=1;
 await join(1,'A',start,start+hour);await join(2,'A',start,start+hour);await join(1,'B',start+hour,end);await join(3,'B',start+hour,end);
 const original=structuredClone(s.bookings[0]);await cancel();
 assert.deepEqual(s.bookings.map(b=>b.id),['B']);
 const one=s.registrations.find(r=>r.playerId==='p1')!,two=s.registrations.find(r=>r.playerId==='p2')!;
 assert.equal(one.bookingSignups![0].status,'cancelled');assert.equal(one.bookingSignups![1].status,'confirmed');assert.equal(one.status,'confirmed');
 assert.equal(two.status,'cancelled');assert.equal(two.cancelledAs,'organizer');assert.equal(two.cancelReason,'场地取消');
 assert.equal(calculateSettlementPreview(s,e,early).total,1200);
 const audit=s.audits.at(-1)!,changes=audit.changes as {booking:unknown;registrations:unknown[]};assert.equal(audit.action,'bookingCancel');assert.deepEqual(changes.booking,original);assert.equal(changes.registrations.length,2);
});

test('权限按服务端场地归属判断，普通成员和测试员不能伪造其他活动权限',async()=>{
 const {s,e,cancel}=fixture();s.events.push({...e,id:'owned',creatorId:'outsider'});const before=structuredClone(s);
 const forgedOwner={...s.accounts[2],role:'admin' as const,isOwner:true};
 for(const actor of [s.accounts[2],{...s.accounts[2],simulationTester:true},{...s.accounts[2],role:'admin' as const},forgedOwner]){
  await assert.rejects(()=>apply(s,actor,'bookingCancel',{bookingId:'A',eventId:'owned'},early),/403/);assert.deepEqual(s,before);
 }
 await cancel('A',s.accounts[0]);assert.equal(s.bookings.length,1);
});

test('取消场地只看真实发起人或存储群主身份，不因管理员角色授予例外',async()=>{
 const {s,cancel}=fixture();await cancel('A',{...s.accounts[0],role:'member'});assert.equal(s.bookings.length,1);
 const other=fixture();other.s.events[0].creatorId=undefined;await other.cancel('A',other.s.accounts[0]);assert.equal(other.s.bookings.length,1);
});

test('开打、已录比分及参加记录均阻止直接取消，失败不会半途修改状态',async()=>{
 for(const kind of ['playing','complete','scored-cancelled','attendance'] as const){
  const {s,cancel,round,match}=fixture();s.rounds.push(round);const m=match('protected','A');
  if(kind==='attendance')s.attendance.push({id:'visit',eventId:'event',playerId:'p1',bookingId:'A',start:start-hour,end:start,state:'left',source:'automatic'});
  else {if(kind==='playing'){m.status='playing';m.start=start}else{m.status=kind==='complete'?'complete':'cancelled';m.start=start;m.scoreA=21;m.scoreB=10;m.games=[{a:21,b:10}]}s.matches.push(m)}
  const before=structuredClone(s);await assert.rejects(()=>cancel('A',s.accounts[1],start+hour),/开打|比分|参加记录/);assert.deepEqual(s,before);
 }
});

test('对应场地及已撤销球友的未开打对局撤下，其他场地的完赛历史不变',async()=>{
 const {s,join,cancel,round,match}=fixture();await join(1);s.rounds.push({...round,status:'playing'});
 const original=match('finished','B',['p5','p6','p7','p8']);Object.assign(original,{status:'complete',start,end:start+15*60000,scoreA:21,scoreB:10,games:[{a:21,b:10}]});
 s.matches.push(match('pending','A'),original);const history=structuredClone(original);await cancel();
 assert.equal(s.matches.find(m=>m.id==='pending')!.status,'cancelled');assert.deepEqual(s.matches.find(m=>m.id==='finished'),history);assert.equal(s.rounds[0].status,'complete');
});

test('球友正在另一场比赛时保留原接龙，允许未开打的场地在开始时间之后取消',async()=>{
 const f=fixture();await f.join(1);f.s.rounds.push(f.round);const m=f.match('other-live','B');m.status='playing';m.start=start;f.s.matches.push(m);
 const before=structuredClone(f.s);await assert.rejects(()=>f.cancel('A',f.s.accounts[1],start+hour),/仍在比赛/);assert.deepEqual(f.s,before);
 const fresh=fixture();await fresh.join(1);await fresh.cancel('A',fresh.s.accounts[1],start+hour);assert.equal(fresh.s.bookings.length,1);
});

test('取消最后场地后活动保留，历史分摊及付款保留，原场地费用预览归零',async()=>{
 const {s,e,join,cancel}=fixture();s.bookings.splice(1);await join(1);
 const settlement={...calculateSettlementPreview(s,e,early),id:'settled',version:1,created:early,confirmed:true,reason:''};s.settlements.push(settlement);
 s.payments.push({id:'payment',eventId:e.id,playerId:'p1',cents:1200,method:'cash',at:early,reason:'虚构付款',actor:'owner'});
 const history=structuredClone({settlements:s.settlements,payments:s.payments});await cancel();
 assert.equal(s.bookings.length,0);assert.equal(s.events.length,1);assert.equal(s.registrations[0].status,'cancelled');assert.equal(calculateSettlementPreview(s,e,early).total,0);assert.deepEqual({settlements:s.settlements,payments:s.payments},history);
});

test('未开打预排按剩余场地和球友重排，比赛对阵保留并解除尚未开打的场地分配',async()=>{
 const {s,join,cancel,round,match}=fixture();for(let i=1;i<=8;i++)await join(i,i<=4?'A':'B');
 s.rounds.push({...round,pointsSlot:0,eligible:s.players.slice(1,9).map(p=>p.id)});s.matches.push(match('a','A'),match('b','B',['p5','p6','p7','p8']));
 await cancel();assert.ok(s.matches.filter(m=>m.status==='published').every(m=>m.courtId==='B'&&[...m.a,...m.b].every(id=>Number(id.slice(1))>=5)));
 const competition=fixture();competition.e.tournament={fixtures:[{id:'fixture',stage:'group',round:1,slot:1,matchId:'drawn'}]} as Event['tournament'];competition.s.rounds.push(competition.round);competition.s.matches.push(competition.match('drawn','A'));
 await competition.cancel();assert.equal(competition.e.tournament!.fixtures[0].matchId,'drawn','caller snapshot is not mutated after atomic replacement');assert.equal(competition.s.events[0].tournament!.fixtures[0].matchId,undefined);
});
