import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const origin=process.env.OPTIMIZATION_TEST_ORIGIN??'http://127.0.0.1:30070';
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Local preview only');
const headers={Cookie:'__sites_local_auth=1',Origin:origin,'Content-Type':'application/json'};
async function get(path='/api/club'){const r=await fetch(origin+path,{headers});return {status:r.status,data:await r.json().catch(()=>null)}}
async function command(action,payload){const v=await get();return fetch(origin+'/api/club',{method:'POST',headers,body:JSON.stringify({action,payload,revision:v.data.revision,requestId:randomUUID()})})}
const before=await get();assert.equal(before.status,200);assert.equal(before.data.me.id,'local_seedy');let count=0;
const pass=name=>{count++;console.log('PASS '+name)};
for(const month of ['2026-00','2026-13','2026-99'])assert.equal((await get('/api/club?month='+month)).status,400);pass('非法月份被拒绝，保留清晰输入提示');
for(const action of ['constructor','toString','__proto__']){const r=await command(action,{});assert.equal(r.status,400);assert.equal((await r.json()).error,'未知操作')};pass('原型属性不是合法业务命令');
const large=await fetch(origin+'/api/club',{method:'POST',headers,body:JSON.stringify({note:'x'.repeat(70*1024)})});assert.equal(large.status,413);pass('超限JSON请求在业务解析前被拒绝');
const upload=await fetch(origin+'/api/photos',{method:'POST',headers:{...headers,'Content-Type':'multipart/form-data; boundary=fixture'},body:new Uint8Array(7*1024*1024)});assert.equal(upload.status,413);pass('超限总上传在multipart解析前被拒绝');
const probe=await fetch(origin+'/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'login',username:"' OR 1=1 --",password:'wrong-password'})});assert.equal(probe.status,401);assert.ok(!probe.headers.getSetCookie().some(c=>c.startsWith('yulin_session=')));pass('SQL注入式账号无法绕过密码认证或获得会话');
const idProbe=await fetch(origin+'/api/photos/'+encodeURIComponent("' OR 1=1; DROP TABLE photos; --"),{headers});assert.equal(idProbe.status,404);pass('照片ID注入字符串不扩大读取范围');
const start=Math.ceil((Date.now()+3600000)/1800000)*1800000,end=start+3600000,title="虚构SQL参数验收 '); DROP TABLE events; -- "+randomUUID().slice(0,6);
const created=await command('event',{title,start,end,venue:'Antonio Díaz Miguel',address:'',capacity:4,signupDeadline:end,cancelDeadline:end,note:'仅本地测试',status:'draft',bookings:[{name:'虚构场地',start,end,pricing:'total',cents:1200}]});assert.equal(created.status,200);
const after=await get(),e=after.data.events.find(e=>e.title===title);assert.ok(e);for(const old of before.data.events)assert.ok(after.data.events.some(e=>e.id===old.id));assert.deepEqual(after.data.matches,before.data.matches);assert.equal((await command('deleteEvent',{eventId:e.id,reason:'归档本地SQL验收活动'})).status,200);pass('SQL式活动标题按普通文字持久化，原活动及比赛均未受影响');
console.log(JSON.stringify({passed:count,scope:'loopback fictional fixtures only'}));
