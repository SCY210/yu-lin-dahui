// Exercise the real server layout metadata with isolated request cookies.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {Children} from 'react';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__installTest={cookie:undefined};
await build({entryPoints:['app/layout.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','react-dom','react-dom/*','next-themes','lucide-react'],loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:'.test-output/install-layout.mjs',plugins:[{name:'isolated-install-metadata',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'install-fixture'}));b.onLoad({filter:/.*/,namespace:'install-fixture'},a=>({loader:'js',contents:"export const cookies=async()=>({get:key=>key==='yulin_icon_theme'&&globalThis.__installTest.cookie!==undefined?{value:globalThis.__installTest.cookie}:undefined});"}))}}]});
await build({entryPoints:['lib/theme-brand.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/install-brand.mjs'});
const layout=await import(pathToFileURL(resolve('.test-output/install-layout.mjs')).href),brand=await import(pathToFileURL(resolve('.test-output/install-brand.mjs')).href);
try{
 for(const theme of brand.BRAND_THEMES){
  fixture.cookie=theme;const meta=await layout.generateMetadata();
  assert.deepEqual(meta.icons,brand.brandMetadata(theme).icons);assert.equal(meta.manifest,brand.brandManifestUrl(theme));
  const tree=await layout.default({children:'fixture'}),children=Children.toArray(tree.props.children);
  const body=children.find(child=>child.type==='body'),head=children.find(child=>child.type==='head');
  assert.equal(tree.props.className,theme+'-theme');assert.equal(body.props.children.props.initialTheme,theme);
  const preloads=Children.toArray(head.props.children).filter(child=>child.type==='link'&&child.props.rel==='preload');
  assert.equal(preloads.length,1,'only the selected theme illustration should compete for early bandwidth');
  assert.equal(preloads[0].props.href,theme==='wuxia'?'/wuxia-hero.webp':'/shuttlecock.webp');
  assert.equal(preloads[0].props.as,'image');assert.equal(preloads[0].props.fetchPriority,'high');
  assert.equal(meta.applicationName,'羽林大会');assert.equal(meta.title,'羽林大会');
  assert.deepEqual(meta.appleWebApp,{capable:true,title:'羽林大会',statusBarStyle:'default'});assert.equal(meta.other['apple-mobile-web-app-capable'],'yes');
 }
 fixture.cookie=undefined;let meta=await layout.generateMetadata();assert.equal(meta.manifest,brand.brandManifestUrl('classic'));
 fixture.cookie='https://attacker.invalid/icon.png';meta=await layout.generateMetadata();assert.equal(meta.manifest,brand.brandManifestUrl('classic'));
 console.log('PASS installation metadata: actual server Apple/favicon/manifest match the selected theme before client hydration, same initial UI palette, invalid-cookie fallback, iPhone web-app name and full-screen tags');
}finally{delete globalThis.__installTest}
