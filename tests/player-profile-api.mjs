import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';

// Fictional loopback fixtures only; no hosted identity/IP headers, production writes, or resets.
const origin=process.env.PLAYER_PROFILE_TEST_ORIGIN??'http://127.0.0.1:8787';
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname),'Loopback only');
const run=randomUUID(),suffix=run.replaceAll('-','').slice(0,12),fixtureIP='203.0.113.'+(1+parseInt(run.slice(0,4),16)%254);
const adminHeaders={'oai-authenticated-user-id':'local_seedy','oai-authenticated-user-email':'local_seedy@example.invalid'};
const results=[],transportRetries=[],fixtures={};let currentTest='',memberA,memberB,friendId,avatarId,racketId,activityPhotoId;
const imageFixturePath='tests/fixtures/shuttlecock.png',png=readFileSync(imageFixturePath);
assert.ok(png.length>0&&png.length<=5*1024*1024,'Expected valid existing PNG fixture');
const base={years:4,hand:'right',preference:'mixed',style:'虚构验收 · 网前与轮转',equipment:'虚构验收 · 备用装备说明'};
const gear={racket:'虚构球拍 4U',strings:'虚构球线 0.66mm',tensionMin:25,tensionMax:27};
async function request(path,options={}){
 for(let attempt=0;attempt<2;attempt++){
  let response;try{response=await new Promise((resolve,reject)=>{
   const body=options.body??'',url=new URL(origin+path),send=url.protocol==='https:'?httpsRequest:httpRequest;
   const req=send(url,{method:options.method??'GET',agent:false,headers:{'cf-connecting-ip':fixtureIP,...options.headers,Connection:'close',...(body.length?{'Content-Length':Buffer.byteLength(body)}:{})},signal:AbortSignal.timeout(20000)},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>{const headers=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)headers.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve({status:res.statusCode,headers,bytes:Buffer.concat(chunks)})});
   });req.on('error',reject);req.end(body);
  })}catch(error){throw new Error(`${options.method??'GET'} ${path} failed: ${error.name}`)}
  const text=response.bytes.toString();let data;try{data=JSON.parse(text)}catch{data=text}
  if(attempt===0&&response.status===503&&text==='Your worker restarted mid-request. Please try sending the request again. Only GET or HEAD requests are retried automatically.'){
   transportRetries.push({path,method:options.method??'GET',reason:'Wrangler restarted mid-request'});await new Promise(resolve=>setTimeout(resolve,200));continue;
  }
  return {...response,data};
 }
}
const sessionHeaders=actor=>actor==='admin'?adminHeaders:actor?.cookie?{Cookie:actor.cookie}:{};
const get=(actor=null,path='/api/club')=>request(path,{headers:sessionHeaders(actor)});
const auth=(payload,actor=null)=>request('/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...sessionHeaders(actor)},body:JSON.stringify(payload)});
function cookiePair(r){const line=r.headers.getSetCookie().find(v=>v.startsWith('yulin_session='));assert.ok(line,'Expected session cookie');return line.split(';')[0]}
async function command(actor,action,payload){const s=await get(actor);assert.equal(s.status,200);return request('/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...sessionHeaders(actor)},body:JSON.stringify({action,payload,requestId:randomUUID(),revision:s.data.revision})})}
async function update(actor,target,values={}){return command(actor,'profileDetails',{playerId:target,...base,...values})}
async function upload(actor,kind,values={},options={}){
 const state=await get(actor);assert.equal(state.status,200);const form=new FormData();form.set('rightsConfirmed','true');
 const bytes=options.bytes??png,type=options.type??'image/png';
 form.set('file',new Blob([bytes],{type}),options.filename??'fictional-profile.png');form.set('kind',kind);form.set('caption',options.caption??'虚构本地球拍照片验收');form.set('revision',String(options.revision??state.data.revision));form.set('requestId',options.requestId??randomUUID());
 for(const [key,value]of Object.entries(values))if(value!==undefined)form.set(key,String(value));
 const wire=new Request('http://fixture.invalid',{method:'POST',body:form});
 return request('/api/photos',{method:'POST',headers:{Origin:origin,...sessionHeaders(actor),'Content-Type':wire.headers.get('content-type')},body:Buffer.from(await wire.arrayBuffer())});
}
async function test(name,fn){currentTest=name;await fn();results.push({name,status:'passed'});console.log('PASS '+name)}
function player(s,id){const p=s.players.find(p=>p.id===id);assert.ok(p,'Expected fictional player profile');return p}
async function createMember(label){const username='profile'+label+suffix,password=randomBytes(24).toString('base64url');const created=await auth({action:'createAccount',name:'虚构档案球友 '+label,username,password,requestId:randomUUID()},'admin');assert.equal(created.status,200);const logged=await auth({action:'login',username,password});assert.equal(logged.status,200);const cookie=cookiePair(logged),s=(await get({cookie})).data;assert.equal(s.me.role,'member');return {cookie,accountId:s.me.id,playerId:s.me.playerId,username}}

try{
 await test('创建两个独立普通成员；未登录无法读取档案或上传照片',async()=>{
  assert.equal((await get()).status,401);assert.equal((await get(null,'/api/photos/nonexistent')).status,401);
  assert.equal((await request('/api/photos',{method:'POST',headers:{Origin:origin}})).status,401);
  memberA=await createMember('a');memberB=await createMember('b');assert.notEqual(memberA.accountId,memberB.accountId);
  fixtures.memberA={accountId:memberA.accountId,playerId:memberA.playerId};fixtures.memberB={accountId:memberB.accountId,playerId:memberB.playerId};
 });
 await test('结构化装备资料持久保存，其他登录成员可查看完整档案',async()=>{
  assert.equal((await update(memberA,memberA.playerId,gear)).status,200);
  const a=player((await get(memberA)).data,memberA.playerId),b=player((await get(memberB)).data,memberA.playerId);
  assert.deepEqual(a.profile,{...base,...gear,tension:'25–27 磅'});assert.deepEqual(b.profile,a.profile);assert.equal(b.name,a.name);
 });
 await test('其他成员不能修改档案；管理员可以编辑但不改变档案身份',async()=>{
  const before=player((await get(memberA)).data,memberA.playerId);
  assert.equal((await update(memberB,memberA.playerId,{...gear,racket:'不应保存'})).status,403);
  assert.deepEqual(player((await get(memberA)).data,memberA.playerId),before);
  assert.equal((await update('admin',memberA.playerId,{...gear,style:'管理员编辑的虚构打法'})).status,200);
  const after=player((await get(memberA)).data,memberA.playerId);assert.equal(after.profile.style,'管理员编辑的虚构打法');assert.equal(after.id,before.id);assert.equal(after.name,before.name);assert.equal(after.ownerId,memberA.accountId);
 });
 await test('旧客户端省略装备字段时保留；显式空字符串可以清空',async()=>{
  assert.equal((await update(memberA,memberA.playerId,{style:'旧客户端更新打法'})).status,200);
  let p=player((await get(memberB)).data,memberA.playerId);for(const [key,value]of Object.entries(gear))assert.equal(p.profile[key],value);
  assert.equal((await update(memberA,memberA.playerId,{strings:''})).status,200);
  p=player((await get(memberB)).data,memberA.playerId);assert.equal(p.profile.strings,'');assert.equal(p.profile.racket,gear.racket);assert.equal(p.profile.tensionMin,25);assert.equal(p.profile.tensionMax,27);
 });
 await test('装备字段限制长度且拒绝不存在的球友',async()=>{
  for(const key of ['racket','strings'])assert.equal((await update(memberA,memberA.playerId,{[key]:'x'.repeat(121)})).status,400);
  assert.equal((await update(memberA,memberA.playerId,{tensionMin:28,tensionMax:24})).status,400);
  assert.equal((await update(memberA,memberA.playerId,{tensionMin:24,tensionMax:null})).status,400);
  assert.equal((await update(memberA,memberA.playerId,{tensionMin:24,tensionMax:81})).status,400);
  assert.ok([400,404].includes((await update(memberA,'missing-'+suffix,gear)).status));
 });
 await test('代报朋友的档案可由所属成员编辑，其他成员不能编辑',async()=>{
  const before=(await get(memberA)).data,existing=new Set(before.players.map(p=>p.id));assert.equal((await command(memberA,'friend',{name:'虚构代报球友 '+suffix})).status,200);
  const after=(await get(memberA)).data,p=after.players.find(p=>!existing.has(p.id)&&p.ownerId===memberA.accountId);assert.ok(p);friendId=p.id;fixtures.delegatedFriendId=friendId;
  assert.equal((await update(memberA,friendId,{...gear,hand:'left'})).status,200);assert.equal((await update(memberB,friendId,gear)).status,403);
  assert.equal(player((await get(memberB)).data,friendId).profile.hand,'left');
 });
 await test('头像上传兼容现有流程，其他成员可读取私有照片',async()=>{
  const r=await upload(memberA,'avatar',{playerId:memberA.playerId});assert.equal(r.status,200);avatarId=r.data.id;fixtures.avatarId=avatarId;
  assert.equal(player((await get(memberB)).data,memberA.playerId).avatarId,avatarId);
  const photo=await get(memberB,'/api/photos/'+avatarId);assert.equal(photo.status,200);assert.equal(photo.headers.get('content-type'),'image/png');assert.ok(photo.bytes.equals(png),'Avatar bytes must match the uploaded PNG fixture');
 });
 await test('本人球拍照片真实上传及字节往返，其他成员可读取，访客被拒绝',async()=>{
  const r=await upload(memberA,'racket',{playerId:memberA.playerId});assert.equal(r.status,200);racketId=r.data.id;fixtures.racketId=racketId;
  const photo=await get(memberB,'/api/photos/'+racketId);assert.equal(photo.status,200);assert.equal(photo.headers.get('content-type'),'image/png');assert.equal(photo.headers.get('x-content-type-options'),'nosniff');assert.ok(photo.bytes.equals(png),'Racket image bytes must match the uploaded PNG fixture');
  assert.equal((await get(null,'/api/photos/'+racketId)).status,401);
  const s=(await get(memberB)).data,meta=s.photos.find(p=>p.id===racketId);assert.ok(meta);assert.equal(meta.kind,'racket');assert.deepEqual(meta.playerIds,[memberA.playerId]);assert.equal(meta.eventId,null);assert.equal(meta.matchId,null);assert.equal('key' in meta,false);assert.equal(meta.type,'image/png');assert.equal(meta.size,png.length);assert.equal(player(s,memberA.playerId).avatarId,avatarId);
 });
 await test('其他成员上传球拍照片被拒绝，管理员及代报所属成员可以上传',async()=>{
  const denied=await upload(memberB,'racket',{playerId:memberA.playerId});assert.equal(denied.status,403);
  const admin=await upload('admin','racket',{playerId:memberB.playerId});assert.equal(admin.status,200);fixtures.adminRacketId=admin.data.id;
  const delegated=await upload(memberA,'racket',{playerId:friendId});assert.equal(delegated.status,200);fixtures.delegatedRacketId=delegated.data.id;
  const s=(await get(memberB)).data;assert.deepEqual(s.photos.find(p=>p.id===delegated.data.id).playerIds,[friendId]);assert.equal((await get(memberB,'/api/photos/'+admin.data.id)).status,200);
 });
 await test('无效或遗漏球友目标及非法图像格式被拒绝且不留下照片',async()=>{
  const before=(await get(memberA)).data.photos.length;
  assert.ok([400,403,404].includes((await upload(memberA,'racket',{playerId:'missing-'+suffix})).status));
  assert.ok([400,403,404].includes((await upload(memberA,'racket',{})).status));
  assert.equal((await upload(memberA,'racket',{playerId:memberA.playerId},{bytes:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),type:'image/svg+xml',filename:'fictional.svg'})).status,400);
  assert.equal((await upload(memberA,'racket',{playerId:memberA.playerId},{type:'image/jpeg'})).status,400);
  const oversized=Buffer.alloc(5*1024*1024+1);png.copy(oversized,0,0,Math.min(png.length,oversized.length));
  assert.equal((await upload(memberA,'racket',{playerId:memberA.playerId},{bytes:oversized})).status,400);
  assert.equal((await get(memberA)).data.photos.length,before);
 });
 await test('重复上传requestId只有一个照片记录，过期版本上传返回409',async()=>{
  const id=randomUUID(),before=(await get(memberA)).data.photos.length,first=await upload(memberA,'racket',{playerId:memberA.playerId},{requestId:id});assert.equal(first.status,200);
  const repeat=await upload(memberA,'racket',{playerId:memberA.playerId},{requestId:id});assert.equal(repeat.status,200);assert.equal(repeat.data.duplicate,true);
  const s=(await get(memberA)).data;assert.equal(s.photos.length,before+1);assert.equal(s.photos.filter(p=>p.id===first.data.id).length,1);
  assert.equal((await upload(memberA,'racket',{playerId:memberA.playerId},{revision:s.revision-1})).status,409);assert.equal((await get(memberA)).data.photos.length,s.photos.length);
 });
 await test('活动照片仍关联活动，球拍照片独立于活动照片且没有暴露存储键',async()=>{
  const state=(await get('admin')).data,event=state.events.find(e=>e.status!=='draft'&&e.status!=='cancelled');assert.ok(event,'Expected existing fictional activity');
  const attendees=[...new Set(state.attendance.filter(a=>a.eventId===event.id).map(a=>a.playerId))].slice(0,1);
  const r=await upload('admin','photo',{eventId:event.id,playerIds:JSON.stringify(attendees)});assert.equal(r.status,200);activityPhotoId=r.data.id;fixtures.activityPhotoId=activityPhotoId;fixtures.activityId=event.id;
  const s=(await get(memberB)).data,activity=s.photos.find(p=>p.id===activityPhotoId);assert.ok(activity);assert.equal(activity.kind,'photo');assert.equal(activity.eventId,event.id);assert.deepEqual(activity.playerIds,attendees);assert.equal((await get(memberB,'/api/photos/'+activityPhotoId)).status,200);
  assert.ok(s.photos.some(p=>p.kind==='racket'&&p.playerIds.includes(memberA.playerId)));assert.ok(s.photos.filter(p=>p.kind==='racket').every(p=>p.eventId===null&&p.matchId===null));
  assert.equal(s.photos.filter(p=>p.eventId===event.id).some(p=>p.kind==='racket'),false);assert.ok(s.photos.every(p=>!('key' in p)));
 });
}catch(error){results.push({name:currentTest||'fixture precondition',status:'failed',error:error.message});process.exitCode=1;console.error('FAIL '+(currentTest||'fixture precondition')+': '+error.message)}
finally{
 mkdirSync('.test-output',{recursive:true});const passed=results.filter(r=>r.status==='passed').length,failed=results.filter(r=>r.status==='failed').length;
 const report={at:new Date().toISOString(),origin,fictionalClientIP:fixtureIP,imageFixturePath,scope:'Two new fictional normal accounts plus delegated friend; existing local activity only; no database resets or hosted requests; no secret logging',passed,failed,transportRetries,fixtures,results};
 writeFileSync('.test-output/player-profile-api-results.json',JSON.stringify(report,null,2));
 writeFileSync('.test-output/PLAYER_PROFILE_API_RESULTS.md',`# 球友档案及球拍照片集成验收\n\n执行时间：${report.at}\n\n环境：${origin}；真实PNG来源：${imageFixturePath}。两个新建虚构普通账号及代报朋友；未重置数据库、访问线上服务或输出密码/令牌。\n\n通过 ${passed} 项，失败 ${failed} 项。\n\n${results.map(r=>`- ${r.status==='passed'?'通过':'失败'}：${r.name}${r.error?'；'+r.error:''}`).join('\n')}\n\n传输：node:http独立连接、20秒超时；真实multipart上传。匿名上传拒绝仅测试无请求体鉴权守卫。明确Worker重启503最多重试一次，本次 ${transportRetries.length} 次。\n\n虚构成员与照片ID：见player-profile-api-results.json的fixtures；无凭据。限流隔离IP：RFC5737 ${fixtureIP}，仅Loopback使用。\n`);
 console.log(JSON.stringify({passed,failed,retries:transportRetries.length,imageFixturePath}));
}
