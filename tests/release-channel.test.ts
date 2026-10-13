import test from 'node:test';
import assert from 'node:assert/strict';
import {activeVersionIds,readActiveReleaseChannels,validateReleaseChannel} from '../scripts/lib/release-channel.mjs';
import {deployCloudflare} from '../scripts/lib/cloudflare-deployment.mjs';
const source={name:'fixture',d1_databases:[{binding:'DB',database_id:'11111111-1111-4111-8111-111111111111'}]};
const built={...source,vars:{YULIN_HOSTING_PROVIDER:'cloudflare'}};
test('a shared build cannot replace any active private traffic version',async()=>{
 let writes=0;
 await assert.rejects(()=>deployCloudflare({root:'/fixture',source,built,readChannels:async()=>[undefined,'private'],run:async()=>{writes++}}),/controlled private checkout/);
 assert.equal(writes,0);
 assert.doesNotThrow(()=>validateReleaseChannel(source,built,[]));
 const privateSource={...source,vars:{YULIN_RELEASE_CHANNEL:'private'}},privateBuild={...built,vars:{...built.vars,YULIN_RELEASE_CHANNEL:'private'}};
 assert.doesNotThrow(()=>validateReleaseChannel(privateSource,privateBuild,['private']));
 assert.throws(()=>validateReleaseChannel(privateSource,built,[]),/channels differ/);
});
test('unavailable production metadata prevents migrations and publish',async()=>{
 let writes=0;
 await assert.rejects(()=>deployCloudflare({root:'/fixture',source,built,readChannels:async()=>{throw Error('metadata unavailable')},run:async()=>{writes++}}),/metadata unavailable/);
 assert.equal(writes,0);
});
test('deployment order is based on timestamps and all traffic versions are inspected',()=>{
 const old={created_on:'2026-01-01T00:00:00Z',versions:[{version_id:'old',percentage:100}]};
 const latest={created_on:'2026-01-02T00:00:00Z',versions:[{version_id:'public',percentage:25},{version_id:'private',percentage:75},{version_id:'inactive',percentage:0}]};
 assert.deepEqual(activeVersionIds([latest,old]),['public','private']);
 assert.deepEqual(activeVersionIds([old,latest]),['public','private']);
 assert.deepEqual(activeVersionIds([]),[]);
 for(const bad of [{},[{created_on:'invalid',versions:[]}],[{...latest,versions:[]}],[{...latest,versions:[{version_id:'x',percentage:0}]}]])assert.throws(()=>activeVersionIds(bad));
});
test('real command orchestration reads private markers without changing production',async()=>{
 const calls:string[][]=[];
 const channels=await readActiveReleaseChannels({root:'/fixture',source,capture:async(args:string[])=>{
  calls.push(args);
  return JSON.stringify(args.includes('list')?[{created_on:'2026-01-01T00:00:00Z',versions:[{version_id:'live',percentage:100}]}]:{resources:{bindings:[{name:'YULIN_RELEASE_CHANNEL',type:'plain_text',text:'private'}]}});
 }});
 assert.deepEqual(channels,['private']);assert.equal(calls.length,2);assert.ok(calls.every(c=>c.includes('--json')&&!c.includes('deploy')));
 await assert.rejects(()=>readActiveReleaseChannels({root:'/fixture',source,capture:async(args:string[])=>JSON.stringify(args.includes('list')?[{created_on:'2026-01-01T00:00:00Z',versions:[{version_id:'x',percentage:100}]}]:{})}),/bindings/);
});
