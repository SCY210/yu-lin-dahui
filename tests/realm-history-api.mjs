import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
mkdirSync('.test-output',{recursive:true});
const modules={auth:'export const getAppUser=async()=>globalThis.__realmTest.user;',store:`
 export const raw=()=>{throw new Error('unexpected SQL')};
 export const clubReadVersion=async()=>{const t=globalThis.__realmTest;t.metadata++;return {settings:t.s.settings,account:t.account}};
 export const loadWithRestore=async options=>{const t=globalThis.__realmTest;t.loads++;if(!options.incremental)throw new Error('incremental required');return {state:structuredClone(t.s)}};`};
await build({stdin:{contents:"export {GET} from './app/api/realm-history/route'; export {emptyState} from './lib/domain/types'; export {clearSharedClubValues} from './lib/club-view-shared';",resolveDir:process.cwd(),sourcefile:'realm-api-entry.ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-output/realm-history-api.mjs',plugins:[{name:'isolated-realm-history',setup(builder){
 builder.onResolve({filter:/(?:^|\/)(auth|store)$/},args=>({path:args.path.split('/').at(-1),namespace:'realm-test'}));
 builder.onLoad({filter:/.*/,namespace:'realm-test'},args=>({contents:modules[args.path],loader:'js'}));
}}]});
const {GET,emptyState,clearSharedClubValues}=await import(pathToFileURL(resolve('.test-output/realm-history-api.mjs')).href);
const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='A';s.revision=999;
for(const id of ['A','B','C','D']){s.players.push({id,name:id,ownerId:id,rating:1000,initialRating:1000,ratedGames:0,enabled:true,ratingReason:''});s.accounts.push({id,playerId:id,email:'',role:id==='A'?'admin':'member'})}
const now=Date.now();s.events=[{id:'e',creatorId:'A',title:'虚构活动',start:now-3600000,end:now-60000,status:'ended'}];
s.matches=[{id:'m',eventId:'e',roundId:'r',courtId:'c',a:['A','B'],b:['C','D'],status:'complete',start:now-300000,end:now-120000,scoreA:21,scoreB:19,monthly:true,elo:true,locked:false,enteredBy:'A',games:[{a:21,b:19}]}];
const t=globalThis.__realmTest={s,user:null,account:s.accounts[1],metadata:0,loads:0};
const read=id=>GET(new Request('https://example.invalid/api/realm-history'+(id===undefined?'':'?'+new URLSearchParams({playerId:id}))));
try{
 clearSharedClubValues();assert.equal((await read('B')).status,401);assert.equal(t.loads,0);
 t.user={userId:'B'};t.account=null;assert.equal((await read('B')).status,403);assert.equal(t.loads,0);
 t.account=s.accounts[1];assert.equal((await read()).status,400);assert.equal((await read('unknown')).status,404);
 const response=await read('B');assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const own=await response.json();assert.equal(own.accountId,'B');assert.equal(own.playerId,'B');assert.equal(own.score,1016);assert.equal(own.settled[0].before,1000);assert.equal(own.settled[0].after,1016);
 const other=await (await read('C')).json();assert.equal(other.score,984,'members can read the rating details beside visible profiles');
 s.events[0].deletedAt=now;s.events[0].title='隐藏活动名称';
 const hidden=await (await read('B')).json();assert.ok(!JSON.stringify(hidden).includes('隐藏活动名称'));assert.equal(hidden.settled[0].eventId,undefined);
 s.accounts=s.accounts.filter(a=>a.id!=='B');assert.equal((await read('B')).status,403,'recheck membership in the actual loaded snapshot');
 console.log('PASS realm history API: authenticated membership, fresh snapshot permissions, own/other visible profiles, exact changes, private activity redaction and no-store');
}finally{clearSharedClubValues();delete globalThis.__realmTest}
