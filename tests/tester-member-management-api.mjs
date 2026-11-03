// Actual account and club routes on isolated transactional SQLite; fictional club only.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
import {seedAccountNoticeFixture} from './helpers/account-notice.mjs';

mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__testerMembersTest={env:{},user:null};
writeFileSync('.test-output/tester-members-entry.ts',`export {POST as auth} from '../app/api/auth/route';export {GET as read,POST as command} from '../app/api/club/route';export {load,save} from '../lib/store';export {emptyState} from '../lib/domain/types';`);
await build({entryPoints:['.test-output/tester-members-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/tester-members-api.mjs',plugins:[{name:'isolated-tester-auth',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'tester-members'}));
 b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'tester-members'}));
 b.onResolve({filter:/(?:^|\/)lib\/auth$|^\.\.\/auth$|^\.\/auth$/},a=>a.importer.includes('node_modules')?undefined:({path:'auth',namespace:'tester-members'}));
 b.onLoad({filter:/.*/,namespace:'tester-members'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__testerMembersTest.env;'
  :a.path==='headers'?'export async function cookies(){return {get(){},set(){},delete(){}}}export async function headers(){return new Headers()}'
  :"export const sessionCookie='yulin_session';export async function hashToken(t){return t}export const getAppUser=async()=>globalThis.__testerMembersTest.user;export const passwordEnabled=async(id)=>!!(await globalThis.__testerMembersTest.env.DB.prepare('SELECT id FROM password_credentials WHERE id=?').bind(id).first());"}));
}}]});
const database=sqliteD1();fixture.env.DB=database.db;
const api=await import(pathToFileURL(resolve('.test-output/tester-members-api.mjs')).href);
const origin='https://club.example',password='fictional-tester-password-123';
const request=(path,body)=>new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','cf-connecting-ip':'203.0.113.91'},body:JSON.stringify(body)});
const as=id=>{fixture.user={userId:id,method:'password',displayName:'Fictional '+id}};
const auth=body=>api.auth(request('/api/auth',body));
const view=async()=>(await api.read(new Request(origin+'/api/club'))).json();
const command=async(action,payload)=>{const v=await view();return api.command(request('/api/club',{action,payload,revision:v.revision,requestId:crypto.randomUUID()}))};
try{
 const empty=api.emptyState(),s=api.emptyState(),week=7*86400000,start=Date.now()+week;
 Object.assign(s.settings,{initialized:true,ownerAccountId:'owner'});
 s.accounts=[{id:'owner',email:'',role:'admin',playerId:'p0'},{id:'admin',email:'',role:'admin',playerId:'p1'},{id:'tester',email:'',role:'member',playerId:'p2',simulationTester:true},{id:'tester2',email:'',role:'member',playerId:'p3',simulationTester:true},{id:'member',email:'',role:'member',playerId:'p4'},{id:'host',email:'',role:'member',playerId:'p5'}];
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 s.events=[{id:'event',creatorId:'owner',title:'Fictional event',start,end:start+7200000,venue:'Fictional venue',address:'',capacity:8,signupDeadline:start,cancelDeadline:start-86400000,status:'open',note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'}];
 // One friend signed up twice for the event (before duplicates were refused), and another friend once.
 for(const [i,name] of ['aq','AQ 2','bo'].entries()){
  s.players.push({id:'guest-'+i,name,ownerId:'host',guestEventId:'event',guestGender:'female',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
  s.registrations.push({id:'reg-'+i,eventId:'event',playerId:'guest-'+i,sequence:i+1,status:'confirmed',arrival:start,departure:start+7200000,registeredAt:start-week,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 await seedAccountNoticeFixture(s);await api.save(s,'seed',empty);
 const login=async(id,username)=>{as('owner');const r=await auth({action:'createAccount',accountId:id,name:'x',username,password,requestId:crypto.randomUUID()});assert.equal(r.status,200,await r.clone().text())};
 for(const [id,username] of [['admin','fadmin'],['tester','ftester'],['tester2','ftester2'],['member','fmember']])await login(id,username);

 // What a tester sees: every account, with only ordinary members manageable, and only those login names.
 as('tester');let v=await view();
 assert.deepEqual(Object.fromEntries(v.accounts.map(a=>[a.id,a.canModify])),{owner:false,admin:false,tester:false,tester2:false,member:true,host:true});
 assert.deepEqual(v.loginAccounts.map(c=>c.username).sort(),['fmember','ftester'],'login names of manageable accounts and their own');
 as('member');v=await view();assert.deepEqual(v.accounts,[]);assert.deepEqual(v.loginAccounts,[],'as before: an ordinary member receives no login list');

 // Accounts: a tester creates members and resets ordinary members' passwords, never an administrator's or another tester's.
 as('tester');
 const created=await auth({action:'createAccount',name:'Fictional newcomer',username:'fnew',password,requestId:crypto.randomUUID()});assert.equal(created.status,200,await created.clone().text());
 const {accountId:newId}=await created.json();assert.equal((await api.load()).accounts.find(a=>a.id===newId).role,'member','a tester creates ordinary members only');
 assert.equal((await auth({action:'resetPassword',accountId:'member',password,requestId:crypto.randomUUID()})).status,200);
 for(const target of ['owner','admin','tester2']){const r=await auth({action:'resetPassword',accountId:target,password,requestId:crypto.randomUUID()});assert.equal(r.status,403,target+': '+await r.clone().text())}
 assert.equal((await auth({action:'createAccount',accountId:'admin',name:'x',username:'ftakeover',password,requestId:crypto.randomUUID()})).status,403,'no login opened on an administrator account');
 as('member');assert.equal((await auth({action:'createAccount',name:'x',username:'fnope',password,requestId:crypto.randomUUID()})).status,403,'an ordinary member manages no accounts');
 const audit=(await api.load()).audits.find(a=>a.action==='resetAccountPassword'&&a.actor==='tester');assert.equal(audit.reason,'测试员重置登录密码');

 // Friends: a tester merges, edits and hides friends, and cancels a duplicate signup; an ordinary member cannot.
 as('member');assert.equal((await command('guestFriendHide',{playerId:'guest-2',hidden:true})).status,403);
 assert.equal((await command('cancel',{eventId:'event',playerId:'guest-1',reason:'x'})).status,403,'a member cancels no one else’s friend');
 as('tester');
 assert.equal((await command('cancel',{eventId:'event',playerId:'guest-2',reason:'x'})).status,403,'a friend signed up once is not a duplicate');
 assert.equal((await command('cancel',{eventId:'event',playerId:'guest-0',reason:'x'})).status,403,'the first signup is the one kept');
 const cancel=await command('cancel',{eventId:'event',playerId:'guest-1',reason:'取消同场重复的临时来宾接龙'});assert.equal(cancel.status,200,await cancel.clone().text());
 assert.equal((await api.load()).registrations.find(r=>r.playerId==='guest-1').status,'cancelled');
 assert.equal((await command('guestFriendMerge',{playerIds:['guest-0','guest-1'],name:'aq',hostPlayerId:'p5'})).status,200);
 assert.equal((await command('guestFriendEdit',{playerId:'guest-2',name:'Bo',gender:'male',level:1150})).status,200);
 assert.equal((await command('guestFriendHide',{playerId:'guest-2',hidden:true})).status,200);
 const after=await api.load();assert.equal(after.players.find(p=>p.id==='guest-2').guestHidden,true);assert.equal(after.players.find(p=>p.id==='guest-0').guestFriendId,after.players.find(p=>p.id==='guest-1').guestFriendId);
 // Nothing else of the admin page: roles and club settings stay administrator-only.
 assert.equal((await command('role',{accountId:'member',role:'admin',reason:'x'})).status,403);
 console.log('PASS tester member management API: accounts list and login names, member accounts only, friends merge/edit/hide, duplicate cancel, nothing else');
}finally{database.close?.()}
