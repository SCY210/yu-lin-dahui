import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {execFileSync} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';

// Run only against a fresh isolated local Worker with migrations 0000–0007.
// SECURITY_TEST_ORIGIN=http://127.0.0.1:8788
// SECURITY_TEST_PERSIST=.test-output/security-state
const url=new URL(process.env.SECURITY_TEST_ORIGIN??'http://127.0.0.1:8788');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Loopback only');
assert.ok(!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/');
const origin=url.origin,persist=process.env.SECURITY_TEST_PERSIST??'.test-output/security-state';
assert.ok(resolve(persist).startsWith(resolve('.test-output')+sep),'Fresh test DB must be in .test-output');
const suffix=randomUUID().replaceAll('-','').slice(0,9),ip='203.0.113.18',secrets=[],results=[],transportRetries=[];
const owner={id:'security-owner-'+suffix,username:'securityowner'+suffix,password:secret()},members=['a','b','c','d'].map(letter=>({username:'security'+letter+suffix,password:secret()})),[A,B,C,D]=members;
const trusted={'oai-authenticated-user-id':owner.id,'oai-authenticated-user-email':owner.id+'@example.invalid'};
let current='empty isolated precondition',history,identity;
function secret(){const value=randomBytes(24).toString('base64url');secrets.push(value);return value}
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const hash=value=>createHash('sha256').update(value).digest('hex');
function sql(command){try{return JSON.parse(execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to',persist,'--config','dist/server/wrangler.json','--command',command,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0].results}catch{throw new Error('Isolated security fixture SQL failed')}}
function bucket(key,count,expires=Date.now()+3600000){sql(`INSERT INTO auth_rate_limits(id,count,expires) VALUES(${quote(hash(key))},${count},${expires}) ON CONFLICT(id) DO UPDATE SET count=excluded.count,expires=excluded.expires`)}
const counter=key=>sql(`SELECT count,expires FROM auth_rate_limits WHERE id=${quote(hash(key))}`)[0]??null;
const reset=key=>sql(`DELETE FROM auth_rate_limits WHERE id=${quote(hash(key))}`);
function day(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
async function request(path,{method='GET',headers={},body=''}={}){for(let attempt=0;attempt<2;attempt++){let response;try{response=await new Promise((resolveRequest,reject)=>{const u=new URL(path,origin),send=u.protocol==='https:'?httpsRequest:httpRequest;const req=send(u,{method,agent:false,headers:{'cf-connecting-ip':ip,...headers,Connection:'close',...(body.length?{'Content-Length':Buffer.byteLength(body)}:{})},signal:AbortSignal.timeout(20000)},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>{const h=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)h.append(res.rawHeaders[i],res.rawHeaders[i+1]);const text=Buffer.concat(chunks).toString();let data;try{data=JSON.parse(text)}catch{data=text}resolveRequest({status:res.statusCode,headers:h,data})})});req.on('error',reject);req.end(body)})}catch{throw new Error(`${method} ${path} transport failed`)}if(attempt===0&&response.status===503&&response.data==='Your worker restarted mid-request. Please try sending the request again. Only GET or HEAD requests are retried automatically.'){transportRetries.push({path,method});await new Promise(resolveWait=>setTimeout(resolveWait,200));continue}return response}}
const get=(account,path='/api/club',headers={})=>request(path,{headers:{...headers,...(account?.cookie?{Cookie:account.cookie}:{})}});
const auth=(payload,account,headers={})=>request('/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(account?.cookie?{Cookie:account.cookie}:{}),...headers},body:JSON.stringify(payload)});
async function login(account,headers={}){const response=await auth({action:'login',username:account.username,password:account.password},null,headers);assert.equal(response.status,200);account.cookie=response.headers.getSetCookie().find(v=>v.startsWith('yulin_session=')).split(';')[0];const state=(await get(account)).data;account.playerId=state.me.playerId;return account.cookie}
async function command(account,action,payload,requestId=randomUUID(),headers={}){const state=(await get(account,'/api/club',account?{}:trusted)).data;return request('/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(account?{Cookie:account.cookie}:trusted),...headers},body:JSON.stringify({action,payload,requestId,revision:state.revision})})}
const friend=(account,id=randomUUID(),headers={})=>request('/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:account.cookie,...headers},body:JSON.stringify({action:'friend',payload:{name:'安全验收虚构朋友'},requestId:id})});
async function test(name,fn){current=name;await fn();results.push({name,status:'passed'});console.log('PASS '+name)}
function limited(response){assert.equal(response.status,429);const wait=Number(response.headers.get('retry-after'));assert.ok(Number.isInteger(wait)&&wait>0);assert.equal(response.data.retryAfter,wait);assert.ok(response.headers.get('cache-control')?.includes('no-store'))}
function crc(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function chunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b}
function png(width=2,height=2){const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.from([0,90,40,140,255,90,40,140,255,0,90,40,140,255,90,40,140,255]))),chunk('IEND',Buffer.alloc(0))])}
const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDgaKKK+lO8/9k=','base64');
const progressive=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wgARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAVAQEBAAAAAAAAAAAAAAAAAAADBf/aAAwDAQACEAMQAAABgCk//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAP/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=','base64');
const webp=Buffer.from('UklGRjYAAABXRUJQVlA4ICoAAACwAQCdASoCAAIAAUAmJaACdLoABGaAAP72E1/+Wf+f3xd6nPbsXboIAAA=','base64'),lossless=Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvAUAAAAdQlGqVsf+BiOh/AAA=','base64'),alpha=Buffer.from('UklGRlYAAABXRUJQVlA4WAoAAAAQAAAAAQAAAQAAQUxQSAUAAAAAeHh4eABWUDggKgAAALABAJ0BKgIAAgABQCYloAJ0ugAEZoAA/vYTX/5Z/5/fF3qc9uxduggAAA==','base64'),animated=Buffer.from('UklGRrYAAABXRUJQVlA4WAoAAAACAAAAAQAAAQAAQU5JTQYAAAAAAAAAAABBTk1GQgAAAAAAAAAAAAEAAAEAAGQAAAJWUDggKgAAADABAJ0BKgIAAgABQCYloAADcAD+9hNf//maP+83/eb2r//F3YjjLoAAAEFOTUZAAAAAAAAAAAAAAQAAAQAAZAAAAFZQOCAoAAAANAEAnQEqAgACAAAAJiWQAANwAP7rjl//7F9bf2Ri3//Dn2x+9inAAA==','base64');
async function upload(account,bytes=png(),type='image/png',values={}){const state=(await get(account)).data,f=new FormData();f.set('rightsConfirmed','true');f.set('file',new Blob([bytes],{type}),'fixture');for(const [key,value]of Object.entries({kind:'avatar',playerId:account.playerId,caption:'隔离图片验收',requestId:randomUUID(),revision:state.revision,...values}))f.set(key,String(value));const encoded=new Request(origin+'/api/photos',{method:'POST',body:f});return request('/api/photos',{method:'POST',headers:{Origin:origin,'Content-Type':encoded.headers.get('content-type'),Cookie:account.cookie},body:Buffer.from(await encoded.arrayBuffer())})}
function uploadBudget(account){return 'upload-bytes:'+account.id+':'+day()}
function resetUpload(account){reset('upload-actor:'+account.id)}

try{
 assert.equal(sql('SELECT count(*) AS n FROM accounts')[0].n,0,'Fresh isolated DB required');assert.equal(sql('SELECT count(*) AS n FROM password_credentials')[0].n,0,'Never use existing credentials');assert.equal((await get(null,'/api/club',trusted)).data.setup,true);
 assert.equal((await command(null,'initialize',{name:'防御机制隔离验收',invite:secret()})).status,200);
 assert.equal((await auth({action:'bind',username:owner.username,password:owner.password},null,trusted)).status,200);await login(owner);
 for(const account of members){const r=await auth({action:'createAccount',name:'安全验收虚构成员'+account.username[8],username:account.username,password:account.password,requestId:randomUUID()},owner);assert.equal(r.status,200);account.id=r.data.accountId;await login(account)}
 owner.playerId=(await get(owner)).data.me.playerId;
 assert.equal((await command(owner,'role',{accountId:B.id,role:'admin',reason:'虚构权限边界验收'})).status,200);
 const start=Date.now()-60000,end=start+2*3600000;assert.equal((await command(owner,'event',{title:'虚构历史保持',start,end,venue:'虚构球馆',address:'',capacity:8,signupDeadline:end,cancelDeadline:end,note:'隔离fixture',status:'open',bookings:[{name:'一号场',start,end,pricing:'total',cents:0}]})).status,200);
 let state=(await get(owner)).data;const event=state.events.at(-1);for(const account of members)assert.equal((await command(owner,'register',{eventId:event.id,playerId:account.playerId,arrival:start,departure:end,note:''})).status,200);
 assert.equal((await command(owner,'generate',{eventId:event.id,at:Date.now()+2000,duration:5,seed:1})).status,200);state=(await get(owner)).data;const round=state.rounds.at(-1);assert.equal((await command(owner,'publish',{roundId:round.id})).status,200);assert.equal((await command(owner,'start',{roundId:round.id,at:round.start,monthly:true,elo:true})).status,200);state=(await get(owner)).data;const match=state.matches.at(-1);assert.equal((await command(owner,'score',{matchId:match.id,a:21,b:19,end:round.start+300000,reason:'虚构验收结果'})).status,200);
 state=(await get(owner)).data;history=JSON.stringify(state.matches);identity=state.players.filter(p=>[owner,A,B,C,D].some(a=>a.playerId===p.id)).map(({avatarId,...p})=>p);

 await test('所有写入先拒绝跨站、缺少Origin、cross-site元数据及错误内容类型',async()=>{
  for(const path of ['/api/auth','/api/club','/api/photos']){const body=JSON.stringify({action:'logout'});assert.equal((await request(path,{method:'POST',headers:{Origin:'https://example.invalid','Content-Type':'application/json',Cookie:A.cookie},body})).status,403);assert.equal((await request(path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:A.cookie},body})).status,403);assert.equal((await request(path,{method:'POST',headers:{Origin:origin,'Sec-Fetch-Site':'cross-site','Content-Type':'application/json',Cookie:A.cookie},body})).status,403);assert.equal((await request(path,{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain',Cookie:A.cookie},body})).status,415)}
 });
 await test('认证8KiB、业务64KiB、上传6MiB请求体实际返回413',async()=>{
  for(const [path,size,type]of [['/api/auth',9000,'application/json'],['/api/club',70000,'application/json'],['/api/photos',6*1024*1024+1,'multipart/form-data; boundary=fixture']])assert.equal((await request(path,{method:'POST',headers:{Origin:origin,'Content-Type':type,Cookie:A.cookie},body:Buffer.alloc(size,120)})).status,413);
 });
 await test('未知操作和SQL式登录输入失败，不返回底层错误或签发会话',async()=>{
  const bad=await auth({action:'login',username:"' OR 1=1--",password:secret()});assert.equal(bad.status,401);assert.equal(bad.headers.getSetCookie().length,0);assert.equal((await command(owner,'constructor',{})).status,400);assert.ok(!JSON.stringify(bad.data).includes('SELECT'));
 });
 await test('同IP八次错误被限流，另一IP正确密码登录正常且不清攻击IP桶',async()=>{
  const attack='203.0.113.41',victim='203.0.113.42',key='login-pair:'+JSON.stringify([C.username,attack]);for(let i=0;i<8;i++)assert.equal((await auth({action:'login',username:C.username,password:secret()},null,{'cf-connecting-ip':attack})).status,401);const before=counter(key);limited(await auth({action:'login',username:C.username,password:C.password},null,{'cf-connecting-ip':attack,'x-forwarded-for':victim}));await login(C,{'cf-connecting-ip':victim});assert.equal(counter(key).count,8);assert.equal(counter(key).expires,before.expires);assert.equal(counter('login-pair:'+JSON.stringify([C.username,victim])),null);
 });
 await test('auth-IP额度耗尽仍能安全退出，旧会话立即失效',async()=>{
  const blocked='203.0.113.43';bucket('auth-ip:'+blocked,120,Date.now()+900000);limited(await auth({action:'login',username:D.username,password:D.password},null,{'cf-connecting-ip':blocked}));const cookie=D.cookie;assert.equal((await auth({action:'logout'},D,{'cf-connecting-ip':blocked})).status,200);assert.equal((await get({cookie})).status,401);await login(D,{'cf-connecting-ip':'203.0.113.44'});
 });
 await test('业务actor并发额度原子执行，只放行剩余两次',async()=>{
  reset('creation-daily:friend:'+A.id+':'+day());bucket('club-actor:'+A.id,118,Date.now()+300000);const responses=await Promise.all(Array.from({length:5},()=>friend(A)));assert.deepEqual(responses.map(r=>r.status).sort(),[200,200,429,429,429]);for(const r of responses.filter(r=>r.status===429))limited(r);assert.equal(counter('club-actor:'+A.id).count,120);reset('club-actor:'+A.id);
 });
 await test('业务总IP额度满时拒绝，别的网络仍可操作',async()=>{
  const blocked='203.0.113.45';bucket('club-ip:'+blocked,600,Date.now()+300000);limited(await friend(A,randomUUID(),{'cf-connecting-ip':blocked}));assert.equal((await friend(A,randomUUID(),{'cf-connecting-ip':'203.0.113.46'})).status,200);
 });
 await test('朋友每日普通20/admin100，重复commit不重复扣每日额度',async()=>{
  const key='creation-daily:friend:'+A.id+':'+day(),id=randomUUID();bucket(key,19);assert.equal((await friend(A,id)).status,200);assert.equal(counter(key).count,20);assert.equal((await friend(A,id)).data.duplicate,true);assert.equal(counter(key).count,20);limited(await friend(A));const adminKey='creation-daily:friend:'+owner.id+':'+day();bucket(adminKey,99);assert.equal((await friend(owner)).status,200);assert.equal(counter(adminKey).count,100);limited(await friend(owner));
 });
 await test('活动每日普通10/admin100，超额拒绝不产生新活动',async()=>{
  const payload={title:'虚构日额度活动',start,end,venue:'虚构',address:'',capacity:8,signupDeadline:end,cancelDeadline:end,note:'',status:'open',bookings:[{name:'一号场',start,end,pricing:'total',cents:0}]};const ordinary='creation-daily:event:'+A.id+':'+day();bucket(ordinary,9);assert.equal((await command(A,'event',payload)).status,200);limited(await command(A,'event',payload));const admin='creation-daily:event:'+owner.id+':'+day();bucket(admin,100);limited(await command(owner,'event',payload));
 });
 await test('短伪PNG/JPEG/WebP、SVG和超过边长/像素限制图片拒绝且不扣bytes',async()=>{
  resetUpload(A);const before=counter(uploadBudget(A))?.count??0;for(const [bytes,type]of [[Buffer.from([137,80,78,71]),'image/png'],[Buffer.from([255,216,255]),'image/jpeg'],[Buffer.from('RIFFxxxxWEBP'),'image/webp'],[Buffer.from('<svg onload="alert(1)"/>'),'image/svg+xml'],[png(12001,1),'image/png'],[png(10000,6000),'image/png'],[png().subarray(0,40),'image/png']])assert.equal((await upload(A,bytes,type)).status,400);assert.equal(counter(uploadBudget(A))?.count??0,before);
 });
 await test('普通成员及其他管理员不能改别人的/群主头像，越权不扣bytes',async()=>{
  resetUpload(A);resetUpload(B);const first=counter(uploadBudget(A))?.count??0,second=counter(uploadBudget(B))?.count??0;assert.equal((await upload(A,png(),'image/png',{playerId:C.playerId})).status,403);assert.equal((await upload(B,png(),'image/png',{playerId:owner.playerId})).status,403);assert.equal(counter(uploadBudget(A))?.count??0,first);assert.equal(counter(uploadBudget(B))?.count??0,second);
 });
 await test('真实PNG、baseline/progressive/motion JPEG及各类WebP通过',async()=>{
  resetUpload(A);for(const [bytes,type]of [[png(),'image/png'],[jpeg,'image/jpeg'],[progressive,'image/jpeg'],[Buffer.concat([jpeg,Buffer.from('phone-motion-trailer')]),'image/jpeg'],[webp,'image/webp'],[lossless,'image/webp'],[alpha,'image/webp'],[animated,'image/webp']])assert.equal((await upload(A,bytes,type)).status,200);
 });
 await test('上传次数限制带Retry-After，新的窗口可正常恢复',async()=>{
  const expires=Date.now()+5000;bucket('upload-actor:'+A.id,10,expires);limited(await upload(A));assert.equal((await get(A)).status,200,'Early upload rejection must not block subsequent reads');await new Promise(resolveWait=>setTimeout(resolveWait,Math.max(0,expires-Date.now()+100)));assert.equal((await upload(A)).status,200);assert.equal(counter('upload-actor:'+A.id).count,1);const blocked='203.0.113.47';bucket('upload-ip:'+blocked,100,Date.now()+600000);const response=await request('/api/photos',{method:'POST',headers:{Origin:origin,'Content-Type':'multipart/form-data; boundary=fixture','cf-connecting-ip':blocked,Cookie:A.cookie},body:'fixture'});limited(response);
 });
 await test('每日bytes并发只收费一次可用文件，额度失败回滚marker',async()=>{
  resetUpload(A);const image=png(),key=uploadBudget(A),max=50*1024*1024;bucket(key,max-image.length);const ids=[randomUUID(),randomUUID()],responses=await Promise.all(ids.map(requestId=>upload(A,image,'image/png',{requestId})));assert.equal(responses.filter(r=>r.status===200).length,1);assert.ok(responses.every(r=>[200,409,429].includes(r.status)),'Concurrent upload may reject a stale revision before quota reservation');assert.equal(counter(key).count,max);const rejected=responses[0].status!==200?ids[0]:ids[1];assert.equal(counter('upload-request:'+A.id+':'+rejected),null);const over= randomUUID(),full=await upload(A,image,'image/png',{requestId:over});limited(full);assert.equal(counter('upload-request:'+A.id+':'+over),null);assert.equal(counter(key).count,max);
 });
 await test('上传committed重复和同时重复requestId都不重复扣bytes',async()=>{
  resetUpload(A);const key=uploadBudget(A),image=png();reset(key);const first=randomUUID();assert.equal((await upload(A,image,'image/png',{requestId:first})).status,200);assert.equal((await upload(A,image,'image/png',{requestId:first})).data.duplicate,true);assert.equal(counter(key).count,image.length);const race=randomUUID(),responses=await Promise.all([upload(A,image,'image/png',{requestId:race}),upload(A,image,'image/png',{requestId:race})]);assert.ok(responses.some(r=>r.status===200));assert.ok(responses.every(r=>[200,409].includes(r.status)));assert.equal(counter(key).count,image.length*2);
 });
 await test('管理员每日250MiB边界按真实角色判断',async()=>{
  resetUpload(B);const image=png(),max=250*1024*1024,key=uploadBudget(B);bucket(key,max-image.length);assert.equal((await upload(B,image)).status,200);limited(await upload(B,image));assert.equal(counter(key).count,max);
 });
 await test('清理使用expires索引，私有数据及历史身份保持',async()=>{
  const plan=sql('EXPLAIN QUERY PLAN SELECT id FROM auth_rate_limits WHERE expires<=0 ORDER BY expires LIMIT 100');assert.ok(plan.some(r=>r.detail.includes('auth_rate_limits_expires')));const after=(await get(owner)).data;assert.ok(JSON.stringify(after.matches)===history);const players=after.players.filter(p=>identity.some(old=>old.id===p.id)).map(({avatarId,...p})=>p);assert.ok(JSON.stringify(players)===JSON.stringify(identity));assert.equal((await get(null)).status,401);assert.equal((await get(null,'/api/photos/nonexistent')).status,401);for(const value of secrets)assert.ok(!JSON.stringify(after.audits).includes(value));
 });
 await test('受限图片小体/100KiB/近5MiB/未知长度返回429后立即cookie读正常',async()=>{
  const state=(await get(A)).data;
  bucket('upload-actor:'+A.id,10,Date.now()+600000);
  function form(bytes){const f=new FormData();f.set('rightsConfirmed','true');f.set('file',new Blob([Buffer.alloc(bytes,42)],{type:'image/png'}),'rejected-fixture.png');for(const [key,value]of Object.entries({kind:'avatar',playerId:A.playerId,revision:state.revision,requestId:randomUUID(),caption:'拒绝请求收尾回归'}))f.set(key,String(value));return f}
  for(const [label,length,unknown]of [['small',70,false],['100KiB',100*1024,false],['near5MiB',5*1024*1024-2048,false],['unknown-length',100*1024,true]]){
   const f=form(length),headers={Origin:origin,Cookie:A.cookie,'cf-connecting-ip':'203.0.113.68'};
   let body=f;
   if(unknown){const encoded=new Request(origin+'/api/photos',{method:'POST',body:f}),bytes=new Uint8Array(await encoded.arrayBuffer());headers['Content-Type']=encoded.headers.get('content-type');body=new ReadableStream({start(controller){controller.enqueue(bytes);controller.close()}})}
   const response=await fetch(origin+'/api/photos',{method:'POST',headers,body,...(unknown?{duplex:'half'}:{}),signal:AbortSignal.timeout(7000)});
   limited({status:response.status,headers:response.headers,data:await response.json()});
   const read=await fetch(origin+'/api/club',{headers:{Cookie:A.cookie,'cf-connecting-ip':'203.0.113.68'},signal:AbortSignal.timeout(7000)});assert.equal(read.status,200,label+' rejection must preserve subsequent authenticated reads');await read.arrayBuffer();
  }
 });
}catch(error){const text=String(error?.message??'Unknown failure'),safe=secrets.some(value=>text.includes(value))?'Sensitive assertion detail suppressed':text;results.push({name:current,status:'failed',error:safe});process.exitCode=1;console.error('FAIL '+current+': '+safe)}
finally{const report={at:new Date().toISOString(),origin,persist,scope:'Fresh isolated local Worker/D1/R2; fictional owner/four members and offline generated image fixtures only; no production requests or real credentials',passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,transportRetries,results};mkdirSync('.test-output',{recursive:true});writeFileSync('.test-output/security-api-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));}
