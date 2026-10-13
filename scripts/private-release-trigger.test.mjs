import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const workflow=readFileSync(new URL('../.github/workflows/private-release.yml',import.meta.url),'utf8').replaceAll('\r\n','\n');
const code=workflow.split("node --input-type=module <<'NODE'\n")[1]?.split('\n          NODE')[0].replace(/^          /gm,'');
assert.ok(code,'The test must execute the actual workflow trigger code.');
async function run(hook,response){
 let calls=0;const logs=[];
 const context=vm.createContext({URL,AbortSignal,process:{env:{DEPLOY_HOOK:hook}},console:{log:value=>logs.push(value)},fetch:async(url,options)=>{calls++;assert.equal(options.method,'POST');assert.equal(options.redirect,'error');return response}});
 await new vm.Script('(async()=>{'+code+'})()').runInContext(context);
 return {calls,logs};
}
const url='https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/test-only';
test('main release request is cloud-only and receives no source or repository credential',()=>{
 assert.match(workflow,/branches: \[main\]/);assert.match(workflow,/permissions: \{\}/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.doesNotMatch(workflow,/actions\/checkout|CLOUDFLARE_API_TOKEN|contents: write|repository_dispatch|pull_request_target/);
});
test('missing, foreign, redirected or malformed hook destinations fail before a request',async()=>{
 for(const value of ['', 'https://example.com/secret',url+'?secret=1',url+'#fragment','http://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/test',url.replace('api.cloudflare.com','user@api.cloudflare.com')])await assert.rejects(run(value,{ok:true}));
});
test('queued build is reported without exposing the secret or claiming deployment',async()=>{
 const result=await run(url,{ok:true,json:async()=>({success:true,result:{build_uuid:'test-build'}})});
 assert.equal(result.calls,1);assert.match(result.logs[0],/Private build queued: test-build/);assert.ok(!result.logs[0].includes(url));
 await assert.rejects(run(url,{ok:false,status:503}));
 await assert.rejects(run(url,{ok:true,json:async()=>({success:false})}));
});
