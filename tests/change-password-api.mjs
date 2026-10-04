import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {checkPassword} from '../lib/password.ts';

// Run only after the built Worker and local D1 are ready. Never use hosted origins.
// CHANGE_PASSWORD_TEST_ORIGIN=http://127.0.0.1:8787 node --experimental-strip-types tests/change-password-api.mjs
// Credentials, credential snapshots and session tokens remain in memory only.
const target=new URL(process.env.CHANGE_PASSWORD_TEST_ORIGIN??'http://127.0.0.1:8787');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(target.hostname),'Loopback only');
assert.equal(target.pathname,'/','Use an origin without a path');
assert.ok(!target.username&&!target.password&&!target.search&&!target.hash,'Use a plain loopback origin without credentials or URL parameters');
const origin=target.origin;
const suffix=randomUUID().replaceAll('-','').slice(0,12),fixtureIP='203.0.113.'+(1+parseInt(suffix.slice(0,4),16)%254);
const adminId=process.env.CHANGE_PASSWORD_TEST_ADMIN_ID??'local_seedy';
const adminHeaders={'oai-authenticated-user-id':adminId,'oai-authenticated-user-email':adminId+'@example.invalid'};
const secrets=[],results=[],transportRetries=[];
const password=()=>{const value=randomBytes(24).toString('base64url');secrets.push(value);return value};
const A={username:'cp_a_'+suffix,password:password(),cookies:[]},B={username:'cp_b_'+suffix,password:password(),cookies:[]};
let currentTest='fixture setup',historyBefore,profileBefore,initialSnapshot,loginRace,twoChanges,adminRace,rateLimit;

function cookiePair(res,name='yulin_session'){
 const line=res.headers.getSetCookie().find(value=>value.startsWith(name+'='));
 assert.ok(line,'Expected authentication cookie');return line.split(';')[0];
}
async function request(path,{method='GET',headers={},body=''}={}){
 for(let attempt=0;attempt<2;attempt++){
  let response;
  try{response=await new Promise((resolve,reject)=>{
   const url=new URL(path,origin),send=url.protocol==='https:'?httpsRequest:httpRequest;
   const req=send(url,{method,agent:false,headers:{'cf-connecting-ip':fixtureIP,...headers,Connection:'close',...(body?{'Content-Length':Buffer.byteLength(body)}:{})},signal:AbortSignal.timeout(20000)},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>{const h=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)h.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve({status:res.statusCode,headers:h,body:Buffer.concat(chunks).toString()})});
   });req.on('error',reject);req.end(body);
  })}catch{throw new Error(`${method} ${path} transport failed`)}
  if(attempt===0&&response.status===503&&response.body==='Your worker restarted mid-request. Please try sending the request again. Only GET or HEAD requests are retried automatically.'){
   transportRetries.push({path,method});await new Promise(resolve=>setTimeout(resolve,200));continue;
  }
  let data;try{data=JSON.parse(response.body)}catch{data=response.body}
  return {status:response.status,res:{headers:response.headers},data};
 }
}
const get=(session='',headers={})=>request('/api/club',{headers:{...headers,...(session?{Cookie:session}:{})}});
const auth=(payload,session='',headers={})=>request('/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(session?{Cookie:session}:{}),...headers},body:JSON.stringify(payload)});
const changeInput=(currentPassword,newPassword,values={})=>({action:'changePassword',currentPassword,newPassword,confirmPassword:newPassword,requestId:randomUUID(),...values});
async function login(account,value=account.password){
 const result=await auth({action:'login',username:account.username,password:value});assert.equal(result.status,200,'Fictional fixture login must succeed');
 const session=cookiePair(result.res);account.cookies.push(session);account.cookie=session;return session;
}
function localSQL(sql){
 try{return JSON.parse(execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to','.wrangler/state','--config','dist/server/wrangler.json','--command',sql,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0].results}
 catch{throw new Error('Local fictional-fixture SQL check failed')}
}
function credential(account){const row=localSQL(`SELECT salt,hash FROM password_credentials WHERE id='${account.id}'`)[0];assert.ok(row&&/^[a-f0-9]{64}$/.test(row.salt)&&/^[a-f0-9]{128}$/.test(row.hash),'Unexpected fixture credential format');return row}
const tokenHash=session=>createHash('sha256').update(session.slice('yulin_session='.length)).digest('hex');
// Isolate independent cases by clearing only this newly created fictional user's
// change-password bucket. Existing users and the shared IP/login buckets stay intact.
function resetFixtureChangeBudget(account){const key=createHash('sha256').update('changePassword:'+account.id).digest('hex');localSQL(`DELETE FROM auth_rate_limits WHERE id='${key}'`)}
async function test(name,run){currentTest=name;await run();results.push({name,status:'passed'});console.log('PASS '+name)}
async function rejectOldSessions(account){for(const session of account.cookies)assert.equal((await get(session)).status,401,'Old sessions must remain revoked')}
const matchingCommits=inputs=>localSQL(`SELECT key,revision FROM commits WHERE ${inputs.map(input=>`key LIKE '%:${input.requestId}'`).join(' OR ')} ORDER BY revision DESC`);
const lastCommit=inputs=>matchingCommits(inputs)[0];
function assertFinalPassword(account,candidates){
 const c=credential(account),matches=candidates.filter(candidate=>checkPassword(candidate.password,c.salt,c.hash));
 assert.equal(matches.length,1,'Final credentials must match exactly one successful operation');return matches[0];
}

try{
 await test('未登录修改密码返回401，不触碰已有账号',async()=>{
  assert.equal((await auth(changeInput(password(),password()))).status,401);
 });
 const admin=(await get('',adminHeaders));assert.equal(admin.status,200,'Local admin fixture must already exist');assert.equal(admin.data.me.role,'admin');
 for(const account of [A,B]){
  const created=await auth({action:'createAccount',name:account===A?'修改密码虚构甲':'修改密码虚构乙',username:account.username,password:account.password,requestId:randomUUID()},'',adminHeaders);
  assert.equal(created.status,200,'Create only a new fictional local member');account.id=created.data.accountId;
  assert.ok(/^account:[a-f0-9-]{36}$/.test(account.id),'Unexpected fixture account ID');await login(account);
 }
 await login(A);
 const before=(await get('',adminHeaders)).data;
 const preserved=state=>({accounts:state.accounts.filter(a=>[A.id,B.id].includes(a.id)),players:state.players.filter(p=>state.accounts.some(a=>[A.id,B.id].includes(a.id)&&a.playerId===p.id)),usernames:state.loginAccounts.filter(a=>[A.id,B.id].includes(a.accountId))});
 profileBefore=JSON.stringify(preserved(before));historyBefore=JSON.stringify(before.matches);initialSnapshot=credential(A);
 const bCredential=credential(B);

 await test('旧密码错误不会修改凭据或撤销现有会话',async()=>{
  const snapshot=credential(A);assert.equal((await auth(changeInput(password(),password()),A.cookie)).status,401);
  const after=credential(A);assert.ok(snapshot.salt===after.salt&&snapshot.hash===after.hash,'Credential must stay unchanged');assert.equal((await get(A.cookie)).status,200);
 });
 await test('短密码、确认不一致、重复旧密码和越权指定其他账号均被拒绝',async()=>{
  assert.equal((await auth(changeInput(A.password,'short'),A.cookie)).status,400);
  assert.equal((await auth(changeInput(A.password,password(),{confirmPassword:password()}),A.cookie)).status,400);
  assert.equal((await auth(changeInput(A.password,A.password),A.cookie)).status,400);
  assert.equal((await auth(changeInput(A.password,password(),{accountId:B.id}),A.cookie)).status,400);
  assert.equal((await auth(changeInput(A.password,password(),{username:B.username}),A.cookie)).status,400);
  assert.equal((await get(A.cookie)).status,200);assert.equal((await get(B.cookie)).status,200);
  const after=credential(B);assert.ok(after.salt===bCredential.salt&&after.hash===bCredential.hash,'Other account password must not change');
 });
 await test('跨站、缺少Origin及超过8KB请求拒绝且有效会话保持',async()=>{
  assert.equal((await auth(changeInput(A.password,password()),A.cookie,{Origin:'https://example.invalid'})).status,403);
  assert.equal((await request('/api/auth',{method:'POST',headers:{Cookie:A.cookie,'Content-Type':'application/json'},body:JSON.stringify(changeInput(A.password,password()))})).status,403);
  const oversized=await request('/api/auth',{method:'POST',headers:{Origin:origin,Cookie:A.cookie,'Content-Type':'application/json'},body:JSON.stringify({...changeInput(A.password,password()),padding:'x'.repeat(9000)})});assert.ok([400,413].includes(oversized.status),'Oversized body must be rejected');
  assert.equal((await get(A.cookie)).status,200);assert.equal((await get(B.cookie)).status,200);
 });
 await test('本人修改成功后旧密码失效、全部旧会话撤销，其他账号会话保留',async()=>{
  resetFixtureChangeBudget(A);
  const oldPassword=A.password,next=password(),changed=await auth(changeInput(oldPassword,next),A.cookie);assert.equal(changed.status,200);
  assert.ok(changed.res.headers.getSetCookie().some(v=>v.startsWith('yulin_session=;')&&v.includes('Max-Age=0')),'Change must clear the current session cookie');
  assert.ok(changed.res.headers.getSetCookie().some(v=>v.startsWith('yulin_signed_out=1;')),'Change must stop inherited identity fallback');
  await rejectOldSessions(A);assert.equal((await get(B.cookie)).status,200);assert.equal((await auth({action:'login',username:A.username,password:oldPassword})).status,401);
  A.password=next;await login(A);assert.equal((await get(A.cookie)).data.me.id,A.id);
 });
 await test('撤销的成员令牌加可信旧管理员身份头也不会回退或越权',async()=>{
  const oldSession=A.cookies[0];assert.equal((await get(oldSession,adminHeaders)).status,401);
  const state=await request('/api/auth',{headers:{Cookie:oldSession,...adminHeaders}});assert.equal(state.data.signedIn,false);
  assert.equal((await auth(changeInput(A.password,password()),oldSession,adminHeaders)).status,401);
 });
 await test('旧密码登录与本人改密并发后，不留下可用旧会话',async()=>{
  const oldPassword=A.password,next=password(),input=changeInput(oldPassword,next),responses=await Promise.all([
   ...Array.from({length:3},()=>auth({action:'login',username:A.username,password:oldPassword})),auth(input,A.cookie)
  ]);
  assert.equal(responses[3].status,200,'Self password change must succeed');let issued=0;
  for(const response of responses.slice(0,3)){assert.ok([200,401].includes(response.status),'Concurrent old login must succeed before change or reject stale credentials');if(response.status===200){issued++;const session=cookiePair(response.res);A.cookies.push(session);assert.equal((await get(session)).status,401,'Every racing old login session must be revoked')}}
  await rejectOldSessions(A);A.password=next;await login(A);assert.equal((await get(B.cookie)).status,200);loginRace={parallelOldLogins:3,issuedOldCookies:issued,usableOldCookies:0};
 });
 await test('两个同时以旧密码修改的请求只有一个提交，最终密码与成功提交一致',async()=>{
  const inputs=[changeInput(A.password,password()),changeInput(A.password,password())],session=A.cookie,responses=await Promise.all(inputs.map(input=>auth(input,session)));
  const successful=responses.map((response,index)=>({response,index})).filter(({response})=>response.status===200);assert.equal(successful.length,1,'Exactly one self change must commit');
  const loser=1-successful[0].index;assert.ok([401,409].includes(responses[loser].status),'Competing stale change must reject');
  const committedRows=matchingCommits(inputs);assert.equal(committedRows.length,1,'Rejected stale change must not leave a commit');const committed=committedRows[0];assert.ok(committed?.key.endsWith(':'+inputs[successful[0].index].requestId),'Only successful request may be committed');
  const winner=assertFinalPassword(A,[{password:inputs[successful[0].index].newPassword,index:successful[0].index}]);
  await rejectOldSessions(A);A.password=winner.password;await login(A);assert.equal((await auth({action:'login',username:A.username,password:inputs[loser].newPassword})).status,401);
  twoChanges={statuses:responses.map(r=>r.status),successfulCommits:1,finalCredentialMatchesCommit:true};
 });
 await test('管理员重置与本人改密并发时，本人不能用过期验证覆盖新凭据',async()=>{
  const selfInput=changeInput(A.password,password()),resetInput={action:'resetPassword',accountId:A.id,password:password(),requestId:randomUUID()},responses=await Promise.all([auth(selfInput,A.cookie),auth(resetInput,'',adminHeaders)]);
  assert.equal(responses[1].status,200,'Authorized administrator reset must retain its normal behavior');assert.ok([200,401,409].includes(responses[0].status),'Self change may commit first or reject stale credentials');
  const committed=lastCommit([selfInput,resetInput]);assert.ok(committed,'A successful credential transaction must exist');
  // Admin reset may legitimately write last. A self change validated against the
  // old password cannot commit after the admin's replacement credential.
  assert.ok(committed.key.endsWith(':'+resetInput.requestId),'The admin replacement must survive the stale self operation');
  const winner=assertFinalPassword(A,[{password:resetInput.password}]);await rejectOldSessions(A);A.password=winner.password;await login(A);assert.equal((await get(B.cookie)).status,200);
  adminRace={selfStatus:responses[0].status,resetStatus:responses[1].status,finalCredentialMatchesLastCommit:true};
 });
 await test('确定性旧凭据条件写入不会签发会话或覆盖最终密码',async()=>{
  const before=credential(A),token=randomBytes(32).toString('base64url'),session='yulin_session='+token,hash=tokenHash(session);
  const inserted=localSQL(`INSERT INTO auth_sessions(id,user_id,expires) SELECT '${hash}','${A.id}',${Date.now()+60000} FROM password_credentials WHERE id='${A.id}' AND salt='${initialSnapshot.salt}' AND hash='${initialSnapshot.hash}' RETURNING id`);
  assert.equal(inserted.length,0,'Verified stale credential must not issue a session');assert.equal((await get(session,adminHeaders)).status,401);
  const staleWrite=localSQL(`UPDATE password_credentials SET salt='${randomBytes(32).toString('hex')}',hash='${randomBytes(64).toString('hex')}' WHERE id='${A.id}' AND salt='${initialSnapshot.salt}' AND hash='${initialSnapshot.hash}' RETURNING id`);
  assert.equal(staleWrite.length,0,'Verified stale credential must not overwrite a newer password');const after=credential(A);assert.ok(before.salt===after.salt&&before.hash===after.hash,'Stale conditional update must have no effect');
 });
 await test('改密限流按本人账号隔离，不阻止其他账号有效会话和自己的密码验证',async()=>{
  resetFixtureChangeBudget(A);
  let failures=0,blocked=false;for(let i=0;i<12;i++){const response=await auth(changeInput(password(),password()),A.cookie);if(response.status===429){blocked=true;break}assert.equal(response.status,401,'Wrong old password must be rejected');failures++}
  assert.ok(blocked,'Account must eventually hit its eight-attempt change-password limit');assert.equal(failures,8,'Eight wrong current-password attempts are allowed before throttling');assert.equal((await get(A.cookie)).status,200,'Rate limiting must not silently revoke the valid session');
  assert.equal((await auth(changeInput(password(),password()),B.cookie)).status,401,'Another member has an independent change-password rate bucket');assert.equal((await get(B.cookie)).status,200);
  rateLimit={wrongAttemptsInFinalPhase:failures,blocked:true,otherAccountIndependent:true};
 });
 await test('改密只修改认证资料，昵称角色历史保留，审计不包含密码或认证摘要',async()=>{
  const after=(await get('',adminHeaders)).data;assert.ok(JSON.stringify(preserved(after))===profileBefore,'Names, roles, profile and usernames must remain unchanged');assert.ok(JSON.stringify(after.matches)===historyBefore,'Existing match history must remain unchanged');
  const audits=after.audits.filter(a=>a.actor===A.id||a.changes?.accountId===A.id||a.changes?.accountId===B.id),encoded=JSON.stringify(audits);
  assert.ok(audits.some(a=>a.action==='changeOwnPassword'),'Self password change must have an audit record');
  assert.equal(audits.filter(a=>a.actor===A.id&&a.action==='changeOwnPassword').length,3+(adminRace.selfStatus===200?1:0),'Rejected or racing stale changes must not leave false success audits');
  for(const secret of secrets)assert.ok(!encoded.includes(secret),'Audit must not contain any password');assert.ok(!/"(?:currentPassword|newPassword|confirmPassword|salt|hash)"\s*:/.test(encoded),'Audit must not contain credential material');
  const currentB=credential(B);assert.ok(currentB.salt===bCredential.salt&&currentB.hash===bCredential.hash,'Other member credential stays unchanged');assert.equal((await get(B.cookie)).status,200);
 });
}catch(error){
 const message=String(error?.message??'Unknown error');const safe=secrets.some(secret=>message.includes(secret))?'Sensitive assertion detail suppressed':message;
 results.push({name:currentTest,status:'failed',error:safe});process.exitCode=1;console.error('FAIL '+currentTest+': '+safe);
}finally{
 const report={at:new Date().toISOString(),origin,scope:'Two newly created fictional loopback member accounts only; only their account-specific change-password budget is isolated between cases; no production requests, existing-user password changes, global rate resets or secret logging',passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,transportRetries,loginRace,twoChanges,adminRace,rateLimit,results};
 mkdirSync('.test-output',{recursive:true});writeFileSync('.test-output/change-password-results.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,failed:report.failed,retries:transportRetries.length}));
}
