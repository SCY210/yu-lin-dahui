import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {bootstrapClub,dependenciesMatch,prepareMigrations} from '../scripts/local-test.mjs';
import {localTestConfiguration,localTestEnabled,localTestOrigin} from '../scripts/local-test-config.mjs';
import {localTestLoginMiddleware} from '../build/local-test-login.mjs';

test('local test binding overrides are serve-only and use a separate ignored state directory',()=>{
 assert.equal(localTestEnabled('serve','1'),true);
 for(const [command,flag] of [['build','1'],['serve',undefined],['serve','true']])assert.equal(localTestEnabled(command,flag),false);
 const configuration=localTestConfiguration(process.cwd(),'feature/example');
 assert.equal(configuration.state,path.join(process.cwd(),'.sites-runtime','local-test','branches',configuration.branchKey,'state'));
 assert.equal(configuration.bindings.d1_databases[0].database_id,'00000000-0000-4000-8000-000000000042');
 assert.notEqual(configuration.state,path.join(process.cwd(),'.wrangler','state'));
});

test('each branch and detached revision has independent data and migration metadata while sharing runtime caches',()=>{
 const project=process.cwd(),a=localTestConfiguration(project,'feature/a'),b=localTestConfiguration(project,'feature/b');
 assert.notEqual(a.state,b.state);assert.notEqual(a.configFile,b.configFile);
 assert.equal(a.cacheRoot,b.cacheRoot);assert.equal(localTestConfiguration(project,'feature/a').state,a.state);
 assert.notEqual(localTestConfiguration(project,'feature/A').state,a.state);
 assert.notEqual(localTestConfiguration(project,'detached:'+'a'.repeat(40)).state,localTestConfiguration(project,'detached:'+'b'.repeat(40)).state);
 const unusual=localTestConfiguration(project,'../../outside');
 assert.match(unusual.branchKey,/^[a-f0-9]{24}$/);
 assert.equal(path.dirname(unusual.runtime),path.join(project,'.sites-runtime','local-test','branches'));
 assert.throws(()=>localTestConfiguration(project,'bad\nbranch'),/Invalid/);
});

test('missing or outdated required dependencies trigger installation while absent platform options do not',()=>{
 const packages={'node_modules/required':{version:'1.2.3',integrity:'correct'},'node_modules/other-platform':{version:'1',optional:true}};
 const lock={lockfileVersion:3,packages},installed={lockfileVersion:3,packages:{'node_modules/required':{version:'1.2.3',integrity:'correct'}}};
 assert.equal(dependenciesMatch(lock,installed),true);
 assert.equal(dependenciesMatch(lock,undefined),false);
 assert.equal(dependenciesMatch(lock,{...installed,packages:{}}),false);
 assert.equal(dependenciesMatch(lock,{...installed,packages:{'node_modules/required':{version:'old',integrity:'correct'}}}),false);
 assert.equal(dependenciesMatch(lock,{...installed,packages:{'node_modules/required':{version:'1.2.3',integrity:'changed'}}}),false);
});

test('journaled migrations copy once in order and changed historical SQL is rejected without losing local files',()=>{
 const output=path.join(process.cwd(),'.test-output');mkdirSync(output,{recursive:true});
 const project=mkdtempSync(path.join(output,'local-launcher-'));
 mkdirSync(path.join(project,'drizzle','meta'),{recursive:true});
 writeFileSync(path.join(project,'drizzle','meta','_journal.json'),JSON.stringify({entries:[{idx:1,tag:'0001_second'},{idx:0,tag:'0000_first'}]}));
 writeFileSync(path.join(project,'drizzle','0000_first.sql'),'CREATE TABLE fixture (id TEXT);');
 writeFileSync(path.join(project,'drizzle','0001_second.sql'),'CREATE TABLE another (id TEXT);');
 const configuration=localTestConfiguration(project,'feature/a'),first=prepareMigrations(project,configuration);
 assert.deepEqual(Object.keys(first.hashes),['0000_first.sql','0001_second.sql']);
 writeFileSync(first.hashFile,JSON.stringify(first.hashes));
 assert.deepEqual(prepareMigrations(project,configuration).hashes,first.hashes);
 writeFileSync(path.join(configuration.runtime,'migrations','9999_unexpected.sql'),'CREATE TABLE unexpected (id TEXT);');
 assert.throws(()=>prepareMigrations(project,configuration),/not in the journal/);
 writeFileSync(path.join(project,'drizzle','0000_first.sql'),'DROP TABLE fixture;');
 assert.throws(()=>prepareMigrations(project,configuration),/has changed/);
 assert.equal(readFileSync(path.join(configuration.runtime,'migrations','0000_first.sql'),'utf8'),'CREATE TABLE fixture (id TEXT);');
 const other=localTestConfiguration(project,'feature/b'),second=prepareMigrations(project,other);
 assert.notEqual(second.hashes['0000_first.sql'],first.hashes['0000_first.sql']);
 assert.equal(readFileSync(path.join(other.runtime,'migrations','0000_first.sql'),'utf8'),'DROP TABLE fixture;');
 writeFileSync(path.join(project,'drizzle','meta','_journal.json'),JSON.stringify({entries:[{idx:0,tag:'../outside'}]}));
 assert.throws(()=>prepareMigrations(project,configuration),/Invalid/);
});

test('generic bootstrap prepares only an administrator and preserves tester-created business records',async()=>{
 let fresh=true,events:Array<{id:string;title:string}>=[],revision=0;const writes:string[]=[];
 const fixtureFetch:typeof fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);assert.equal(url.origin,localTestOrigin);
  if(url.pathname==='/signin-with-chatgpt')return new Response(null,{status:302,headers:{'Set-Cookie':'__sites_local_auth=1; Path=/; HttpOnly'}});
  const headers=new Headers(options.headers);
  assert.equal(headers.get('Cookie'),'__sites_local_auth=1');
  if(options.method==='POST'){
   assert.equal(headers.get('Origin'),localTestOrigin);
   const body=JSON.parse(String(options.body));writes.push(body.action);
   assert.ok(body.requestId);
   assert.equal(body.payload.name,'Local test administrator');
   if(body.action==='initialize')fresh=false;
   else assert.fail('The generic launcher must not create feature-specific business records');
   revision++;return Response.json({ok:true,revision});
  }
  return Response.json(fresh?{setup:true}:{events,revision});
 };
 assert.equal((await bootstrapClub(localTestOrigin,fixtureFetch)).events,0);
 assert.deepEqual(writes,['initialize']);
 events.push({id:'user-created-event',title:'User-created activity'});
 events[0].title='User-edited activity';await bootstrapClub(localTestOrigin,fixtureFetch);
 events=[];await bootstrapClub(localTestOrigin,fixtureFetch);
 assert.deepEqual(writes,['initialize']);assert.deepEqual(events,[]);
 await assert.rejects(bootstrapClub('https://production.example',fixtureFetch),/restricted/);
});

test('fixture initialization stops when the local authentication cookie is missing',async()=>{
 let reads=0;
 await assert.rejects(bootstrapClub(localTestOrigin,async()=>{reads++;return new Response(null,{status:302})}),/fictional local identity/);
 assert.equal(reads,1);
});

function localLogin(patch:Record<string,unknown>={}){
 const headers=new Map<string,string|number|readonly string[]>();let ended=false,next=false;
 const request={url:'/__local-test/login',method:'GET',headers:{host:'127.0.0.1:5190'},socket:{remoteAddress:'127.0.0.1'},...patch};
 const response={statusCode:200,setHeader(name:string,value:string|number|readonly string[]){headers.set(name,value)},end(){ended=true}};
 localTestLoginMiddleware(localTestOrigin)(request as unknown as IncomingMessage,response as unknown as ServerResponse,()=>{next=true});
 return {headers,ended,next,status:response.statusCode};
}

test('local launcher entry clears only browser login cookies before the existing fictional sign-in helper',()=>{
 const response=localLogin();assert.equal(response.status,302);assert.equal(response.ended,true);
 assert.equal(response.headers.get('Location'),'/signin-with-chatgpt');
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.deepEqual(response.headers.get('Set-Cookie'),['yulin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax','yulin_signed_out=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax']);
 const unrelated=localLogin({url:'/api/club'});assert.equal(unrelated.next,true);assert.equal(unrelated.headers.size,0);
});

test('local launcher login refuses remote addresses, forged hosts, cross-site requests and writes',()=>{
 for(const patch of [{method:'POST'},{socket:{remoteAddress:'203.0.113.1'}},{headers:{host:'production.example'}},{headers:{host:'127.0.0.1:5190',origin:'https://external.example'}},{headers:{host:'127.0.0.1:5190','sec-fetch-site':'cross-site'}}]){
  const response=localLogin(patch);assert.equal(response.status,403);assert.equal(response.headers.has('Set-Cookie'),false);assert.equal(response.headers.has('Location'),false);
 }
});
