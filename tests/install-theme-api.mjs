// Exercise the real server layout metadata with isolated request cookies.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__installTest={cookie:undefined};
await build({entryPoints:['app/layout.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','react-dom','react-dom/*','next-themes','lucide-react'],loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:'.test-output/install-layout.mjs',plugins:[{name:'isolated-install-metadata',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'install-fixture'}));b.onLoad({filter:/.*/,namespace:'install-fixture'},a=>({loader:'js',contents:"export const cookies=async()=>({get:key=>key==='yulin_icon_theme'&&globalThis.__installTest.cookie!==undefined?{value:globalThis.__installTest.cookie}:undefined});"}))}}]});
await build({entryPoints:['lib/theme-brand.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/install-brand.mjs'});
const layout=await import(pathToFileURL(resolve('.test-output/install-layout.mjs')).href),brand=await import(pathToFileURL(resolve('.test-output/install-brand.mjs')).href);
try{
 for(const theme of brand.BRAND_THEMES){fixture.cookie=theme;const meta=await layout.generateMetadata();assert.deepEqual(meta.icons,brand.brandMetadata(theme).icons);assert.equal(meta.manifest,brand.brandManifestUrl(theme));const tree=await layout.default({children:'fixture'});assert.equal(tree.props.className,theme+'-theme');assert.equal(tree.props.children.props.children.props.initialTheme,theme);assert.equal(meta.applicationName,'羽林大会')}
 fixture.cookie=undefined;let meta=await layout.generateMetadata();assert.equal(meta.manifest,brand.brandManifestUrl('classic'));
 fixture.cookie='https://attacker.invalid/icon.png';meta=await layout.generateMetadata();assert.equal(meta.manifest,brand.brandManifestUrl('classic'));
 console.log('PASS installation metadata: actual server Apple/favicon/manifest match the selected theme before client hydration, same initial UI palette, invalid-cookie fallback');
}finally{delete globalThis.__installTest}
