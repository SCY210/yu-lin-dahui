import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {apply} from '../lib/domain/commands';
import {emptyState,month,type Event} from '../lib/domain/types';
import {businessTimestamp,MAX_BUSINESS_TIMESTAMP} from '../lib/domain/timestamp';
import {madridDateTime,plannedEpoch} from '../lib/time-planning';

const start=Date.parse('2026-10-05T14:30:00Z'),hour=3600000;
function eventInput(at=start,end=at+hour){return {title:'安全测试活动',start:at,end,venue:'测试球馆',address:'',capacity:4,signupDeadline:at,cancelDeadline:at,note:'',status:'open',bookings:[{name:'1号场',start:at,end,pricing:'hourly',cents:1200}]}}
function fixture(){
 const s=emptyState(),actor={id:'test-admin',email:'',role:'admin' as const,playerId:'test-player'};
 s.accounts.push(actor);s.players.push({id:actor.playerId,ownerId:actor.id,name:'测试球友',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'测试'});
 const e:Event={...eventInput(),id:'test-event',attendanceMode:'manual',courtMode:'interval',ballMode:'interval',status:'live'};
 s.events.push(e);s.bookings.push({id:'test-court',eventId:e.id,name:'1号场',start,end:e.end,pricing:'hourly',cents:1200});
 s.attendance.push({id:'test-attendance',eventId:e.id,playerId:actor.playerId,start,end:null,state:'ready'});
 s.costs.push({id:'test-cost',eventId:e.id,type:'ball',name:'测试球',pricing:'unit',cents:100,tubeCount:12,used:1,start:null,end:null,bearer:'members'});
 s.rounds.push({id:'test-round',eventId:e.id,start,duration:20,status:'published',eligible:[],rest:[],seed:1});
 s.matches.push({id:'test-match',eventId:e.id,roundId:'test-round',courtId:'test-court',a:[actor.playerId,'b'],b:['c','d'],status:'playing',start,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]});
 return {s,actor,e};
}

test('超大整型活动在业务变更前拒绝，不能留下会让Intl崩溃的记录',async()=>{
 const {s,actor}=fixture(),before=structuredClone(s);
 assert.equal(z.number().int().min(0).safeParse(1e20).success,true);
 assert.throws(()=>month(1e20),RangeError);
 await assert.rejects(()=>apply(s,actor,'event',eventInput(1e20),start),z.ZodError);
 assert.deepEqual(s,before);
});

test('时间schema拒绝越界、非安全整数、非有限值、负数和小数',()=>{
 for(const bad of [1e20,Number.MAX_SAFE_INTEGER+1,MAX_BUSINESS_TIMESTAMP+1,Date.parse('2101-01-01T00:00:00Z'),Infinity,-Infinity,NaN,-1,start+0.5])assert.equal(businessTimestamp.safeParse(bad).success,false,String(bad));
 for(const good of [0,1,start,MAX_BUSINESS_TIMESTAMP])assert.equal(businessTimestamp.parse(good),good);
 assert.equal(madridDateTime(MAX_BUSINESS_TIMESTAMP),'2100-12-31T23:59');
});

test('活动所有起止、截止与嵌套预约时间均先拒绝超大输入',async()=>{
 for(const key of ['start','end','signupDeadline','cancelDeadline'] as const){
  const {s,actor}=fixture(),before=structuredClone(s),input=eventInput();input[key]=1e20;
  await assert.rejects(()=>apply(s,actor,'event',input,start),z.ZodError);assert.deepEqual(s,before,key);
 }
 for(const key of ['start','end'] as const){
  const {s,actor}=fixture(),before=structuredClone(s),input=eventInput();input.bookings[0][key]=1e20;
  await assert.rejects(()=>apply(s,actor,'event',input,start),z.ZodError);assert.deepEqual(s,before,'bookings.'+key);
 }
});

const cases:{action:string;input:Record<string,unknown>;fields:string[]}[]=[
 {action:'eventEdit',input:{eventId:'test-event',title:'调整活动',venue:'测试球馆',address:'',capacity:4,signupDeadline:start,cancelDeadline:start,note:'',reason:'测试'},fields:['signupDeadline','cancelDeadline']},
 {action:'booking',input:{eventId:'test-event',name:'2号场',start,end:start+hour,pricing:'hourly',cents:1200,reason:'测试'},fields:['start','end']},
 {action:'bookingEdit',input:{bookingId:'test-court',name:'1号场',start,end:start+hour,pricing:'hourly',cents:1200,reason:'测试'},fields:['start','end']},
 {action:'register',input:{eventId:'test-event',playerId:'test-player',arrival:start,departure:start+hour,note:''},fields:['arrival','departure']},
 {action:'attendance',input:{eventId:'test-event',playerId:'test-player',at:start,state:'ready'},fields:['at']},
 {action:'attendanceEdit',input:{attendanceId:'test-attendance',start,end:start+hour,reason:'测试'},fields:['start','end']},
 {action:'generate',input:{eventId:'test-event',at:start,duration:20,seed:1},fields:['at']},
 {action:'start',input:{roundId:'test-round',at:start,monthly:true,elo:true},fields:['at']},
 {action:'score',input:{matchId:'test-match',a:21,b:10,end:start+60000,reason:'测试'},fields:['end']},
 {action:'cost',input:{eventId:'test-event',type:'ball',name:'测试球',pricing:'unit',cents:100,tubeCount:12,used:1,start:null,end:null,bearer:'members',reason:'测试'},fields:['start','end']},
];
for(const {action,input,fields} of cases)test(action+'的全部客户端时间均拒绝超大整数并保持原状态',async()=>{
 for(const key of fields){const {s,actor}=fixture(),before=structuredClone(s);await assert.rejects(()=>apply(s,actor,action,{...input,[key]:1e20},start),z.ZodError);assert.deepEqual(s,before,key)}
});

test('费用分段内的时间同样验证，不会持久化无效区间',async()=>{
 for(const key of ['start','end']){const {s,actor}=fixture(),before=structuredClone(s),segment={start,end:start+hour,cents:100,[key]:1e20};await assert.rejects(()=>apply(s,actor,'costOverride',{costId:'test-cost',segments:[segment],reason:'测试'},start),z.ZodError);assert.deepEqual(s,before,key)}
});

test('1970起历史、当前半点及旧秒毫秒均可保存且不被取整',async()=>{
 for(const at of [0,Date.parse('1999-06-01T13:17:19.381Z'),start,Date.parse('2026-10-25T01:30:12.345Z'),MAX_BUSINESS_TIMESTAMP-hour]){
  const {s,actor}=fixture();await apply(s,actor,'event',eventInput(at),start);
  const e=s.events.at(-1)!;assert.equal(e.start,at);assert.equal(e.end,at+hour);assert.equal(s.bookings.at(-1)!.start,at);assert.equal(plannedEpoch(madridDateTime(at),at),at);assert.doesNotThrow(()=>month(e.start));
 }
});
