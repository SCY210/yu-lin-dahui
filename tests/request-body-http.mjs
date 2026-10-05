// Read-only regression against a built local Worker. No fixtures or DB writes.
import {request} from 'node:http';
import assert from 'node:assert/strict';

const url=new URL(process.env.REQUEST_BODY_TEST_ORIGIN??'http://127.0.0.1:8794');
assert.equal(url.protocol,'http:');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Loopback only');
assert.ok(!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/');
const origin=url.origin;
const response=await new Promise((resolve,reject)=>{
 const started=performance.now();let timer;
 const req=request(origin+'/api/auth',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},signal:AbortSignal.timeout(18_000),
 },res=>{
  const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
  res.on('end',()=>{
   clearTimeout(timer);
   try{resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(Buffer.concat(chunks).toString()),elapsed:performance.now()-started})}catch(error){reject(error)}
   req.destroy();
  });
 });
 req.on('error',error=>{clearTimeout(timer);reject(error)});
 // Some local HTTP adapters drain the upload before delivering the response.
 // Finish after the application deadline to verify its 408 over real HTTP.
 req.write('{');timer=setTimeout(()=>req.end('}'),11_000);
});
assert.equal(response.status,408);
assert.ok(response.elapsed>=9_000&&response.elapsed<16_000);
assert.ok(response.headers['cache-control'].includes('no-store'));
assert.equal(response.headers['set-cookie'],undefined);
assert.equal(typeof response.body.error,'string');
const healthy=await fetch(origin+'/api/auth',{signal:AbortSignal.timeout(5000)});
assert.equal(healthy.status,200);assert.deepEqual(await healthy.json(),{signedIn:false});
const invalid=await fetch(origin+'/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{',signal:AbortSignal.timeout(5000)});
assert.equal(invalid.status,400);
console.log('PASS real local Worker HTTP: slow chunked login -> 408, no-store, no session issued; auth GET and malformed JSON still respond');
