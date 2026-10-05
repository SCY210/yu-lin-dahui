import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';

// Fictional local fixtures only. Trusted identity/IP headers and SQL must never be sent hosted.
const origin=process.env.MANAGED_AUTH_TEST_ORIGIN??'http://127.0.0.1:8787';
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname),'Loopback only');
const run=randomUUID(),suffix=run.replaceAll('-','').slice(0,12),fixtureIP='203.0.113.'+(1+parseInt(run.slice(0,4),16)%254);
const testFilter=process.env.MANAGED_AUTH_TEST_FILTER??'';
const adminId='local_seedy',adminHeaders={'oai-authenticated-user-id':adminId,'oai-authenticated-user-email':adminId+'@example.invalid'};
const invite='fictional-test-invite-2026',username='jade'+suffix,password=randomBytes(24).toString('base64url'),replacement=randomBytes(24).toString('base64url');
const results=[],transportRetries=[];let currentTest='',cookie='',accountId='',playerId='',adminBefore,loginResetRace;
const legacyHeaders=id=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@example.invalid'});
function cookiePair(res,name='yulin_session'){const line=res.headers.getSetCookie().find(v=>v.startsWith(name+'='));assert.ok(line,`Expected ${name} cookie`);return line.split(';')[0]}
async function request(path,options={}){
 for(let attempt=0;attempt<2;attempt++){
  let response;try{response=await new Promise((resolve,reject)=>{
   const body=options.body??'',url=new URL(origin+path),send=url.protocol==='https:'?httpsRequest:httpRequest;
   const req=send(url,{method:options.method??'GET',agent:false,headers:{'cf-connecting-ip':fixtureIP,...options.headers,Connection:'close',...(body?{'Content-Length':Buffer.byteLength(body)}:{})},signal:AbortSignal.timeout(15000)},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>{const headers=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)headers.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve({status:res.statusCode,headers,body:Buffer.concat(chunks).toString()})});
   });req.on('error',reject);req.end(body);
  })}catch(error){throw new Error(`${options.method??'GET'} ${path} failed: ${error.name}`)}
  const {body}=response,res={status:response.status,headers:response.headers};let data;try{data=JSON.parse(body)}catch{data=body}
  if(attempt===0&&res.status===503&&body==='Your worker restarted mid-request. Please try sending the request again. Only GET or HEAD requests are retried automatically.'){
   transportRetries.push({path,method:options.method??'GET',reason:'Wrangler restarted mid-request'});await new Promise(resolve=>setTimeout(resolve,200));continue;
  }
  return {res,status:res.status,data};
 }
}
const get=(path='/api/club',session='',headers={})=>request(path,{headers:{...headers,...(session?{Cookie:session}:{})}});
const auth=(body,session='',headers={})=>request('/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(session?{Cookie:session}:{}),...headers},body:JSON.stringify(body)});
const adminAuth=body=>auth(body,'',adminHeaders);
const create=(key=username,values={})=>({action:'createAccount',name:'账号制虚构球友',username:key,password,requestId:randomUUID(),...values});
async function clubCommand(action,payload,headers=adminHeaders){const s=(await get('/api/club','',headers)).data;return request('/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify({action,payload,requestId:randomUUID(),revision:s.revision})})}
async function test(name,fn){if(testFilter&&!name.includes(testFilter))return;currentTest=name;await fn();results.push({name,status:'passed'});console.log('PASS '+name)}
function localSQL(sql){return JSON.parse(execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to','.wrangler/state','--config','dist/server/wrangler.json','--command',sql,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))}
const tokenHash=session=>createHash('sha256').update(session.slice('yulin_session='.length)).digest('hex');
const profileValue=p=>{const {ownerId,...profile}=p;return profile};
// This fixture helper can handle a stale credential snapshot without exposing its values on CLI errors.
function raceSQL(sql){try{return localSQL(sql)}catch{throw new Error('Local login/reset race SQL fixture operation failed')}}

try{
 await test('未登录不能访问群组或照片，也不能开户或自助注册',async()=>{
  assert.equal((await get()).status,401);assert.equal((await get('/api/photos/nonexistent')).status,401);
  assert.equal((await get('/api/auth')).data.signedIn,false);
  assert.equal((await auth(create())).status,401);
  assert.equal((await auth({action:'register',name:'禁止自助注册',username,password,invite,requestId:randomUUID()})).status,400);
 });
 adminBefore=(await get('/api/club','',adminHeaders)).data;assert.equal(adminBefore.me.id,adminId);assert.equal(adminBefore.me.role,'admin');assert.ok(Array.isArray(adminBefore.loginAccounts));
 await test('管理员创建账号验证用户名和强密码，无需邮箱',async()=>{
  for(const invalid of ['x','has space','has/slash','email@example.invalid','x'.repeat(33)])assert.equal((await adminAuth(create(invalid))).status,400);
  assert.equal((await adminAuth(create(username,{password:'short'}))).status,400);
  const r=await adminAuth(create('JADE'+suffix,{role:'admin'}));assert.equal(r.status,200);assert.equal(r.res.headers.getSetCookie().length,0,'Creating a member must not switch the admin session');
  const s=(await get('/api/club','',adminHeaders)).data,entry=s.loginAccounts.find(a=>a.username===username);assert.ok(entry);accountId=entry.accountId;
  const a=s.accounts.find(a=>a.id===accountId);assert.equal(a.role,'member');assert.equal(a.email,'');playerId=a.playerId;
  assert.equal(s.players.filter(p=>p.id===playerId).length,1);assert.equal(s.me.id,adminId);assert.equal(s.me.role,'admin');
 });
 await test('用户名NFKC与大小写归一，登录显示用户名且Cookie受保护',async()=>{
  assert.equal((await auth({action:'login',username,password:randomBytes(24).toString('base64url')})).status,401);
  const r=await auth({action:'login',username:' ＪＡＤＥ'+suffix.toUpperCase()+' ',password});assert.equal(r.status,200);cookie=cookiePair(r.res);
  const line=r.res.headers.getSetCookie().find(v=>v.startsWith('yulin_session='));assert.ok(line.includes('HttpOnly'));assert.ok(line.includes('SameSite=Lax'));assert.ok(line.includes('Max-Age=1209600'));
  const info=await get('/api/auth',cookie);assert.equal(info.data.username,username);assert.equal(info.data.method,'password');assert.equal(info.data.passwordEnabled,true);assert.equal('email' in info.data,false);assert.equal(info.res.headers.get('cache-control'),'no-store');
  const s=(await get('/api/club',cookie)).data;assert.equal(s.me.id,accountId);assert.equal(s.me.role,'member');assert.equal(s.me.playerId,playerId);assert.deepEqual(s.loginAccounts,[]);
 });
 await test('成员不能开户、重置密码、设置管理员角色或导出群组',async()=>{
  assert.equal((await auth(create('forbidden'+suffix),cookie)).status,403);
  assert.equal((await auth({action:'resetPassword',accountId,password:replacement,requestId:randomUUID()},cookie)).status,403);
  assert.equal((await auth({action:'resetPassword',accountId,password:replacement,requestId:randomUUID()})).status,401);
  assert.equal((await auth({action:'bind',username:'illegal'+suffix,password},cookie)).status,403);
  const s=(await get('/api/club',cookie)).data;
  assert.equal((await request('/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({action:'role',payload:{accountId,role:'admin',reason:'虚构越权检查'},requestId:randomUUID(),revision:s.revision})})).status,403);
  assert.equal((await get('/api/club?export=1',cookie)).status,403);
 });
 await test('伪造、篡改与过期会话被拒绝，数据库只存会话摘要',async()=>{
  assert.equal((await get('/api/club','yulin_session=malformed')).status,401);
  assert.equal((await get('/api/club','yulin_session='+randomBytes(32).toString('base64url'))).status,401);
  const value=cookie.slice('yulin_session='.length),tampered=value.slice(0,-1)+(value.endsWith('A')?'B':'A');assert.equal((await get('/api/club','yulin_session='+tampered)).status,401);
  const hash=tokenHash(cookie),rows=localSQL(`SELECT id FROM auth_sessions WHERE id='${hash}'`)[0].results;assert.equal(rows.length,1);assert.equal(rows[0].id.length,64);assert.ok(rows[0].id!==value,'Plain session token must not be stored');
  localSQL(`UPDATE auth_sessions SET expires=1 WHERE id='${hash}'`);assert.equal((await get('/api/club',cookie)).status,401);
  const r=await auth({action:'login',username,password});assert.equal(r.status,200);cookie=cookiePair(r.res);
 });
 await test('注销使会话失效，再次登录可恢复，继承的旧身份不会绕过注销',async()=>{
  const out=await auth({action:'logout'},cookie);assert.equal(out.status,200);assert.equal((await get('/api/club',cookie)).status,401);
  assert.ok(out.res.headers.getSetCookie().some(v=>v.startsWith('yulin_session=;')&&v.includes('Max-Age=0')));
  const signedOut=cookiePair(out.res,'yulin_signed_out');assert.equal((await get('/api/club',signedOut,adminHeaders)).status,401);
  const r=await auth({action:'login',username,password},signedOut);assert.equal(r.status,200);cookie=cookiePair(r.res);assert.equal((await get('/api/club',cookie)).data.me.id,accountId);
 });
 await test('用户名归一后的并发重复开户只产生一个成员及档案',async()=>{
  const key='race'+suffix,race=await Promise.all([adminAuth(create(key)),adminAuth(create('RACE'+suffix.toUpperCase()))]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  const s=(await get('/api/club','',adminHeaders)).data,entries=s.loginAccounts.filter(a=>a.username===key);assert.equal(entries.length,1);
  const a=s.accounts.find(a=>a.id===entries[0].accountId);assert.equal(a.role,'member');assert.equal(s.players.filter(p=>p.id===a.playerId).length,1);
  assert.equal(localSQL(`SELECT count(*) AS total FROM password_credentials WHERE username='${key}'`)[0].results[0].total,1);
 });
 await test('管理员开户requestId幂等，不重复产生账号或登录凭据',async()=>{
  const key='idem'+suffix,input=create(key);assert.equal((await adminAuth(input)).status,200);assert.equal((await adminAuth(input)).status,200);
  const s=(await get('/api/club','',adminHeaders)).data;assert.equal(s.loginAccounts.filter(a=>a.username===key).length,1);
  assert.equal(localSQL(`SELECT count(*) AS total FROM password_credentials WHERE username='${key}'`)[0].results[0].total,1);
 });
 await test('为已有球友档案开通账号，保留历史比赛、头像、资料和水平',async()=>{
  const before=(await get('/api/club','',adminHeaders)).data,claimed=new Set(before.accounts.map(a=>a.playerId));
  const p=before.players.find(p=>!claimed.has(p.id)&&p.ownerId===adminId&&before.matches.some(m=>[...m.a,...m.b].includes(p.id)));
  assert.ok(p,'Expected one unclaimed fictional admin-owned profile with historical matches');
  const oldMatches=before.matches.filter(m=>[...m.a,...m.b].includes(p.id)),oldCount=before.players.length,key='profile'+suffix;
  assert.equal((await adminAuth(create(key,{name:p.name,playerId:p.id}))).status,200);
  const s=(await get('/api/club','',adminHeaders)).data,a=s.accounts.find(a=>a.id===s.loginAccounts.find(a=>a.username===key)?.accountId);
  assert.equal(a.playerId,p.id);assert.equal(s.players.length,oldCount);assert.deepEqual(profileValue(s.players.find(x=>x.id===p.id)),profileValue(p));assert.deepEqual(s.matches.filter(m=>[...m.a,...m.b].includes(p.id)),oldMatches);
  const login=await auth({action:'login',username:key,password});assert.equal(login.status,200);const own=(await get('/api/club',cookiePair(login.res))).data;assert.equal(own.me.playerId,p.id);assert.equal(own.players.find(x=>x.id===p.id).ownerId,own.me.id);
  assert.equal((await adminAuth(create('claimtwice'+suffix,{name:p.name,playerId:p.id}))).status,409,'Already linked profile cannot be claimed twice');
 });
 await test('既有ChatGPT成员绑定用户名密码保留同一账号、角色和球友档案',async()=>{
  const id='managed-legacy-'+suffix,h=legacyHeaders(id);assert.equal((await clubCommand('join',{name:'旧身份迁移虚构球友',invite},h)).status,200);
  const before=(await get('/api/club','',h)).data,key='legacy'+suffix;
  const r=await auth({action:'bind',username:key,password},'',h);assert.equal(r.status,200);
  const s=(await get('/api/club',cookiePair(r.res))).data;assert.equal(s.me.id,id);assert.equal(s.me.role,before.me.role);assert.equal(s.me.playerId,before.me.playerId);
  const oldPlayer=before.players.find(p=>p.id===before.me.playerId),newPlayer=s.players.find(p=>p.id===s.me.playerId);assert.deepEqual(profileValue(newPlayer),profileValue(oldPlayer));
  assert.equal((await auth({action:'bind',username:key,password},'',h)).status,409);
  const login=await auth({action:'login',username:key,password});assert.equal(login.status,200);assert.equal((await get('/api/club',cookiePair(login.res))).data.me.id,id);
 });
 await test('管理员给既有旧身份账号设置用户名密码不会重复开户',async()=>{
  const id='managed-provision-'+suffix,h=legacyHeaders(id);assert.equal((await clubCommand('join',{name:'管理员开通旧身份虚构球友',invite},h)).status,200);
  const before=(await get('/api/club','',adminHeaders)).data,a=before.accounts.find(a=>a.id===id),key='provision'+suffix;
  assert.equal((await adminAuth(create(key,{name:'管理员开通旧身份虚构球友',accountId:id}))).status,200);
  const s=(await get('/api/club','',adminHeaders)).data;assert.equal(s.accounts.length,before.accounts.length);assert.deepEqual(s.accounts.find(x=>x.id===id),a);assert.equal(s.players.length,before.players.length);
  const login=await auth({action:'login',username:key,password});assert.equal(login.status,200);assert.equal((await get('/api/club',cookiePair(login.res))).data.me.id,id);
 });
 await test('管理员重置密码撤销全部旧会话，保留用户名、角色、档案和比赛记录',async()=>{
  const second=await auth({action:'login',username,password});assert.equal(second.status,200);const secondCookie=cookiePair(second.res),before=(await get('/api/club','',adminHeaders)).data;
  const r=await adminAuth({action:'resetPassword',accountId,password:replacement,requestId:randomUUID()});assert.equal(r.status,200);
  assert.equal((await get('/api/club',cookie)).status,401);assert.equal((await get('/api/club',secondCookie)).status,401);assert.equal((await auth({action:'login',username,password})).status,401);
  const s=(await get('/api/club','',adminHeaders)).data;assert.deepEqual(s.accounts.find(a=>a.id===accountId),before.accounts.find(a=>a.id===accountId));assert.deepEqual(s.matches,before.matches);assert.deepEqual(s.players.find(p=>p.id===playerId),before.players.find(p=>p.id===playerId));assert.equal(s.loginAccounts.find(a=>a.accountId===accountId).username,username);
  const login=await auth({action:'login',username,password:replacement});assert.equal(login.status,200);cookie=cookiePair(login.res);assert.equal((await get('/api/club',cookie)).data.me.id,accountId);
  assert.equal(localSQL(`SELECT count(*) AS total FROM auth_sessions WHERE user_id='${accountId}'`)[0].results[0].total,1);
 });
 await test('弱重置密码与不存在的目标被拒绝',async()=>{
  assert.equal((await adminAuth({action:'resetPassword',accountId,password:'short',requestId:randomUUID()})).status,400);
  const missing=await adminAuth({action:'resetPassword',accountId:'missing-'+suffix,password:replacement,requestId:randomUUID()});assert.ok([400,404].includes(missing.status),'Unknown account must not be created by reset');
 });
 await test('管理员的旧邮箱形式登录键仍可使用，重置不改变管理员身份',async()=>{
  const s=(await get('/api/club','',adminHeaders)).data,entry=s.loginAccounts.find(a=>a.accountId===adminId);assert.ok(entry,'Expected migrated old admin credential');
  const fixturePassword=randomBytes(24).toString('base64url');assert.equal((await adminAuth({action:'resetPassword',accountId:adminId,password:fixturePassword,requestId:randomUUID()})).status,200);
  const login=await auth({action:'login',username:entry.username,password:fixturePassword});assert.equal(login.status,200);const current=(await get('/api/club',cookiePair(login.res))).data;assert.equal(current.me.id,adminId);assert.equal(current.me.role,'admin');assert.equal(current.me.playerId,adminBefore.me.playerId);assert.equal(current.auth.method,'password');assert.deepEqual(current.matches,s.matches);
 });
 await test('旧密码登录与管理员重置并发时，不会产生可用的旧密码会话',async()=>{
  const key='resetrace'+suffix,created=await adminAuth(create(key));assert.equal(created.status,200);
  const target=created.data.accountId;assert.ok(/^account:[a-f0-9-]{36}$/.test(target),'Unexpected fictional race account ID');
  const snapshot=raceSQL(`SELECT salt,hash FROM password_credentials WHERE id='${target}'`)[0].results[0];
  assert.ok(snapshot&&/^[a-f0-9]{64}$/.test(snapshot.salt)&&/^[a-f0-9]{128}$/.test(snapshot.hash),'Unexpected credential snapshot format');
  let activePassword=password,issued=0;
  for(let iteration=0;iteration<3;iteration++){
   const nextPassword=randomBytes(24).toString('base64url');
   const requests=await Promise.all([
    ...Array.from({length:3},()=>auth({action:'login',username:key,password:activePassword})),
    adminAuth({action:'resetPassword',accountId:target,password:nextPassword,requestId:randomUUID()})
   ]);
   assert.equal(requests[3].status,200,'Race password reset must succeed');
   for(const login of requests.slice(0,3)){
    assert.ok([200,401].includes(login.status),'Racing login must either succeed before reset or reject stale credentials');
    if(login.status===200){issued++;assert.equal((await get('/api/club',cookiePair(login.res))).status,401,'Reset must revoke every issued old-password session')}
    else assert.equal(login.res.headers.getSetCookie().length,0,'Rejected stale login must not emit a session cookie');
   }
   assert.equal((await auth({action:'login',username:key,password:activePassword})).status,401,'Old password must fail after reset');
   const next=await auth({action:'login',username:key,password:nextPassword});assert.equal(next.status,200);assert.equal((await get('/api/club',cookiePair(next.res))).data.me.id,target);
   activePassword=nextPassword;
  }
  // Deterministically model a verified old hash reaching the atomic INSERT after a reset.
  const staleToken=randomBytes(32).toString('base64url'),staleCookie='yulin_session='+staleToken,staleId=tokenHash(staleCookie);
  // Wrangler CLI omits runtime meta.changes; RETURNING measures the actual inserted rows.
  const insertion=raceSQL(`INSERT INTO auth_sessions(id,user_id,expires) SELECT '${staleId}','${target}',${Date.now()+60000} FROM password_credentials WHERE id='${target}' AND salt='${snapshot.salt}' AND hash='${snapshot.hash}' RETURNING id`)[0];
  assert.equal(insertion.results.length,0,'Stale credential guard must not insert a session');
  assert.equal(raceSQL(`SELECT count(*) AS total FROM auth_sessions WHERE id='${staleId}'`)[0].results[0].total,0);
  assert.equal((await get('/api/club',staleCookie)).status,401,'A stale credential snapshot must never create a usable session');
  loginResetRace={iterations:3,parallelLoginsPerReset:3,oldPasswordCookiesIssued:issued,staleCredentialInsertReturnedRows:insertion.results.length,staleSessionRejected:true};
 });
 await test('连续错误登录触发用户名限流，不影响其他账号',async()=>{
  const key='throttle'+suffix;for(let n=0;n<8;n++)assert.equal((await auth({action:'login',username:key,password})).status,401);
  assert.equal((await auth({action:'login',username:key,password})).status,429);assert.equal((await auth({action:'login',username,password:replacement})).status,200);
 });
 await test('账户管理拒绝跨站及缺少Origin，随后合法请求继续响应',async()=>{
  const headers={...adminHeaders,Origin:'https://example.invalid'};
  assert.equal((await auth(create('csrf'+suffix),'',headers)).status,403);
  assert.equal((await auth({action:'resetPassword',accountId,password,requestId:randomUUID()},'',headers)).status,403);
  assert.equal((await auth({action:'logout'},cookie,{Origin:'https://example.invalid'})).status,403);
  assert.equal((await request('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})})).status,403);
  assert.equal((await get('/api/auth',cookie)).data.signedIn,true);assert.equal((await get('/api/club',cookie)).status,200);
  assert.equal((await get('/api/auth/legacy','',{'Sec-Fetch-Site':'cross-site'})).status,403);
 });
}catch(error){results.push({name:currentTest||'fixture precondition',status:'failed',error:error.message});process.exitCode=1;console.error('FAIL '+(currentTest||'fixture precondition')+': '+error.message)}
finally{
 mkdirSync('.test-output',{recursive:true});const passed=results.filter(r=>r.status==='passed').length,failed=results.filter(r=>r.status==='failed').length;
 const report={at:new Date().toISOString(),origin,fictionalClientIP:fixtureIP,testFilter,scope:'Local fictional admin-managed username/password fixtures only; no database resets, hosted requests, or secret logging',passed,failed,transportRetries,loginResetRace,results};
 writeFileSync('.test-output/managed-accounts-results.json',JSON.stringify(report,null,2));
 writeFileSync('.test-output/MANAGED_ACCOUNTS_RESULTS.md',`# 管理员开通账号集成验收\n\n执行时间：${report.at}\n\n环境：${origin}，既有虚构本地数据；未重置数据库或访问线上服务。密码和会话令牌未输出或存储。\n\n通过 ${passed} 项，失败 ${failed} 项。\n\n${results.map(r=>`- ${r.status==='passed'?'通过':'失败'}：${r.name}${r.error?'；'+r.error:''}`).join('\n')}\n\n传输：node:http独立连接；仅对明确Worker重启的503重试一次，本次 ${transportRetries.length} 次。Loopback专用RFC5737客户端IP ${fixtureIP} 隔离本次测试限流桶，未清空既有限流。\n\n限制：HTTPS Secure Cookie及二进制照片上传未在本HTTP认证测试中验证。\n`);
 appendFileSync('.test-output/MANAGED_ACCOUNTS_RESULTS.md',`\n运行模式：${testFilter?'仅选定回归：'+testFilter:'完整脚本'}。未选定的测试未执行或计入本次通过数。\n${loginResetRace?`\n并发证据：${loginResetRace.iterations} 轮，每轮 ${loginResetRace.parallelLoginsPerReset} 次旧密码登录与重置并行；${loginResetRace.oldPasswordCookiesIssued} 个已签发旧密码会话在重置后全部失效。确定性过期凭据条件插入返回 ${loginResetRace.staleCredentialInsertReturnedRows} 行，数据库会话数为0，伪造该会话读取群组返回401。\n`:''}`);
 console.log(JSON.stringify({passed,failed,retries:transportRetries.length}));
}
