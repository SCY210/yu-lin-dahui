// Read-only handler regression tests with isolated fake auth / persistence.
// No preview, real database, migrations, or database resets are involved.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';

mkdirSync('.test-output',{recursive:true});
const output='.test-output/club-read-route.mjs';
const modules={
 auth:'export const getAppUser=async()=>globalThis.__clubReadTest.user; export const passwordEnabled=async()=>false;',
 store:`export const raw=()=>({prepare:()=>({bind(){return this},async all(){return {results:[]}},async first(){return null}})});
  export const clubReadVersion=async()=>{const t=globalThis.__clubReadTest;t.metadata++;const s=t.state;return {revision:s.revision,settings:s.settings,account:s.accounts.find(a=>a.id===t.user.userId)??null}};
  export const load=async()=>structuredClone(globalThis.__clubReadTest.state);export const save=async()=>{};export const committed=async()=>false;`,
 maintenance:'export const loadClubState=async()=>{const t=globalThis.__clubReadTest;t.loads++;return structuredClone(t.state)};',
};
await build({entryPoints:['./app/api/club/route.ts'],bundle:true,platform:'node',format:'esm',outfile:output,plugins:[{
 name:'isolated-club-read',setup(builder){
  builder.onResolve({filter:/(?:^|\/)(auth|store|club-maintenance)$/},args=>({path:args.path.endsWith('club-maintenance')?'maintenance':args.path.split('/').at(-1),namespace:'club-test'}));
  builder.onLoad({filter:/.*/,namespace:'club-test'},args=>({contents:modules[args.path],loader:'js'}));
 },
}]});
const {GET}=await import(pathToFileURL(resolve(output)).href);
const account={id:'fixture-admin',email:'',role:'admin',playerId:'fixture-player'};
const user={userId:account.id,email:'',username:'fixture',displayName:'fixture',fullName:null,method:'password'};
const state={revision:10,settings:{name:'虚构测试群',initialized:true,ownerAccountId:account.id,inviteHash:'',rules:{win:3,loss:0,minimum:0,cap:12,target:21,ceiling:30,lead:2,k:32,algorithm:'doubles-elo-v1'}},accounts:[account],players:[],events:[],bookings:[],registrations:[],attendance:[],rounds:[],matches:[],costs:[],settlements:[],payments:[],seasons:[],audits:[],ratingChanges:[],challenges:[],tagVotes:[],awardVotes:[],photos:[]};
const fixture=globalThis.__clubReadTest={user,state,loads:0,metadata:0};
const read=(path='/api/club?month=2026-10&year=2026',etag=null)=>GET(new Request('https://example.invalid'+path,{headers:etag?{'If-None-Match':etag}:{}}));
try{
 const initial=await read();assert.equal(initial.status,200);const token=initial.headers.get('ETag');assert.ok(token);assert.equal((await initial.json()).me.role,'admin');assert.equal(fixture.loads,1);
 const unchanged=await read(undefined,token);assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');assert.equal(fixture.loads,1);assert.equal(fixture.metadata,1);assert.equal(unchanged.headers.get('Cache-Control'),'no-store');
 const weak=await read(undefined,'W/'+token);assert.equal(weak.status,304);assert.equal(weak.headers.get('ETag'),token);assert.equal(fixture.loads,1);
 const list=await read(undefined,'\"unrelated\", W/'+token);assert.equal(list.status,304);assert.equal(list.headers.get('ETag'),token);assert.equal(fixture.loads,1);
 const changedMonth=await read('/api/club?month=2026-09&year=2026',token);assert.equal(changedMonth.status,200);assert.equal((await changedMonth.json()).period,'2026-09');
 state.revision++;const changed=await read(undefined,token);assert.equal(changed.status,200);assert.equal((await changed.json()).revision,11);
 state.settings.name='Fixture View';state.settings.blockedWords=['Fixture'];state.revision++;
 const filteredResponse=await read(undefined,changed.headers.get('ETag'));assert.equal(filteredResponse.status,200);const filtered=await filteredResponse.json();assert.equal(filtered.settings.name,'******* View');assert.deepEqual(filtered.settings.blockedWords,['Fixture']);assert.equal(filtered.me.id,account.id);
 state.settings.blockedWords=[];state.revision++;
 const latest=changed.headers.get('ETag');state.accounts[0]={...account,role:'member'};state.audits=[{id:'hidden',at:1,actor:account.id,action:'fixture',reason:'private'}];
 const downgraded=await read(undefined,latest);assert.equal(downgraded.status,200);const member=await downgraded.json();assert.equal(member.me.role,'member');assert.deepEqual(member.audits,[]);assert.deepEqual(member.accounts,[]);
 const memberToken=downgraded.headers.get('ETag');state.accounts=[];assert.equal((await read(undefined,memberToken)).status,403);
 fixture.user=null;const priorLoads=fixture.loads,priorMetadata=fixture.metadata;assert.equal((await read(undefined,token)).status,401);assert.equal(fixture.loads,priorLoads);assert.equal(fixture.metadata,priorMetadata);
 fixture.user={...user,userId:'different-account'};assert.equal((await read(undefined,token)).status,403);
 fixture.user=user;state.accounts=[account];
 const beforeExport=fixture.loads;const exported=await read('/api/club?export=1',token);assert.equal(exported.status,200);assert.match(exported.headers.get('Content-Disposition'),/club-export/);assert.equal(fixture.loads,beforeExport+1);
 state.events=[{id:'hidden-event',creatorId:account.id,title:'Private deleted activity',deletedAt:0,status:'ended',start:1,end:2}];state.bookings=[{id:'hidden-booking',eventId:'hidden-event'}];state.audits=[{id:'hidden-audit',changes:{eventId:'hidden-event'},reason:'removed'}];
 const otherAdmin={...account,id:'other-admin'};state.accounts.push(otherAdmin);fixture.user={...user,userId:otherAdmin.id};
 const filteredExport=await (await read('/api/club?export=1')).json();assert.deepEqual(filteredExport.events,[]);assert.deepEqual(filteredExport.bookings,[]);assert.deepEqual(filteredExport.audits,[]);
 fixture.user=user;const ownerExport=await (await read('/api/club?export=1')).json();assert.equal(ownerExport.events[0].id,'hidden-event');assert.equal(state.events.length,1);state.events=[];state.bookings=[];state.audits=[];
 assert.equal((await read('/api/club?month=2026-13',token)).status,400);
 state.settings.initialized=false;const setup=await read(undefined,token);assert.equal(setup.status,200);assert.equal((await setup.json()).setup,true);assert.equal(setup.headers.get('ETag'),null);
 console.log('PASS conditional GET: full read avoided, revision/query/role/user invalidation, no-store, 401/403, fresh export, setup and invalid input');
}finally{delete globalThis.__clubReadTest}
