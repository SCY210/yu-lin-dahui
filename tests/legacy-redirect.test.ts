import {test} from 'node:test';import assert from 'node:assert/strict';
import {legacySiteRedirect} from '../lib/legacy-redirect';
const origin='https://canonical.example',old='https://legacy.example';
test('without an explicit runtime setting both normal deployments retain their routing',()=>{
 assert.equal(legacySiteRedirect(new Request(old+'/')),null);
});
test('navigation preserves deep links and query filters without creating a browser-cache commitment',()=>{
 for(const method of ['GET','HEAD']){const r=legacySiteRedirect(new Request(old+'/?page=events&event=example&tab=fees',{method}),origin)!;assert.equal(r.status,307);assert.equal(r.headers.get('Location'),origin+'/?page=events&event=example&tab=fees');assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('Referrer-Policy'),'no-referrer')}
 assert.equal(legacySiteRedirect(new Request(old+'/privacy'),origin)!.headers.get('Location'),origin+'/privacy');
});
test('cached legacy clients cannot keep mutating or reading the old business database',async()=>{
 for(const [method,path]of [['GET','/api/club?export=1'],['GET','/api/photos/example'],['POST','/api/auth'],['POST','/api/club'],['DELETE','/api/photos/example'],['PUT','/unexpected']]){
  const r=legacySiteRedirect(new Request(old+path,{method,headers:{Cookie:'private-cookie'}}),origin)!;assert.equal(r.status,410);assert.equal(r.headers.get('Location'),null,'do not redirect credential-bearing API requests across origins');assert.equal((await r.json() as {redirectRequired:boolean}).redirectRequired,true);
 }
});
test('worker update/static assets remain reachable while APIs always precede static allowances',()=>{
 for(const path of ['/sw.js','/manifest.webmanifest','/offline.html','/favicon.ico','/icons/app.png','/_next/static/chunks/app.js'])assert.equal(legacySiteRedirect(new Request(old+path),origin),null);
 assert.equal(legacySiteRedirect(new Request(old+'/sw.js',{method:'POST'}),origin)!.status,410);
});
test('invalid or looping runtime settings fail closed instead of returning to a writable legacy app',()=>{
 for(const setting of ['http://canonical.example','javascript:alert(1)','https://user:pass@canonical.example','https://canonical.example/path','https://canonical.example/?q=1','https://canonical.example/#hash',old,'not a URL'])assert.equal(legacySiteRedirect(new Request(old+'/'),setting)!.status,503);
});
test('migration access is still delegated to the existing token-protected read-only exporter',()=>{
 assert.equal(legacySiteRedirect(new Request(old+'/_operator/migration/snapshot'),origin),null);
});
