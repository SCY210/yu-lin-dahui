// Real authentication, handlers and transactional SQLite; fictional accounts only.
// No automatic confirmation fixture: this suite starts with no receipts.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';

mkdirSync('.test-output',{recursive:true});
const database=sqliteD1();
const fixture=globalThis.__accountNoticeTest={env:{DB:database.db},context:new AsyncLocalStorage()};
async function bundle(name,future=false){
 await build({stdin:{contents:`export {GET as read,POST as command} from './app/api/club/route';export {GET as authRead,POST as auth} from './app/api/auth/route';export {POST as upload} from './app/api/photos/route';export {POST as removePhoto} from './app/api/photos/[id]/route';export {POST as simulation} from './app/api/simulation/route';export {POST as trialCleanup} from './app/api/trial-cleanup/route';export {load,save} from './lib/store';export {emptyState} from './lib/domain/types';export {makePassword} from './lib/password';export {noticeContent,accountNoticeView} from './lib/domain/notice-gate';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-output/'+name+'.mjs',plugins:[{name:'isolated-account-notice',setup(b){
  b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'account-notice'}));
  b.onResolve({filter:/^next\/headers$/},()=>({path:'cookies',namespace:'account-notice'}));
  b.onResolve({filter:/(?:^|\/)chatgpt-auth$/},()=>({path:'chatgpt',namespace:'account-notice'}));
  b.onLoad({filter:/.*/,namespace:'account-notice'},({path})=>({loader:'js',contents:path==='env'?'export const env=globalThis.__accountNoticeTest.env;':path==='cookies'?'export async function cookies(){const header=globalThis.__accountNoticeTest.context.getStore()??"";const snapshot=new Map(header.split(";").filter(Boolean).map(pair=>{const i=pair.indexOf("=");return [pair.slice(0,i).trim(),pair.slice(i+1)]}));return {get:key=>snapshot.has(key)?{value:snapshot.get(key)}:undefined}}':'export const getChatGPTUser=async()=>null;'}));
  if(future)b.onLoad({filter:/[\\/]lib[\\/]activity-notice\.ts$/},({path})=>({loader:'ts',contents:(future===true?readFileSync(path,'utf8').replace(/(activityNoticeVersion\s*=\s*)['"][^'"]+['"]/,"$1'fictional-future-v2'"):readFileSync(path,'utf8')).replace(/(activityNoticeSummary\s*=\s*)['"][^'"]+['"]/,"$1'Fictional future notice text for isolated version regression'")}));
 }}]});
 return import(pathToFileURL(resolve('.test-output/'+name+'.mjs')).href);
}
const api=await bundle('account-notice-api');
const origin='https://club.example',password='fictional-notice-password-123';
const request=(path,body,cookie='',requestOrigin=origin)=>new Request(origin+path,{method:'POST',headers:{origin:requestOrigin,'content-type':'application/json',cookie,'cf-connecting-ip':'203.0.113.73'},body:JSON.stringify(body)});
const run=(cookie,fn)=>fixture.context.run(cookie,fn);
const auth=(body,cookie='',module=api)=>run(cookie,()=>module.auth(request('/api/auth',body,cookie)));
async function login(id,module=api,accountPassword=password){const r=await auth({action:'login',username:id,password:accountPassword},'',module);assert.equal(r.status,200,await r.clone().text());return r.headers.getSetCookie().find(c=>c.startsWith('yulin_session=')).split(';')[0]}
const read=(cookie,query='',module=api)=>run(cookie,()=>module.read(new Request(origin+'/api/club'+query)));
const post=async(cookie,action,payload,{requestId=crypto.randomUUID(),revision,module=api,actor,requestOrigin=origin}={})=>run(cookie,()=>module.command(request('/api/club',{action,payload,requestId,revision,actor},cookie,requestOrigin)));
const payload=content=>({noticeAccepted:true,noticeVersion:content.version,noticeHash:content.contentHash});
const count=()=>database.sql.prepare('SELECT COUNT(*) AS n FROM accountNoticeReceipts').get().n;
async function rejectUnchanged(cookie,input,status,options){const before=await api.load(),r=await post(cookie,'acknowledgeActivityNotice',input,options);assert.equal(r.status,status,await r.clone().text());assert.deepEqual(await api.load(),before)}
try{
 const s=api.emptyState();Object.assign(s.settings,{initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=['owner','admin','member','other','rollback'].map((id,i)=>({id,email:'',role:i<2?'admin':'member',playerId:'p'+i}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 const start=Math.ceil((Date.now()+3*86400000)/1800000)*1800000,end=start+7200000;
 s.events=[{id:'old-event',creatorId:'owner',title:'Fictional historical signup',start,end,venue:'Fixture',address:'',capacity:6,signupDeadline:start-7200000,cancelDeadline:start-86400000,status:'open',note:'',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'}];
 s.registrations=[{id:'old-registration',eventId:'old-event',playerId:'p2',sequence:1,status:'confirmed',arrival:start,departure:end,note:'Historical fixture; no previous confirmation',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}];
 const oldRegistration=structuredClone(s.registrations);
 const extra=s.accounts.map(a=>{const c=api.makePassword(password);return database.db.prepare('INSERT INTO password_credentials(id,username,salt,hash,created) VALUES(?,?,?,?,?)').bind(a.id,a.id,c.salt,c.hash,1)});
 await api.save(s,'fictional-seed',api.emptyState(),extra);
 let storageWrites=0;fixture.env.BUCKET={async put(){storageWrites++},async delete(){storageWrites++}};
 const current=await api.noticeContent();assert.match(current.contentHash,/^[a-f0-9]{64}$/);assert.equal(createHash('sha256').update(current.contentSnapshot).digest('hex'),current.contentHash);
 assert.equal((await post('','acknowledgeActivityNotice',payload(current))).status,401);
 assert.equal((await read('','?noticeExport=all')).status,401);
 const cookies=Object.fromEntries(await Promise.all(s.accounts.map(async a=>[a.id,await login(a.id)])));
 for(const id of ['owner','admin','member']){
  const response=await read(cookies[id]);assert.equal(response.status,200);const view=await response.json();assert.equal(view.accountNotice.required,true);assert.deepEqual(view.accountNotice.receipts,[]);
  const blocked=await post(cookies[id],'profile',{playerId:s.accounts.find(a=>a.id===id).playerId,name:'Should be blocked'},{revision:(await api.load()).revision});assert.equal(blocked.status,428,await blocked.clone().text());assert.equal((await blocked.json()).noticeRequired,true);
 }
 const ownerBefore=cookies.owner,gateBefore=await api.load();
 const simulationDenied=await run(ownerBefore,()=>api.simulation(request('/api/simulation',{action:'initialize',payload:{},requestId:crypto.randomUUID()},ownerBefore)));assert.equal(simulationDenied.status,428);
 const cleanupDenied=await run(ownerBefore,()=>api.trialCleanup(request('/api/trial-cleanup',{action:'remove',requestId:crypto.randomUUID(),revision:gateBefore.revision},ownerBefore)));assert.equal(cleanupDenied.status,428);
 const deleteDenied=await run(cookies.member,()=>api.removePhoto(request('/api/photos/fixture',{action:'delete',requestId:crypto.randomUUID(),revision:gateBefore.revision},cookies.member),{params:Promise.resolve({id:'fixture'})}));assert.equal(deleteDenied.status,428);
 const form=new FormData();form.set('requestId',crypto.randomUUID());form.set('revision',String(gateBefore.revision));form.set('kind','avatar');form.set('playerId','p2');form.set('rightsConfirmed','true');form.set('file',new Blob([readFileSync('tests/fixtures/shuttlecock.png')],{type:'image/png'}),'fictional.png');const uploadDenied=await run(cookies.member,()=>api.upload(new Request(origin+'/api/photos',{method:'POST',headers:{origin,cookie:cookies.member},body:form})));assert.equal(uploadDenied.status,428);assert.equal(storageWrites,0);assert.deepEqual(await api.load(),gateBefore);
 for(const body of [{action:'createAccount',name:'Fictional blocked account',username:'newfixture',password,requestId:crypto.randomUUID()},{action:'resetPassword',accountId:'other',password:'fictional-reset-password-123',requestId:crypto.randomUUID()},{action:'changeUsername',accountId:'other',newUsername:'renamedfixture',requestId:crypto.randomUUID()}]){const before=await api.load();assert.equal((await auth(body,cookies.owner)).status,428);assert.deepEqual(await api.load(),before)}
 const replacement='fictional-own-password-456';const ownPassword=await auth({action:'changePassword',currentPassword:password,newPassword:replacement,confirmPassword:replacement,requestId:crypto.randomUUID()},cookies.admin);assert.equal(ownPassword.status,200);assert.equal((await ownPassword.json()).signedOut,true);cookies.admin=await login('admin',api,replacement);assert.equal((await (await read(cookies.admin)).json()).accountNotice.required,true,'password recovery never accepts the notice');
 assert.equal(count(),0);assert.deepEqual((await api.load()).registrations,oldRegistration,'reading/gating never fabricates old signup acceptance');
 const member=cookies.member;
 for(const input of [{},{...payload(current),noticeAccepted:false},{...payload(current),noticeAccepted:'true'},{noticeAccepted:true,noticeVersion:current.version},{noticeAccepted:true,noticeHash:current.contentHash}])await rejectUnchanged(member,input,400);
 for(const input of [{...payload(current),noticeVersion:'obsolete'},{...payload(current),noticeHash:'0'.repeat(64)}])await rejectUnchanged(member,input,409);
 for(const forged of [{accountId:'other'},{playerId:'p3'},{acceptedAt:0},{contentSnapshot:'forged'},{contentHash:'forged'},{method:'automatic'}])await rejectUnchanged(member,{...payload(current),...forged},400);
 await rejectUnchanged(member,payload(current),409,{actor:'other'});
 await rejectUnchanged(member,payload(current),403,{requestOrigin:'https://attacker.invalid'});
 const key=crypto.randomUUID(),beforeAt=Date.now();const accepted=await post(member,'acknowledgeActivityNotice',payload(current),{requestId:key,revision:0});assert.equal(accepted.status,200,await accepted.clone().text());
 let stored=await api.load();assert.equal(count(),1);const receipt=structuredClone(stored.accountNoticeReceipts[0]);assert.equal(receipt.accountId,'member');assert.equal(receipt.playerId,'p2');assert.equal(receipt.version,current.version);assert.equal(receipt.contentHash,current.contentHash);assert.equal(receipt.contentSnapshot,current.contentSnapshot);assert.equal(receipt.method,'explicit-account-confirmation');assert.ok(receipt.acceptedAt>=beforeAt&&receipt.acceptedAt<=Date.now());
 assert.equal((await post(member,'acknowledgeActivityNotice',payload(current),{requestId:key})).status,200);
 assert.equal((await post(member,'acknowledgeActivityNotice',payload(current))).status,200);assert.equal(count(),1);assert.deepEqual((await api.load()).accountNoticeReceipts,[receipt]);
 const ownView=await (await read(member)).json();assert.equal(ownView.accountNotice.required,false);assert.equal(ownView.accountNotice.acceptedAt,receipt.acceptedAt);assert.deepEqual(ownView.accountNotice.receipts,[receipt]);
 const ownExport=await read(member,'?noticeExport=1');assert.equal(ownExport.status,200);assert.match(ownExport.headers.get('Content-Disposition'),/attachment/);assert.deepEqual((await ownExport.json()).receipts,[receipt]);
 for(const id of ['admin','other']){
  const view=await (await read(cookies[id])).json();assert.deepEqual(view.accountNotice.receipts,[]);assert.ok(!JSON.stringify(view).includes(receipt.id),'another account never sees the private receipt');
  assert.equal((await read(cookies[id],'?noticeExport=all')).status,403);
 }
 const adminExport=await (await read(cookies.admin,'?export=1')).json();assert.ok(!JSON.stringify(adminExport).includes(receipt.id),'legacy full export cannot bypass owner-only evidence');
 const all=await read(cookies.owner,'?noticeExport=all');assert.equal(all.status,200);assert.deepEqual((await all.json()).receipts,[receipt],'owner can inspect evidence before own acceptance');
 assert.equal((await post(member,'profileGender',{playerId:'p2',gender:'other'},{revision:(await api.load()).revision})).status,200,'explicit account acceptance unlocks normal authorized writes');
 assert.deepEqual((await api.load()).registrations,oldRegistration,'account gate never backfills activity-specific confirmations');
 // Logout and fresh real-password sessions retain the durable evidence.
 assert.equal((await auth({action:'logout'},member)).status,200);assert.equal((await read(member)).status,401);cookies.member=await login('member');assert.equal((await (await read(cookies.member)).json()).accountNotice.required,false);
 // Independent request IDs and identical retry IDs both converge to one receipt.
 const revision=(await api.load()).revision;
 const races=await Promise.all(Array.from({length:3},()=>post(cookies.other,'acknowledgeActivityNotice',payload(current),{revision})));assert.ok(races.every(r=>r.status===200),await Promise.all(races.map(r=>r.clone().text())));assert.equal((await api.load()).accountNoticeReceipts.filter(r=>r.accountId==='other').length,1);
 const sameKey=crypto.randomUUID(),ownerRace=await Promise.all([post(cookies.owner,'acknowledgeActivityNotice',payload(current),{requestId:sameKey}),post(cookies.owner,'acknowledgeActivityNotice',payload(current),{requestId:sameKey})]);assert.ok(ownerRace.every(r=>r.status===200));assert.equal((await api.load()).accountNoticeReceipts.filter(r=>r.accountId==='owner').length,1);
 // Failed persistence cannot produce either a receipt or a successful replay key.
 const beforeFailure=await api.load(),failureKey=crypto.randomUUID();database.injectFailure(q=>/INSERT INTO accountNoticeReceipts/i.test(q));assert.equal((await post(cookies.rollback,'acknowledgeActivityNotice',payload(current),{requestId:failureKey})).status,503);database.injectFailure(null);assert.deepEqual(await api.load(),beforeFailure);assert.equal((await post(cookies.rollback,'acknowledgeActivityNotice',payload(current),{requestId:failureKey})).status,200);assert.equal((await api.load()).accountNoticeReceipts.filter(r=>r.accountId==='rollback').length,1);
 // SQLite rejects tampering even outside the HTTP/domain layers.
 assert.throws(()=>database.sql.prepare("UPDATE accountNoticeReceipts SET payload='{}' WHERE id=?").run(receipt.id),/immutable|append.only|read.only/i);
 assert.throws(()=>database.sql.prepare('DELETE FROM accountNoticeReceipts WHERE id=?').run(receipt.id),/immutable|append.only|read.only/i);
 // New versions and text changes never repeat the entry gate or rewrite prior acceptance.
 const future=await bundle('account-notice-future-api',true),next=await future.noticeContent();assert.notEqual(next.version,current.version);assert.notEqual(next.contentHash,current.contentHash);
 const futureView=await (await read(cookies.member,'',future)).json();assert.equal(futureView.accountNotice.required,false);assert.equal(futureView.accountNotice.currentConfirmed,false);assert.equal(futureView.accountNotice.acceptedVersion,current.version);assert.equal(futureView.accountNotice.acceptedAt,receipt.acceptedAt);assert.deepEqual(futureView.accountNotice.receipts,[receipt]);
 assert.equal((await post(cookies.member,'profileGender',{playerId:'p2',gender:'male'},{module:future,revision:(await api.load()).revision})).status,200);
 assert.equal((await post(cookies.member,'acknowledgeActivityNotice',payload(current),{module:future})).status,409);
 assert.equal((await post(cookies.member,'acknowledgeActivityNotice',payload(next),{module:future})).status,200);
 stored=await api.load();assert.deepEqual(stored.accountNoticeReceipts.find(r=>r.id===receipt.id),receipt);assert.equal(stored.accountNoticeReceipts.filter(r=>r.accountId==='member').length,2);assert.equal((await (await read(cookies.member,'',future)).json()).accountNotice.required,false);
 const changedText=await bundle('account-notice-changed-text-api','text-only'),changed=await changedText.noticeContent();assert.equal(changed.version,current.version);assert.notEqual(changed.contentHash,current.contentHash);const revisedView=(await (await read(cookies.member,'',changedText)).json()).accountNotice;assert.equal(revisedView.required,false,'same-version edits do not repeat entry confirmation');assert.equal(revisedView.currentConfirmed,false);assert.equal(count(),stored.accountNoticeReceipts.length,'reading updated text never creates a receipt');assert.equal((await post(cookies.member,'acknowledgeActivityNotice',payload(changed),{module:changedText})).status,200);assert.deepEqual((await api.load()).accountNoticeReceipts.find(r=>r.id===receipt.id),receipt);
 console.log('PASS mandatory account notice: real login/logout, explicit version/hash, server identity/time/text, private owner audit/export, no old-signup backfill, business gate, durable receipt, retries/concurrency/rollback, immutable SQLite history and one-time entry across version/text updates');
}finally{database.close();delete globalThis.__accountNoticeTest}
