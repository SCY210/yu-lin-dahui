import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';

// Empty, isolated loopback Worker database only. Never run against a hosted Site.
const origin=process.env.OWNERSHIP_TEST_ORIGIN??'http://127.0.0.1:8787';
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
const suffix=randomUUID().slice(0,8),owner={id:'fictional-owner-'+suffix},results=[];
const password=()=>randomBytes(24).toString('base64url');
const headers=actor=>actor?.cookie?{Cookie:actor.cookie}:actor?.id?{'oai-authenticated-user-id':actor.id,'oai-authenticated-user-email':actor.id+'@example.invalid'}:{};
async function request(actor,path,body){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{...headers(actor),...(body?{Origin:origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=null}return {status:r.status,data,headers:r.headers}}
const get=async actor=>{const r=await request(actor,'/api/club');assert.equal(r.status,200);return r.data};
async function command(actor,action,payload){const v=await get(actor);return request(actor,'/api/club',{action,payload,revision:v.revision,requestId:randomUUID()})}
const auth=(actor,payload)=>request(actor,'/api/auth',payload);
const cookie=r=>r.headers.getSetCookie().find(c=>c.startsWith('yulin_session=')).split(';')[0];
async function test(name,fn){await fn();results.push(name);console.log('PASS '+name)}
const initial=await get(owner);assert.equal(initial.setup,true,'A dedicated empty local database is required');
assert.equal((await command(owner,'initialize',{name:'虚构群主验收',invite:'fictional-invite-for-owner-tests'})).status,200);
const ownView=await get(owner);owner.playerId=ownView.me.playerId;owner.username='owner'+suffix;owner.password=password();
assert.equal((await auth(owner,{action:'bind',username:owner.username,password:owner.password})).status,200);
const ownerLogin=await auth(null,{action:'login',username:owner.username,password:owner.password});assert.equal(ownerLogin.status,200);owner.cookie=cookie(ownerLogin);
async function member(label){const username='ownertest'+(label==='甲'?'a':'b')+suffix,pw=password();const r=await auth(owner,{action:'createAccount',name:'虚构权限球友'+label,username,password:pw,requestId:randomUUID()});assert.equal(r.status,200);const logged=await auth(null,{action:'login',username,password:pw});assert.equal(logged.status,200);const a={id:r.data.accountId,cookie:cookie(logged),username,password:pw};a.playerId=(await get(a)).me.playerId;return a}
const admin=await member('甲'),other=await member('乙');assert.equal((await command(owner,'role',{accountId:admin.id,role:'admin',reason:'虚构群主授权'})).status,200);
const baseline=await get(owner),ownerPlayer=baseline.players.find(p=>p.id===owner.playerId);
const profile={playerId:owner.playerId,years:4,hand:'left',preference:'doubles',style:'越权资料',equipment:'越权备注',racket:'越权战拍',strings:'越权拍线',tensionMin:24,tensionMax:28};
await test('初始化账号立即拥有唯一群主最高权限，普通管理员不能管理角色',async()=>{
 const ov=await get(owner),av=await get(admin);assert.equal(ov.me.isOwner,true);assert.equal(ov.permissions.canManageRoles,true);assert.equal(av.me.role,'admin');assert.equal(av.me.isOwner,false);assert.equal(av.permissions.canManageRoles,false);assert.equal(av.accounts.find(a=>a.id===owner.id).canModify,false);
 assert.equal((await command(admin,'role',{accountId:other.id,role:'admin',reason:'私自授权'})).status,403);assert.equal((await command(admin,'role',{accountId:owner.id,role:'member',reason:'降级群主'})).status,403);
});
await test('普通管理员不能修改群主名字、资料、战拍、初始实力或停用群主',async()=>{
 for(const [action,payload]of [['profile',{playerId:owner.playerId,name:'篡改群主'}],['profileDetails',profile],['rating',{playerId:owner.playerId,value:1,enabled:false,reason:'越权停用'}]])assert.equal((await command(admin,action,payload)).status,403);
 const v=await get(owner);assert.deepEqual(v.players.find(p=>p.id===owner.playerId),ownerPlayer);assert.equal(v.me.role,'admin');
});
await test('通过重置密码、账号绑定或球员绑定不能接管群主，原会话与密码仍有效',async()=>{
 assert.equal((await auth(admin,{action:'resetPassword',accountId:owner.id,password:password(),requestId:randomUUID()})).status,403);
 for(const target of [{accountId:owner.id},{playerId:owner.playerId}])assert.equal((await auth(admin,{action:'createAccount',name:'伪装',username:'takeover'+suffix,password:password(),requestId:randomUUID(),...target})).status,403);
 assert.equal((await auth(admin,{action:'createAccount',name:'伪装',username:'takeover'+suffix,password:password(),requestId:randomUUID(),accountId:other.id,playerId:owner.playerId})).status,400);
 assert.equal((await get(owner)).me.isOwner,true);assert.equal((await auth(null,{action:'login',username:owner.username,password:owner.password})).status,200);
});
async function upload(actor,kind,playerId){const form=new FormData();form.set('rightsConfirmed','true');form.set('file',new Blob([readFileSync('tests/fixtures/shuttlecock.png')],{type:'image/png'}),'fictional.png');form.set('kind',kind);form.set('playerId',playerId);form.set('requestId',randomUUID());form.set('revision',String((await get(actor)).revision));return fetch(origin+'/api/photos',{method:'POST',headers:{...headers(actor),Origin:origin},body:form})}
await test('头像与球拍上传接口阻止普通管理员替换群主照片，不留下资产或审计变化',async()=>{
 const before=await get(owner);for(const kind of ['avatar','racket'])assert.equal((await upload(admin,kind,owner.playerId)).status,403);const after=await get(owner);assert.deepEqual(after.photos,before.photos);assert.deepEqual(after.audits,before.audits);assert.equal(after.players.find(p=>p.id===owner.playerId).avatarId,before.players.find(p=>p.id===owner.playerId).avatarId);
});
await test('群主本人仍可以修改资料与上传头像、球拍照片，改名后保护仍在',async()=>{
 assert.equal((await command(owner,'profile',{name:'虚构群主新昵称'})).status,200);assert.equal((await command(owner,'profileDetails',{...profile,style:'本人资料',racket:'本人战拍'})).status,200);
 assert.equal((await upload(owner,'avatar',owner.playerId)).status,200);assert.equal((await upload(owner,'racket',owner.playerId)).status,200);
 const v=await get(owner);assert.equal(v.me.isOwner,true);assert.equal(v.players.find(p=>p.id===owner.playerId).name,'虚构群主新昵称');assert.equal((await command(admin,'profile',{playerId:owner.playerId,name:'再次篡改'})).status,403);
});
await test('群主不能误降级自身；只有群主可以升降其他管理员',async()=>{
 assert.equal((await command(owner,'role',{accountId:owner.id,role:'member',reason:'误操作'})).status,403);
 assert.equal((await command(owner,'role',{accountId:other.id,role:'admin',reason:'群主分配'})).status,200);assert.equal((await command(owner,'role',{accountId:other.id,role:'member',reason:'群主收回'})).status,200);
 assert.equal((await get(owner)).me.role,'admin');
});
await test('普通管理员仍可帮助普通成员改资料或密码，无法把settings伪造成群主转移',async()=>{
 assert.equal((await command(admin,'profileDetails',{...profile,playerId:other.playerId})).status,200);
 const next=password();assert.equal((await auth(admin,{action:'resetPassword',accountId:other.id,password:next,requestId:randomUUID()})).status,200);const login=await auth(null,{action:'login',username:other.username,password:next});assert.equal(login.status,200);other.cookie=cookie(login);
 const v=await get(admin);assert.equal((await command(admin,'settings',{name:v.settings.name,invite:'',rules:v.settings.rules,ownerAccountId:admin.id})).status,200);assert.equal((await get(owner)).me.isOwner,true);assert.equal((await get(admin)).me.isOwner,false);
});
await test('并发的群主改名与其他管理员改名仅允许本人保存，owner标识不变',async()=>{
 const [allowed,blocked]=await Promise.all([command(owner,'profile',{name:'虚构群主 · 本地验收'}),command(admin,'profile',{playerId:owner.playerId,name:'并发篡改'})]);assert.equal(allowed.status,200);assert.equal(blocked.status,403);const v=await get(owner);assert.equal(v.players.find(p=>p.id===owner.playerId).name,'虚构群主 · 本地验收');assert.equal(v.me.isOwner,true);
});
mkdirSync('.test-output',{recursive:true});writeFileSync('.test-output/ownership-api-report.json',JSON.stringify({passed:results.length,results,scope:'isolated loopback fictional accounts; no production passwords modified'},null,2));console.log(JSON.stringify({passed:results.length}));
