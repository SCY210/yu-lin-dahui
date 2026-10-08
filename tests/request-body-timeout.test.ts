import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readJsonBody,readPhotoForm,RequestError} from '../lib/request-body';
import {publicApiError} from '../lib/api-error';

const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
const request=(body:ReadableStream<Uint8Array>,signal?:AbortSignal)=>new Request('https://example.invalid/api/club',{
 method:'POST',body,signal,duplex:'half',
} as RequestInit);

test('stalled JSON and multipart bodies expire at their respective deadlines',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout']});
 for(const [read,limit] of [[readJsonBody,10_000],[readPhotoForm,30_000]] as const){
  let cancelled=false,settled=false;
  const req=request(new ReadableStream<Uint8Array>({cancel(){cancelled=true;return new Promise<void>(()=>{})}}));
  const pending=read(req);
  pending.then(()=>{settled=true},()=>{settled=true});
  const rejected=assert.rejects(pending,(e:unknown)=>{
   assert.ok(e instanceof RequestError);
   assert.equal(e.status,408);
   assert.equal(publicApiError(e).status,408);
   return true;
  });
  t.mock.timers.tick(limit-1);await flush();assert.equal(settled,false);
  t.mock.timers.tick(1);await rejected;
  assert.equal(cancelled,true);assert.equal(req.body!.locked,false);
 }
});

test('trickling chunks do not reset the total JSON deadline',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout']});
 let controller!:ReadableStreamDefaultController<Uint8Array>,cancelled=false,settled=false;
 const req=request(new ReadableStream<Uint8Array>({start(c){controller=c;c.enqueue(new TextEncoder().encode('{'))},cancel(){cancelled=true}}));
 const pending=readJsonBody(req);pending.then(()=>{settled=true},()=>{settled=true});
 const rejected=assert.rejects(pending,(e:unknown)=>e instanceof RequestError&&e.status===408);
 await flush();t.mock.timers.tick(9_000);
 controller.enqueue(new TextEncoder().encode(' '));await flush();
 t.mock.timers.tick(999);await flush();assert.equal(settled,false);
 t.mock.timers.tick(1);await rejected;assert.equal(cancelled,true);
});

test('oversized requests return 413 even when stream cancellation never settles',{timeout:2000},async()=>{
 let cancelled=false;
 const req=request(new ReadableStream<Uint8Array>({
  start(c){c.enqueue(new Uint8Array(11))},
  cancel(){cancelled=true;return new Promise<void>(()=>{})},
 }));
 await assert.rejects(readJsonBody(req,10),(e:unknown)=>e instanceof RequestError&&e.status===413);
 assert.equal(cancelled,true);assert.equal(req.body!.locked,false);
});

test('client aborts release pending reads without exposing the abort reason',async()=>{
 for(const alreadyAborted of [false,true]){
  const abort=new AbortController();let cancelled=false;
  if(alreadyAborted)abort.abort(new Error('private transport details'));
  const req=request(new ReadableStream<Uint8Array>({cancel(){cancelled=true}}),abort.signal);
  const rejected=assert.rejects(readJsonBody(req),(e:unknown)=>{
   assert.ok(e instanceof RequestError);assert.equal(e.status,400);
   assert.ok(!publicApiError(e).error.includes('private'));return true;
  });
  if(!alreadyAborted)abort.abort(new Error('private transport details'));
  await rejected;assert.equal(cancelled,true);assert.equal(req.body!.locked,false);
 }
});

test('successful bodies keep normal JSON and multipart parsing and clear timers',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout']});
 assert.deepEqual(await readJsonBody(new Request('https://example.invalid',{method:'POST',body:'{"name":"球友"}'})),{name:'球友'});
 const form=new FormData();form.set('caption','照片');form.set('file',new Blob(['fixture'],{type:'image/png'}),'fixture.png');
 const parsed=await readPhotoForm(new Request('https://example.invalid',{method:'POST',body:form}));
 assert.equal(parsed.get('caption'),'照片');assert.equal(await (parsed.get('file') as File).text(),'fixture');
 t.mock.timers.tick(60_000);await flush();
});
