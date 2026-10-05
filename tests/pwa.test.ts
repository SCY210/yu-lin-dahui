import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {secureResponse} from '../lib/security-headers';

function worker(){
 const handlers=new Map<string,(event:any)=>void>(),storage=new Map<string,Response>(),fetches:any[]=[],deleted:string[]=[];
 let network=(request:any,options?:any)=>{fetches.push({request,options});return Promise.resolve(new Response('<h1>offline</h1>',{headers:{'Content-Type':'text/html'}}))};
 const self={location:{origin:'https://club.example'},addEventListener:(name:string,handler:(event:any)=>void)=>handlers.set(name,handler),skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 const caches={open:async()=>({put:async(key:string,response:Response)=>storage.set(key,response.clone()),match:async(key:string)=>storage.get(key)?.clone()}),keys:async()=>['yulin-offline-v0','yulin-offline-v1','another-app-cache'],delete:async(key:string)=>{deleted.push(key);return true}};
 runInNewContext(readFileSync('public/sw.js','utf8'),{self,caches,URL,Response,fetch:(...args:any[])=>network(args[0],args[1])});
 const lifecycle=async(name:string)=>{let work:Promise<unknown>|undefined;handlers.get(name)!({waitUntil:(promise:Promise<unknown>)=>{work=promise}});await work};
 const request=(url:string,mode='navigate',method='GET')=>{let response:Promise<Response>|undefined;handlers.get('fetch')!({request:{url,mode,method},respondWith:(promise:Promise<Response>)=>{response=promise}});return response};
 return {storage,fetches,deleted,lifecycle,request,setNetwork:(next:typeof network)=>{network=next}};
}

test('App安装清单覆盖安卓图标和Apple触屏图标，独立窗口从首页启动',()=>{
 const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
 assert.equal(manifest.name,'羽林大会');assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){const png=readFileSync('public'+icon.src),[width,height]=icon.sizes.split('x').map(Number);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);assert.equal(width,height);assert.equal(icon.type,'image/png')}
 assert.ok(manifest.icons.some((icon:any)=>icon.sizes==='192x192'&&icon.purpose==='any'));
 assert.ok(manifest.icons.some((icon:any)=>icon.sizes==='512x512'&&icon.purpose==='maskable'));
 const apple=readFileSync('public/icons/apple-touch-icon.png');assert.equal(apple.readUInt32BE(16),180);assert.equal(apple.readUInt32BE(20),180);
});

test('Service Worker只预存断网页，安装请求不携带账号Cookie，激活不删除其他缓存',async()=>{
 const sw=worker();await sw.lifecycle('install');assert.deepEqual([...sw.storage.keys()],['/offline.html']);
 assert.equal(sw.fetches[0].request,'/offline.html');assert.equal(sw.fetches[0].options.credentials,'omit');assert.equal(sw.fetches[0].options.cache,'reload');
 await sw.lifecycle('activate');assert.deepEqual(sw.deleted,['yulin-offline-v0']);
});

test('登录API、群组资料、照片、写请求和其他来源不被Worker拦截或缓存',async()=>{
 const sw=worker();await sw.lifecycle('install');
 for(const url of ['https://club.example/api/club','https://club.example/api/auth/legacy','https://club.example/api/photos/private','https://other.example/'])assert.equal(sw.request(url),undefined);
 assert.equal(sw.request('https://club.example/','navigate','POST'),undefined);assert.equal(sw.request('https://club.example/?page=me','cors'),undefined);
 assert.equal(sw.fetches.length,1);assert.deepEqual([...sw.storage.keys()],['/offline.html']);
});

test('页面正常联网或401响应不缓存、不伪装成离线；断网后只显示公开提示',async()=>{
 const sw=worker();await sw.lifecycle('install');
 sw.setNetwork(async()=>new Response('private club response',{status:200}));assert.equal(await (await sw.request('https://club.example/?page=me')!).text(),'private club response');
 sw.setNetwork(async()=>new Response('login required',{status:401}));assert.equal((await sw.request('https://club.example/')!).status,401);
 assert.deepEqual([...sw.storage.keys()],['/offline.html']);
 sw.setNetwork(async()=>{throw new Error('offline')});assert.equal(await (await sw.request('https://club.example/?page=events')!).text(),'<h1>offline</h1>');
});

test('离线安装资源缺失不缓存错误内容，Worker脚本不能被长期缓存',async()=>{
 const sw=worker();sw.setNetwork(async()=>new Response('unexpected account data',{headers:{'Content-Type':'application/json'}}));await assert.rejects(()=>sw.lifecycle('install'),/Offline screen unavailable/);assert.equal(sw.storage.size,0);
 const response=secureResponse(new Response('worker',{headers:{'Cache-Control':'public, max-age=31536000'}}),new Request('https://club.example/sw.js'));
 assert.equal(response.headers.get('Cache-Control'),'no-cache');assert.equal(response.headers.get('Service-Worker-Allowed'),'/');
});
