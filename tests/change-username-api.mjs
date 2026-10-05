import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';

// Fresh isolated loopback Worker only. Apply migrations 0000–0006 beforehand.
// CHANGE_USERNAME_TEST_ORIGIN=http://127.0.0.1:8788
// CHANGE_USERNAME_TEST_PERSIST=.test-output/change-username-state
// node tests/change-username-api.mjs
// No existing account, real password, production service or Site is modified.
const target=new URL(process.env.CHANGE_USERNAME_TEST_ORIGIN??'http://127.0.0.1:8788');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(target.hostname),'Loopback only');
assert.ok(!target.username&&!target.password&&!target.search&&!target.hash&&target.pathname==='/','Plain loopback origin only');
const origin=target.origin,persist=process.env.CHANGE_USERNAME_TEST_PERSIST??'.test-output/change-username-state';
assert.ok(resolve(persist).startsWith(resolve('.test-output')+sep),'Isolated fixture DB must be inside .test-output');
const suffix=randomUUID().replaceAll('-','').slice(0,10),fixtureIP='203.0.113.'+(1+parseInt(suffix.slice(0,4),16)%254);
const secrets=[],results=[],races={};let currentTest='fresh fixture precondition',historyBefore,recordsBefore;
const password=()=>{const value=randomBytes(24).toString('base64url');secrets.push(value);return value};
const owner={id:'username-owner-'+suffix,username:'owner'+suffix,password:password(),cookies:[]};
const ownerHeaders={'oai-authenticated-user-id':owner.id,'oai-authenticated-user-email':owner.id+'@example.invalid'};
const members=['a','b','c','d','e'].map(letter=>({username:'member'+letter+suffix,password:password(),cookies:[]}));
const [A,B,C,D,E]=members;
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
function sql(command){try{return JSON.parse(execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to',persist,'--config','dist/server/wrangler.json','--command',command,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0].results}catch{throw new Error('Isolated fixture SQL check failed')}}
const credential=account=>sql(`SELECT username,salt,hash,username_changed_at AS usernameChangedAt FROM password_credentials WHERE id=${quote(account.id)}`)[0]??null;
const commits=inputs=>sql(`SELECT key,revision FROM commits WHERE ${inputs.map(input=>`key LIKE ${quote('%:'+input.requestId)}`).join(' OR ')} ORDER BY revision`);
function pair(response,name='yulin_session'){const line=response.headers.getSetCookie().find(value=>value.startsWith(name+'='));assert.ok(line,'Expected cookie');return line.split(';')[0]}
async function request(path,{method='GET',headers={},body=''}={}){
 try{return await new Promise((resolveRequest,reject)=>{const url=new URL(path,origin),send=url.protocol==='https:'?httpsRequest:httpRequest;const req=send(url,{method,agent:false,headers:{'cf-connecting-ip':fixtureIP,...headers,Connection:'close',...(body?{'Content-Length':Buffer.byteLength(body)}:{})},signal:AbortSignal.timeout(20000)},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>{const headers=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)headers.append(res.rawHeaders[i],res.rawHeaders[i+1]);let data;const text=Buffer.concat(chunks).toString();try{data=JSON.parse(text)}catch{data=text}resolveRequest({status:res.statusCode,headers,data})})});req.on('error',reject);req.end(body)})}catch{throw new Error(`${method} ${path} transport failed`)}
}
const get=(account,path='/api/club',headers={})=>request(path,{headers:{...headers,...(account?.cookie?{Cookie:account.cookie}:{})}});
const auth=(input,account,headers={})=>request('/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(account?.cookie?{Cookie:account.cookie}:{}),...headers},body:JSON.stringify(input)});
const input=(account,newUsername,values={})=>({action:'changeUsername',newUsername,currentPassword:account.password,requestId:randomUUID(),...values});
const legacyOwnerAuth=body=>auth(body,null,ownerHeaders);
async function login(account,username=account.username){const response=await auth({action:'login',username,password:account.password});assert.equal(response.status,200,'Fictional login must succeed');account.cookie=pair(response);account.cookies.push(account.cookie);return account.cookie}
async function refreshName(account){const row=credential(account);assert.ok(row);account.username=row.username;await login(account)}
async function revoked(account){for(const cookie of account.cookies)assert.equal((await get({cookie})).status,401,'Old target sessions must be revoked')}
async function test(name,fn){currentTest=name;await fn();results.push({name,status:'passed'});console.log('PASS '+name)}
async function club(action,payload){const state=(await get(null,'/api/club',ownerHeaders)).data;const response=await request('/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...ownerHeaders},body:JSON.stringify({action,payload,requestId:randomUUID(),revision:state.revision})});assert.equal(response.status,200,'Fictional club command must succeed');return (await get(null,'/api/club',ownerHeaders)).data}
function resetBudget(account){const id=createHash('sha256').update('changeUsername:'+account.id).digest('hex');sql(`DELETE FROM auth_rate_limits WHERE id=${quote(id)}`)}

try{
 // Fail before initialization if either the CLI DB or HTTP Worker is not empty.
 assert.equal(sql('SELECT count(*) AS n FROM accounts')[0].n,0,'Use a fresh isolated database');
 assert.equal(sql('SELECT count(*) AS n FROM password_credentials')[0].n,0,'Never run on existing credentials');
 assert.equal((await get(null,'/api/club',ownerHeaders)).data.setup,true,'HTTP Worker must share the fresh fixture database');
 await club('initialize',{name:'登录账号修改隔离验收',invite:password()});
 for(const member of members){const created=await legacyOwnerAuth({action:'createAccount',username:member.username,password:member.password,name:'虚构成员'+member.username[6],requestId:randomUUID()});assert.equal(created.status,200);member.id=created.data.accountId;await login(member)}
 const start=Date.now()-60000,end=start+2*3600000;
 let state=await club('event',{title:'虚构历史保持验收',start,end,venue:'虚构场地',address:'',capacity:8,signupDeadline:end,cancelDeadline:end,note:'本地隔离fixture',status:'open',bookings:[{name:'一号场',start,end,pricing:'total',cents:0}]});
 const event=state.events.at(-1);
 for(const member of [A,B,C,D]){const playerId=state.accounts.find(a=>a.id===member.id).playerId;state=await club('register',{eventId:event.id,playerId,arrival:start,departure:end,note:''})}
 state=await club('generate',{eventId:event.id,at:Date.now()+2000,duration:5,seed:1});const round=state.rounds.at(-1);state=await club('publish',{roundId:round.id});state=await club('start',{roundId:round.id,at:round.start,monthly:true,elo:true});const match=state.matches.at(-1);state=await club('score',{matchId:match.id,a:21,b:19,end:round.start+300000,reason:'虚构验收比赛'});
 historyBefore=JSON.stringify(state.matches);recordsBefore=JSON.stringify({accounts:state.accounts.map(({isOwner,canModify,...account})=>account),players:state.players});

 await test('未登录、跨站、额外目标和非ASCII新账号均被拒绝',async()=>{
  assert.equal((await auth(input(A,'newa'+suffix))).status,401);
  assert.equal((await auth(input(A,'newa'+suffix),A,{Origin:'https://example.invalid'})).status,403);
  for(const invalid of ['x','x'.repeat(33),'中文账号','name_1','name-1','name@example.invalid','ＡＢＣ１２','with space'])assert.equal((await auth(input(A,invalid),A)).status,400);
  assert.equal((await auth(input(A,'newa'+suffix,{accountId:B.id}),A)).status,403);
  assert.equal((await auth(input(A,'newa'+suffix,{usernameChangedAt:null}),A)).status,400);
  assert.equal(credential(A).usernameChangedAt,null);assert.equal((await get(A)).status,200);
 });
 await test('新开通及绑定只收ASCII账号，旧账号格式仍可登录',async()=>{
  for(const username of ['new_user','新账号','ＦＵＬＬ１２']){assert.equal((await legacyOwnerAuth({action:'createAccount',name:'不会创建',username,password:password(),requestId:randomUUID()})).status,400);assert.equal((await legacyOwnerAuth({action:'bind',username,password:owner.password})).status,400)}
  for(const username of ['旧乙'+suffix,'legacy_'+suffix,'legacy-'+suffix,'legacy'+suffix+'@example.invalid']){sql(`UPDATE password_credentials SET username=${quote(username)} WHERE id=${quote(B.id)}`);B.username=username;await login(B);assert.equal((await get(B,'/api/auth')).data.username,username);assert.equal(credential(B).usernameChangedAt,null)}
 });
 await test('未绑定密码的已验证群主可代改，成员自主机会不消耗',async()=>{
  const metadata=(await get(null,'/api/auth',ownerHeaders)).data;assert.equal(metadata.isOwner,true);assert.equal(metadata.passwordEnabled,false);
  const response=await legacyOwnerAuth({action:'changeUsername',accountId:A.id,newUsername:'OwnerFirst'+suffix,requestId:randomUUID()});assert.equal(response.status,200);assert.equal(response.data.signedOut,false);assert.equal(response.headers.getSetCookie().length,0);assert.equal(credential(A).usernameChangedAt,null);await revoked(A);await refreshName(A);assert.equal(A.username,'ownerfirst'+suffix);
 });
 await test('群主无密码豁免与绑定并发不会越过新增密码状态',async()=>{
  const rename={action:'changeUsername',accountId:A.id,newUsername:'bindingrace'+suffix,requestId:randomUUID()},responses=await Promise.all([legacyOwnerAuth(rename),legacyOwnerAuth({action:'bind',username:owner.username,password:owner.password})]);
  assert.equal(responses[1].status,200);assert.ok([200,400,401,409].includes(responses[0].status));
  if(responses[0].status===200)assert.equal(credential(A).username,'bindingrace'+suffix);
  assert.equal(credential(A).usernameChangedAt,null);await refreshName(A);await login(owner);races.binding={renameStatus:responses[0].status,bindStatus:responses[1].status};
 });
 await test('错误密码、同名、占用账号不消费机会或撤销有效会话',async()=>{
  const before=credential(A);assert.equal((await auth(input(A,'gooda'+suffix,{currentPassword:password()}),A)).status,401);
  assert.equal((await auth(input(A,A.username.toUpperCase()),A)).status,400);assert.equal((await auth(input(A,C.username.toUpperCase()),A)).status,409);
  const after=credential(A);assert.ok(before.username===after.username&&before.hash===after.hash&&after.usernameChangedAt===null);assert.equal((await get(A)).status,200);assert.equal((await get(C)).status,200);
 });
 await test('成员一次自主修改成功退出全部设备，重复请求不重复消费',async()=>{
  resetBudget(A);await login(A);const request=input(A,'MemberOnce'+suffix),old=A.username,response=await auth(request,A);assert.equal(response.status,200);assert.equal(response.data.signedOut,true);assert.ok(response.headers.getSetCookie().some(v=>v.startsWith('yulin_session=;')));assert.ok(response.headers.getSetCookie().some(v=>v.startsWith('yulin_signed_out=1;')));assert.equal((await auth({action:'login',username:old,password:A.password})).status,401);
  const used=credential(A).usernameChangedAt;assert.ok(Number.isInteger(used));await revoked(A);await refreshName(A);
  const duplicate=await auth(request,A);assert.equal(duplicate.status,200);assert.equal(duplicate.data.duplicate,true);assert.equal(duplicate.data.signedOut,false);assert.equal((await get(A)).status,200);assert.equal(credential(A).usernameChangedAt,used);
  assert.equal((await auth(input(A,'secondself'+suffix),A)).status,409);assert.equal((await get(A,'/api/auth')).data.canChangeUsername,false);assert.equal((await get(A)).data.auth.canChangeUsername,false);
 });
 await test('群主多次代改保留已消费时间，且只撤销目标会话',async()=>{
  const used=credential(A).usernameChangedAt,ownerCookie=owner.cookie;
  for(let i=0;i<2;i++){const response=await auth(input(owner,'owned'+i+suffix,{accountId:A.id}),owner);assert.equal(response.status,200);assert.equal(response.data.signedOut,false);assert.equal(response.headers.getSetCookie().length,0);assert.equal(credential(A).usernameChangedAt,used);await revoked(A);await refreshName(A);assert.equal((await get({cookie:ownerCookie})).status,200)}
  const reset=await auth({action:'resetPassword',accountId:A.id,password:password(),requestId:randomUUID()},owner);assert.equal(reset.status,200);A.password=secrets.at(-1);await refreshName(A);assert.equal(credential(A).usernameChangedAt,used);assert.equal((await auth(input(A,'afterreset'+suffix),A)).status,409);
 });
 await test('两个成员抢同一账号名只有一人成功，失败者保留自主机会',async()=>{
  const inputs=[input(D,'shared'+suffix),input(E,'SHARED'+suffix)],responses=await Promise.all([auth(inputs[0],D),auth(inputs[1],E)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const winner=responses[0].status===200?D:E,loser=winner===D?E:D;assert.ok(Number.isInteger(credential(winner).usernameChangedAt));assert.equal(credential(loser).usernameChangedAt,null);await refreshName(winner);assert.equal((await get(loser)).status,200);races.unique={statuses:responses.map(r=>r.status),successfulCommits:commits(inputs).length};assert.equal(races.unique.successfulCommits,1);
 });
 await test('本人双标签页并发修改只有一次提交，最终名字对应成功请求',async()=>{
  const inputs=[input(C,'cone'+suffix),input(C,'ctwo'+suffix)],responses=await Promise.all(inputs.map(p=>auth(p,C))),winner=responses.findIndex(r=>r.status===200);assert.ok(winner>=0);assert.equal(responses.filter(r=>r.status===200).length,1);assert.ok([401,409].includes(responses[1-winner].status));assert.equal(commits(inputs).length,1);assert.equal(credential(C).username,inputs[winner].newUsername);await revoked(C);await refreshName(C);races.self={statuses:responses.map(r=>r.status),successfulCommits:1};
 });
 await test('群主本人不限次数修改，固定内部ID和最高权限保持',async()=>{
  for(let i=0;i<2;i++){const response=await auth(input(owner,'ownerrenamed'+i+suffix),owner);assert.equal(response.status,200);assert.equal(response.data.signedOut,true);assert.equal(credential(owner).usernameChangedAt,null);await revoked(owner);await refreshName(owner);const state=(await get(owner)).data;assert.equal(state.me.id,owner.id);assert.equal(state.me.isOwner,true);assert.equal(state.me.role,'admin');assert.equal(state.auth.canChangeUsername,true)}
 });
 await test('旧登录名验证与代改并发后，没有可用旧登录名令牌',async()=>{
  const old=credential(B),rename=input(owner,'bnew'+suffix,{accountId:B.id}),responses=await Promise.all([...Array.from({length:3},()=>auth({action:'login',username:B.username,password:B.password})),auth(rename,owner)]);assert.equal(responses[3].status,200);let issued=0;
  for(const response of responses.slice(0,3)){assert.ok([200,401].includes(response.status));if(response.status===200){issued++;assert.equal((await get({cookie:pair(response)})).status,401)}}
  assert.equal(credential(B).usernameChangedAt,null);await refreshName(B);const token=randomBytes(32).toString('base64url'),tokenId=createHash('sha256').update(token).digest('hex');
  const inserted=sql(`INSERT INTO auth_sessions(id,user_id,expires) SELECT ${quote(tokenId)},${quote(B.id)},${Date.now()+60000} FROM password_credentials WHERE id=${quote(B.id)} AND username=${quote(old.username)} AND salt=${quote(old.salt)} AND hash=${quote(old.hash)} RETURNING id`);assert.equal(inserted.length,0);assert.equal((await get({cookie:'yulin_session='+token})).status,401);races.oldLogin={issuedBeforeChange:issued,usableOldSessions:0,staleInsertRows:0};
 });
 await test('群主改密并发时，代改不能用旧群主凭据在改密后提交',async()=>{
  const oldPassword=owner.password,next=password(),rename=input(owner,'actorpw'+suffix,{accountId:B.id}),change={action:'changePassword',currentPassword:oldPassword,newPassword:next,confirmPassword:next,requestId:randomUUID()},responses=await Promise.all([auth(rename,owner),auth(change,owner)]);assert.equal(responses[1].status,200);assert.ok([200,401,409].includes(responses[0].status));const rows=commits([rename,change]);
  if(responses[0].status===200){assert.equal(rows.length,2);assert.ok(rows[0].key.endsWith(':'+rename.requestId),'Delegation must commit before owner password change')}else assert.ok(rows.every(row=>!row.key.endsWith(':'+rename.requestId)));
  owner.password=next;await revoked(owner);await refreshName(owner);await refreshName(B);assert.equal(credential(B).usernameChangedAt,null);races.actorPassword={renameStatus:responses[0].status,passwordStatus:200,staleActorCommit:false};
 });
 await test('已撤销群主会话和错用目标密码不能授权代改',async()=>{
  const targetBefore=credential(B);assert.equal((await auth(input(owner,'notallowed'+suffix,{accountId:B.id,currentPassword:B.password}),owner)).status,401);
  const cookie=owner.cookie;assert.equal((await auth({action:'logout'},owner)).status,200);assert.equal((await auth(input(owner,'notallowed'+suffix,{accountId:B.id}),{cookie},ownerHeaders)).status,401);const after=credential(B);assert.ok(after.username===targetBefore.username&&after.hash===targetBefore.hash&&after.usernameChangedAt===targetBefore.usernameChangedAt);await login(owner);
 });
 await test('群主代改未使用机会的成员后，该成员仍有一次自主机会',async()=>{
  assert.equal(credential(B).usernameChangedAt,null);await login(B);const response=await auth(input(B,'bself'+suffix),B);assert.equal(response.status,200);await revoked(B);await refreshName(B);const used=credential(B).usernameChangedAt;assert.ok(Number.isInteger(used));assert.equal((await auth(input(owner,'bafter'+suffix,{accountId:B.id}),owner)).status,200);assert.equal(credential(B).usernameChangedAt,used);await refreshName(B);assert.equal((await auth(input(B,'again'+suffix),B)).status,409);
 });
 await test('账号修改不改昵称角色历史，审计无密码或摘要，身份标志准确',async()=>{
  const state=(await get(owner)).data;assert.ok(JSON.stringify(state.matches)===historyBefore);assert.ok(JSON.stringify({accounts:state.accounts.map(({isOwner,canModify,...a})=>a),players:state.players})===recordsBefore,'Internal accounts, names and player history must stay unchanged');
  const audit=JSON.stringify(state.audits);for(const secret of secrets)assert.ok(!audit.includes(secret));assert.ok(!/"(?:currentPassword|salt|hash)"\s*:/.test(audit));assert.ok(state.audits.some(a=>a.action==='changeLoginUsername'));assert.equal(state.me.isOwner,true);assert.equal((await get(A,'/api/auth')).data.isOwner,false);assert.equal((await get(A,'/api/auth')).data.canChangeUsername,false);
 });
}catch(error){const message=String(error?.message??'Unknown failure'),safe=secrets.some(secret=>message.includes(secret))?'Sensitive failure details suppressed':message;results.push({name:currentTest,status:'failed',error:safe});process.exitCode=1;console.error('FAIL '+currentTest+': '+safe)}
finally{const report={at:new Date().toISOString(),origin,persist,scope:'Fresh isolated local Worker; one fictional owner and five fictional members; passwords/tokens/credential snapshots never logged',passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,races,results};mkdirSync('.test-output',{recursive:true});writeFileSync('.test-output/change-username-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));}
