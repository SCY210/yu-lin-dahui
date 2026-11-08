import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
mkdirSync('.test-output',{recursive:true});
const modules={
 auth:'export const getAppUser=async()=>globalThis.__auditTest.user;',
 store:`export const raw=()=>{throw new Error('unexpected database access')};
 export const clubReadVersion=async()=>{const t=globalThis.__auditTest;t.metadata++;return {settings:t.state.settings,account:t.account}};
 export const loadWithRestore=async options=>{const t=globalThis.__auditTest;t.loads++;if(t.fail)throw new Error('private database details');if(!options.incremental)throw new Error('incremental required');return {state:structuredClone(t.state)}};`,
};
await build({stdin:{contents:"export {GET} from './app/api/audits/route'; export {emptyState} from './lib/domain/types';",resolveDir:process.cwd(),sourcefile:'audit-api-entry.ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-output/audit-api.mjs',plugins:[{name:'isolated-audit-api',setup(builder){
 builder.onResolve({filter:/(?:^|\/)(auth|store)$/},args=>({path:args.path.split('/').at(-1),namespace:'audit-test'}));
 builder.onLoad({filter:/.*/,namespace:'audit-test'},args=>({contents:modules[args.path],loader:'js'}));
}}]});
const {GET,emptyState}=await import(pathToFileURL(resolve('.test-output/audit-api.mjs')).href);
const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
const owner={id:'owner',role:'admin',playerId:'p1',email:''};s.accounts=[owner];
const now=Date.now();s.audits=Array.from({length:80},(_,i)=>({id:'audit-'+String(i).padStart(3,'0'),at:now-i*1000,actor:owner.id,action:'fixture',reason:'测试日志'}));
s.audits.push({...s.audits[0],id:'old',at:now-8*86400000});
const t=globalThis.__auditTest={user:null,state:s,account:owner,metadata:0,loads:0};
const read=cursor=>GET(new Request('https://example.invalid/api/audits'+(cursor?'?'+new URLSearchParams({cursor}):'')));
try{
 assert.equal((await read()).status,401);assert.equal(t.metadata,0);assert.equal(t.loads,0);
 t.user={userId:'owner'};t.account={...owner,role:'member'};
 assert.equal((await read()).status,403);assert.equal(t.loads,0,'ordinary members do not load history');
 t.account=owner;
 const response=await read();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const first=await response.json();assert.equal(first.audits.length,50);assert.ok(first.nextCursor);assert.equal(first.accountId,owner.id);
 const second=await (await read(first.nextCursor)).json();assert.equal(second.audits.length,30);assert.equal(second.nextCursor,null);
 assert.equal(new Set([...first.audits,...second.audits].map(a=>a.id)).size,80);assert.ok(!second.audits.some(a=>a.id==='old'));
 assert.equal((await read('{')).status,400);
 s.accounts=[{...owner,role:'member'}];assert.equal((await read()).status,403,'metadata permission is rechecked in the loaded snapshot');
 s.accounts=[];assert.equal((await read()).status,403);
 s.accounts=[owner];t.fail=true;const failed=await read();assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('private database details'));
 console.log('PASS weekly audit API: authenticated admin only, fresh role checks, incremental read-only pages, seven-day range, stable pagination, no-store and safe errors');
}finally{delete globalThis.__auditTest}
