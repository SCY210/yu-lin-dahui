import test from 'node:test';
import assert from 'node:assert/strict';
import {deployCloudflare,schemaDeploymentMessage,validateCloudflareBuild} from '../scripts/lib/cloudflare-deployment.mjs';
const database='11111111-1111-4111-8111-111111111111';
const source={name:'fixture',d1_databases:[{binding:'DB',database_id:database}]};
const built={...source,vars:{YULIN_HOSTING_PROVIDER:'cloudflare'}};
test('remote migrations finish before the Worker publish command',async()=>{
 const commands:string[][]=[];
 await deployCloudflare({root:'/fixture',source,built,run:async(args:string[])=>{commands.push(args)}});
 assert.equal(commands.length,3);
 assert.ok(commands[0][0].endsWith('check-migrations.mjs'));
 assert.ok(commands[1].includes('migrations')&&commands[1].includes('apply')&&commands[1].includes('--remote'));
 assert.ok(commands[1].at(-1)!.endsWith('wrangler.cloudflare.json'));
 assert.ok(commands[2].includes('deploy')&&commands[2].includes(schemaDeploymentMessage));
 assert.ok(commands[2][commands[2].indexOf('--config')+1].endsWith('wrangler.json'));
});
test('migration or history failure prevents all later remote operations',async()=>{
 for(const failure of [0,1]){
  let calls=0;
  await assert.rejects(deployCloudflare({root:'/fixture',source,built,run:async()=>{if(calls++===failure)throw new Error('injected failure')}}),/injected failure/);
  assert.equal(calls,failure+1);
 }
});
test('wrong target, placeholder D1 and binding drift are rejected before remote writes',async()=>{
 const invalid=[
  {source,built:{...built,vars:{}}},
  {source,built:{...built,name:'another-worker'}},
  {source,built:{...built,d1_databases:[{binding:'DB',database_id:'another-database'}]}},
  {source:{...source,d1_databases:[{binding:'DB',database_id:'00000000-0000-4000-8000-000000000000'}]},built},
 ];
 for(const config of invalid){let calls=0;await assert.rejects(deployCloudflare({root:'/fixture',...config,run:async()=>{calls++}}));assert.equal(calls,0)}
 assert.doesNotThrow(()=>validateCloudflareBuild(source,built));
});
