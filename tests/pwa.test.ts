import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {secureResponse} from '../lib/security-headers';
import {brandManifest,brandManifestUrl,brandMetadata,BRAND_CHANGE_EVENT, BRAND_THEMES, themeBrand} from '../lib/theme-brand';
import {syncThemeBrand} from '../lib/client/theme-brand';
import {GET as getManifest} from '../app/manifest.webmanifest/route';

function worker(){
 const handlers=new Map<string,(event:any)=>void>(),storage=new Map<string,Response>(),fetches:any[]=[],deleted:string[]=[];
 let network=(request:any,options?:any)=>{
  fetches.push({request,options});const response=new Response('<h1>offline</h1>',{headers:{'Content-Type':'text/html'}});
  Object.defineProperty(response,'redirected',{value:true});return Promise.resolve(response);
 };
 const self={location:{origin:'https://club.example'},addEventListener:(name:string,handler:(event:any)=>void)=>handlers.set(name,handler),skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 const caches={open:async()=>({put:async(key:string,response:Response)=>storage.set(key,response.clone()),match:async(key:string)=>storage.get(key)?.clone()}),keys:async()=>['yulin-offline-v0','yulin-offline-v1','another-app-cache'],delete:async(key:string)=>{deleted.push(key);return true}};
 runInNewContext(readFileSync('public/sw.js','utf8'),{self,caches,URL,Response,fetch:(...args:any[])=>network(args[0],args[1])});
 const lifecycle=async(name:string)=>{let work:Promise<unknown>|undefined;handlers.get(name)!({waitUntil:(promise:Promise<unknown>)=>{work=promise}});await work};
 const request=(url:string,mode='navigate',method='GET')=>{let response:Promise<Response>|undefined;handlers.get('fetch')!({request:{url,mode,method},respondWith:(promise:Promise<Response>)=>{response=promise}});return response};
 return {storage,fetches,deleted,lifecycle,request,setNetwork:(next:typeof network)=>{network=next}};
}

test('App安装清单覆盖安卓图标和Apple触屏图标，独立窗口从首页启动',()=>{
 const manifest=brandManifest('classic');
 assert.equal(manifest.name,'羽林大会');assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){const png=readFileSync('public'+icon.src),[width,height]=icon.sizes.split('x').map(Number);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);assert.equal(width,height);assert.equal(icon.type,'image/png')}
 assert.ok(manifest.icons.some((icon:any)=>icon.sizes==='192x192'&&icon.purpose==='any'));
 assert.ok(manifest.icons.some((icon:any)=>icon.sizes==='512x512'&&icon.purpose==='maskable'));
 const apple=readFileSync('public/icons/apple-touch-icon.png');assert.equal(apple.readUInt32BE(16),180);assert.equal(apple.readUInt32BE(20),180);
});

test('共享主题图标均有独立PNG与Apple尺寸，切换主题保持同一App身份',()=>{
 for(const theme of BRAND_THEMES){
  const manifest=brandManifest(theme),brand=themeBrand(theme);
  assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');
  for(const icon of manifest.icons){
   assert.ok(icon.src.includes(theme));
   assert.ok(icon.src.endsWith('-v4.png'));
   const png=readFileSync('public'+icon.src),size=Number(icon.sizes.split('x')[0]);
   assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
   assert.equal(png[25],2); // flattened RGB: no transparency around an app icon
  }
  const apple=readFileSync('public'+brand.apple);assert.equal(apple.readUInt32BE(16),180);assert.equal(apple.readUInt32BE(20),180);
 }
 assert.equal(new Set(BRAND_THEMES.map(theme=>themeBrand(theme).logo)).size,BRAND_THEMES.length);
});

test('主题安装清单按设备偏好隔离，非法或相似Cookie回退清雅，不接受外部图标地址',async()=>{
 for(const theme of BRAND_THEMES){
  const response=getManifest(new Request('https://club.example/manifest.webmanifest',{headers:{Cookie:'another=1; yulin_icon_theme='+theme}}));
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Vary'),'Cookie');
  assert.match(response.headers.get('Content-Type')??'',/^application\/manifest\+json/);
  const manifest=await response.json();assert.deepEqual(manifest,brandManifest(theme));
 }
 for(const cookie of ['', 'yulin_icon_theme=https://other.example/icon.png','yulin_icon_theme=__proto__','not_yulin_icon_theme=wuxia']){
  const manifest=await getManifest(new Request('https://club.example/manifest.webmanifest',{headers:{Cookie:cookie}})).json();
  assert.deepEqual(manifest,brandManifest('classic'));
 }
});

test('安装清单URL显式选色，不带Cookie或带旧蓝色Cookie也得到所选主题',async()=>{
 for(const theme of BRAND_THEMES)for(const cookie of ['', 'yulin_icon_theme=classic']){
  const response=getManifest(new Request('https://club.example'+brandManifestUrl(theme),{headers:{Cookie:cookie}}));
  assert.deepEqual(await response.json(),brandManifest(theme));
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  const meta=brandMetadata(theme);assert.equal(meta.manifest,brandManifestUrl(theme));assert.equal(meta.icons.apple[0].url,themeBrand(theme).apple);
 }
});

test('无效安装主题回退合法Cookie，全部图标地址同源且应用身份不变',async()=>{
 for(const value of ['https://attacker.invalid/a.png','__proto__','WUXIA']){
  const url='https://club.example/manifest.webmanifest?theme='+encodeURIComponent(value);
  const manifest=await getManifest(new Request(url,{headers:{Cookie:'yulin_icon_theme=wuxia'}})).json();
  assert.deepEqual(manifest,brandManifest('wuxia'));
 }
 for(const theme of BRAND_THEMES){const manifest=brandManifest(theme);assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.ok(manifest.icons.every(i=>i.src.startsWith('/icons/')))}
});

test('切换主题同步Apple图标和显式安装地址，只在地址变化时撤销旧安装提示',()=>{
 const events:string[]=[],writes:string[]=[],icon={href:''},apple={href:'',sizes:{value:''}},meta={setAttribute(){}};
 const element=(href:string):any=>({href,crossOrigin:'',getAttribute(key:string){return this[key]},cloneNode(){return element(this.href)},replaceWith(next:any){manifest=next}});
 let manifest=element('/manifest.webmanifest');
 const doc={location:{protocol:'https:'},set cookie(v:string){writes.push(v)},querySelector(selector:string){return selector.includes('manifest')?manifest:meta},querySelectorAll(selector:string){return selector.includes('apple-touch-icon')?[apple]:[icon]},defaultView:{dispatchEvent(event:Event){events.push(event.type)}}} as unknown as Document;
 syncThemeBrand(doc,'wuxia');assert.equal(manifest.href,brandManifestUrl('wuxia'));assert.equal(manifest.crossOrigin,'use-credentials');assert.equal(icon.href,themeBrand('wuxia').logo);assert.equal(apple.href,themeBrand('wuxia').apple);assert.equal(apple.sizes.value,'180x180');assert.deepEqual(events,[BRAND_CHANGE_EVENT]);assert.match(writes[0],/^yulin_icon_theme=wuxia;.*Secure/);
 syncThemeBrand(doc,'wuxia');assert.equal(events.length,1);
 syncThemeBrand(doc,'classic');assert.equal(manifest.href,brandManifestUrl('classic'));assert.equal(events.length,2);assert.ok(writes.every(w=>!w.includes('session')));
});

test('Service Worker只预存断网页，安装请求不携带账号Cookie，激活不删除其他缓存',async()=>{
 const sw=worker();await sw.lifecycle('install');assert.deepEqual([...sw.storage.keys()],['/offline.html']);
 assert.equal(sw.storage.get('/offline.html')!.redirected,false);
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
