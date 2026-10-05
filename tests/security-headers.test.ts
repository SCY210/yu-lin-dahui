import {test} from 'node:test';
import assert from 'node:assert/strict';
import config from '../next.config';
import {securityHeaders,secureResponse} from '../lib/security-headers';

test('应用响应关闭类型猜测、危险插件及跨站表单，保留当前脚本渲染与合法预览',()=>{
 const headers=new Headers(securityHeaders.map(h=>[h.key,h.value]));
 assert.equal(headers.get('X-Content-Type-Options'),'nosniff');
 assert.equal(headers.get('Referrer-Policy'),'strict-origin-when-cross-origin');
 const csp=headers.get('Content-Security-Policy')!;
 for(const directive of ["object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'self'"])assert.ok(csp.includes(directive));
 assert.ok(csp.includes('https://chatgpt.com'));assert.ok(!csp.includes('https://*.chatgpt.site'));
 assert.ok(!csp.includes('script-src'));assert.ok(!csp.includes('unsafe-eval'));
 assert.ok(headers.get('Permissions-Policy')!.includes('microphone=()'));
});
test('Worker实际包装保留响应正文、重定向和Cookie，API私有缓存且静态缓存不被覆盖',async()=>{
 const original=new Response('stream remains intact',{status:201,headers:{'Set-Cookie':'session=test; HttpOnly; SameSite=Lax','Cache-Control':'public, max-age=3600'}});
 const secured=secureResponse(original,new Request('https://example.test/api/club'));
 assert.equal(secured.status,201);assert.equal(await secured.text(),'stream remains intact');
 assert.equal(secured.headers.get('set-cookie'),'session=test; HttpOnly; SameSite=Lax');
 assert.equal(secured.headers.get('cache-control'),'private, no-store');
 assert.equal(secured.headers.get('x-content-type-options'),'nosniff');
 const redirect=secureResponse(new Response(null,{status:303,headers:{Location:'/'}}),new Request('https://example.test/login'));
 assert.equal(redirect.status,303);assert.equal(redirect.headers.get('location'),'/');
 const asset=secureResponse(new Response('asset',{headers:{'Cache-Control':'public, max-age=3600'}}),new Request('https://example.test/assets/test.js'));
 assert.equal(asset.headers.get('cache-control'),'public, max-age=3600');
});
test('统一头配置覆盖所有路径，HTML和API不保留敏感缓存，静态资源缓存策略不被覆盖',async()=>{
 const groups=await config.headers!();assert.equal(groups[0].source,'/:path*');
 const privateGroups=groups.filter(g=>g.headers.some(h=>h.key==='Cache-Control'));
 assert.deepEqual(privateGroups.map(g=>g.source).sort(),['/','/api/:path*']);
 assert.ok(privateGroups.every(g=>g.headers.find(h=>h.key==='Cache-Control')!.value==='private, no-store'));
});
