import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
mkdirSync('.test-output',{recursive:true});
const built=await build({entryPoints:['app/api/simulation/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/admin-simulation-retired.mjs',metafile:true});
assert.deepEqual(Object.keys(built.metafile.inputs),['app/api/simulation/route.ts'],'Retired clients cannot load account, club or database modules');
const api=await import(pathToFileURL(resolve('.test-output/admin-simulation-retired.mjs')).href);
for(const cookie of ['', 'yulin_session=fictional-member', 'yulin_session=fictional-admin']){
 const get=await api.GET();assert.equal(get.status,410);assert.equal(get.headers.get('cache-control'),'no-store');
 for(const body of ['not JSON',JSON.stringify({action:'initialize',requestId:crypto.randomUUID()}),JSON.stringify({action:'reset',revision:1,payload:{role:'admin'}})]){
  const response=await api.POST(new Request('https://club.example/api/simulation',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body}));
  assert.equal(response.status,410);const result=await response.json();assert.match(result.error,/已停用/);assert.equal(result.data,undefined);
 }
}
const ui=readFileSync('app/club-app.tsx','utf8');assert.doesNotMatch(ui,/SimulationEntry|AdminSimulation|page==='simulation'|page!=='simulation'/);
console.log('PASS retired simulation: entry removed; old anonymous/member/admin reads and writes return 410 without account, club or D1 access');
