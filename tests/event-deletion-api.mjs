import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';

// New, fictional fixtures on the local preview only. No production requests or resets.
const origin=process.env.EVENT_DELETE_TEST_ORIGIN??'http://127.0.0.1:30070';
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
const admin={cookie:'__sites_local_auth=1'},suffix=randomUUID().slice(0,8),results=[];
async function request(actor,path,body){
 const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{...(actor?{Cookie:actor.cookie}:{}),...(body?{Origin:origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=null}return {status:r.status,data,headers:r.headers};
}
const get=async actor=>{const r=await request(actor,'/api/club');assert.equal(r.status,200);return r.data};
async function command(actor,action,payload,revision){const current=revision??(await get(actor)).revision;return request(actor,'/api/club',{action,payload,revision:current,requestId:randomUUID()})}
async function test(name,fn){await fn();results.push(name);console.log('PASS '+name)}
async function member(label){
 const username='delete'+(label==='甲'?'a':'b')+suffix,password=randomBytes(24).toString('base64url');
 assert.equal((await request(admin,'/api/auth',{action:'createAccount',name:'删除功能虚构球友'+label,username,password,requestId:randomUUID()})).status,200);
 const logged=await request(null,'/api/auth',{action:'login',username,password});assert.equal(logged.status,200);
 const cookie=logged.headers.getSetCookie().find(c=>c.startsWith('yulin_session=')).split(';')[0];const a={cookie};a.me=(await get(a)).me;assert.equal(a.me.role,'member');return a;
}
const start=Math.ceil((Date.now()+3600000)/1800000)*1800000,end=start+7200000;
async function event(actor,label){const title='虚构删除验收 · '+label+' '+suffix;
 const payload={title,start,end,signupDeadline:end,cancelDeadline:end,capacity:8,venue:'Antonio Díaz Miguel',address:'',note:'仅本地功能验收',status:'open',bookings:[{name:'虚构一号场',start,end,pricing:'total',cents:1200}]};
 assert.equal((await command(actor,'event',payload)).status,200);return (await get(actor)).events.find(e=>e.title===title);
}
const initial=await get(admin);assert.equal(initial.me.id,'local_seedy','This suite requires the local mock-auth preview');
const A=await member('甲'),B=await member('乙'),e=await event(A,'可恢复活动');
let photoId;
await test('普通创建者拥有删除入口所需权限，其他成员不能删除或恢复',async()=>{
 assert.equal(e.creatorId,A.me.id);assert.equal((await command(B,'deleteEvent',{eventId:e.id,reason:'越权'})).status,403);
 assert.equal((await command(B,'restoreEvent',{eventId:e.id,reason:'越权'})).status,403);
 assert.ok((await get(A)).events.some(x=>x.id===e.id));
});
await test('删除前真实活动照片可读取',async()=>{
 const form=new FormData();form.set('rightsConfirmed','true');form.set('file',new Blob([readFileSync('tests/fixtures/shuttlecock.png')],{type:'image/png'}),'fictional.png');form.set('kind','photo');form.set('eventId',e.id);form.set('revision',String((await get(admin)).revision));form.set('requestId',randomUUID());
 const r=await fetch(origin+'/api/photos',{method:'POST',headers:{Cookie:admin.cookie,Origin:origin},body:form});assert.equal(r.status,200);photoId=(await r.json()).id;
 assert.equal((await fetch(origin+'/api/photos/'+photoId,{headers:{Cookie:B.cookie}})).status,200);
});
await test('删除持久化并隐藏活动、关联记录与照片直链，只有创建者和管理员可见恢复列表',async()=>{
 assert.equal((await command(A,'deleteEvent',{eventId:e.id,reason:'本地验收删除'})).status,200);
 for(const actor of [A,B,admin]){const v=await get(actor);assert.ok(!v.events.some(x=>x.id===e.id));assert.ok(!v.bookings.some(x=>x.eventId===e.id));assert.ok(!v.photos.some(x=>x.id===photoId));}
 assert.ok((await get(A)).deletedEvents.some(x=>x.id===e.id));assert.ok(!(await get(B)).deletedEvents.some(x=>x.id===e.id));assert.ok((await get(admin)).deletedEvents.some(x=>x.id===e.id));
 for(const actor of [A,B,admin])assert.equal((await fetch(origin+'/api/photos/'+photoId,{headers:{Cookie:actor.cookie}})).status,404);
});
await test('已删除活动拒绝报名、状态修改和上传照片',async()=>{
 assert.equal((await command(A,'register',{eventId:e.id,playerId:A.me.playerId,arrival:start,departure:end,note:''})).status,400);
 assert.equal((await command(A,'eventStatus',{eventId:e.id,status:'open'})).status,400);
 const form=new FormData();form.set('rightsConfirmed','true');form.set('file',new Blob([readFileSync('tests/fixtures/shuttlecock.png')],{type:'image/png'}),'fictional.png');form.set('kind','photo');form.set('eventId',e.id);form.set('revision',String((await get(admin)).revision));form.set('requestId',randomUUID());
 assert.equal((await fetch(origin+'/api/photos',{method:'POST',headers:{Cookie:admin.cookie,Origin:origin},body:form})).status,400);
});
await test('创建者恢复原活动、预约和照片，重复恢复不会创建新活动',async()=>{
 assert.equal((await command(A,'restoreEvent',{eventId:e.id,reason:'本地恢复验收'})).status,200);
 assert.equal((await command(A,'restoreEvent',{eventId:e.id,reason:'重复恢复'})).status,200);
 const v=await get(A);assert.equal(v.events.filter(x=>x.id===e.id).length,1);assert.ok(v.bookings.some(x=>x.eventId===e.id));assert.ok(!v.deletedEvents.some(x=>x.id===e.id));assert.equal((await fetch(origin+'/api/photos/'+photoId,{headers:{Cookie:B.cookie}})).status,200);
});
await test('删除与开赛并发只能成功一方，不能生成已删除但仍进行中的比赛',async()=>{
 const race=await event(A,'并发活动');
 for(const label of ['丙','丁'])assert.equal((await command(A,'friend',{name:'并发虚构球友'+label+suffix})).status,200);
 const v=await get(A),ids=[A.me.playerId,B.me.playerId,...v.players.filter(p=>p.name.startsWith('并发虚构球友')&&p.name.endsWith(suffix)).map(p=>p.id)];assert.equal(ids.length,4);
 for(const playerId of ids)assert.equal((await command(A,'register',{eventId:race.id,playerId,arrival:start,departure:end,note:''})).status,200);
 assert.equal((await command(A,'generate',{eventId:race.id,at:start,duration:20,seed:1})).status,200);
 const round=(await get(A)).rounds.find(r=>r.eventId===race.id);assert.equal((await command(A,'publish',{roundId:round.id})).status,200);
 const revision=(await get(A)).revision;
 const [deleted,started]=await Promise.all([command(A,'deleteEvent',{eventId:race.id,reason:'并发删除'},revision),command(A,'start',{roundId:round.id,at:start,monthly:true,elo:true},revision)]);
 assert.deepEqual([deleted.status,started.status].sort(),[200,409]);
 const after=await get(A);if(started.status===200){assert.ok(after.events.some(x=>x.id===race.id));assert.equal((await command(A,'deleteEvent',{eventId:race.id,reason:'正在比赛'})).status,400);for(const m of after.matches.filter(m=>m.eventId===race.id))assert.equal((await command(A,'void',{matchId:m.id,status:'cancelled',reason:'结束虚构并发验收'})).status,200);assert.equal((await command(A,'deleteEvent',{eventId:race.id,reason:'清理虚构活动'})).status,200)}else{assert.ok(after.deletedEvents.some(x=>x.id===race.id));assert.ok(!after.matches.some(m=>m.eventId===race.id));}
});
await test('删除与报名并发不会向已删除活动新增接龙',async()=>{
 const race=await event(A,'接龙并发'),revision=(await get(A)).revision;
 const [deleted,registered]=await Promise.all([command(A,'deleteEvent',{eventId:race.id,reason:'并发删除'},revision),command(B,'register',{eventId:race.id,playerId:B.me.playerId,arrival:start,departure:end,note:''},revision)]);
 const after=await get(A);
 if(deleted.status===200){assert.equal(registered.status,400);assert.ok(after.deletedEvents.some(x=>x.id===race.id));assert.ok(!after.registrations.some(r=>r.eventId===race.id));}
 else{assert.equal(deleted.status,409);assert.equal(registered.status,200);assert.ok(after.events.some(x=>x.id===race.id));assert.equal((await command(A,'deleteEvent',{eventId:race.id,reason:'清理虚构活动'})).status,200);}
});
await test('原有活动、历史比赛及排行榜保持不变',async()=>{
 const final=await get(admin),originalIds=new Set(initial.events.map(e=>e.id));
 assert.deepEqual(final.events.filter(e=>originalIds.has(e.id)),initial.events);assert.deepEqual(final.matches.filter(m=>initial.matches.some(x=>x.id===m.id)),initial.matches);
 for(const before of initial.quarterlyLeaderboard){const after=final.quarterlyLeaderboard.find(r=>r.playerId===before.playerId);assert.equal(after.points,before.points);assert.equal(after.games,before.games);assert.equal(after.rating,before.rating);}
});
mkdirSync('.test-output',{recursive:true});writeFileSync('.test-output/event-deletion-api-report.json',JSON.stringify({passed:results.length,results,uiFixture:{eventId:e.id,title:e.title,creatorId:A.me.id}},null,2));console.log(JSON.stringify({passed:results.length,uiFixture:{eventId:e.id,title:e.title}}));
