import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Local CPU microbenchmark only: it does not estimate network or whole-page latency.
mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['app/form-fields.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/formatting-benchmark.mjs'});
const {fmt}=await import(pathToFileURL(resolve('.test-output/formatting-benchmark.mjs')).href);
const dates=Array.from({length:500},(_,i)=>Date.UTC(2026,0,1+i));
const options=[{day:'2-digit'},{month:'numeric'},{weekday:'short'},{hour:'2-digit',minute:'2-digit'},{hour:'2-digit',minute:'2-digit'}];
const previous=(at,opts)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',...opts}).format(at);
for(const at of dates)for(const opts of options)assert.equal(fmt(at,opts),previous(at,opts));
function median(render){
 const samples=[];
 for(let run=0;run<7;run++){
  const start=performance.now();
  for(const at of dates)for(const opts of options)render(at,opts);
  samples.push(performance.now()-start);
 }
 return samples.sort((a,b)=>a-b)[Math.floor(samples.length/2)];
}
const previousMedianMs=median(previous),currentMedianMs=median(fmt);
console.log(JSON.stringify({scope:'500 event rows, five formatted cells each; seven-run median',previousMedianMs,currentMedianMs,speedup:previousMedianMs/currentMedianMs},null,2));
