import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
mkdirSync('.test-output',{recursive:true});
const workspace=process.cwd();
const mock={name:'isolated-theme-auth',setup(b){b.onResolve({filter:/(auth|store)$/},args=>{
 const file=path.resolve(args.resolveDir,args.path)+'.ts';
 if(file===path.join(workspace,'lib/auth.ts'))return {path:'auth',namespace:'queen-test'};
 if(file===path.join(workspace,'lib/store.ts'))return {path:'store',namespace:'queen-test'};
 });b.onLoad({filter:/.*/,namespace:'queen-test'},args=>({loader:'js',contents:args.path==='auth'?'export async function getAppUser(){return globalThis.__queenUser??null}':'export function raw(){return {prepare(sql){return {bind(id){return {sql,id}}}},async batch(qs){return qs.map(q=>({results:q.sql.includes("FROM settings")?[{payload:JSON.stringify({ownerAccountId:globalThis.__queenOwnerId})}]:globalThis.__queenAccount?.id===q.id?[globalThis.__queenAccount]:[]}))}}}'}))}};
for(const kind of ['css','art'])await build({entryPoints:[kind==='css'?'app/api/theme/aquarium/route.ts':'app/api/theme/aquarium/art/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/queen-'+kind+'.mjs',plugins:[mock]});
const css=await import('../.test-output/queen-css.mjs'),art=await import('../.test-output/queen-art.mjs');
const queen={id:'account:2decd719-99de-4679-9f4d-897f39f818ce',playerId:'ca023b58-7c95-4fa0-89f8-6a85f27ed1dd'};
const request=new Request('https://example.invalid/api/theme/aquarium/art?kind=hero');
globalThis.__queenOwnerId='owner';
for(const [user,account,expected] of [
 [null,null,401],
 [{userId:'owner'},{id:'owner',playerId:'owner-player',name:'羽林平抽女王',role:'admin'},200],
 [{userId:'member'},{id:'member',playerId:queen.playerId},403],
 [{userId:'other-admin'},{id:'other-admin',playerId:'other-player',role:'admin'},403],
 [{userId:'owner'},{id:'owner',playerId:'owner-player',role:'member'},403],
 [{userId:queen.id},{...queen,playerId:'different-player'},403],
 [{userId:queen.id},null,403],
 [{userId:queen.id},queen,200],
]){
 globalThis.__queenUser=user;globalThis.__queenAccount=account;
 const sheet=await css.GET(),image=await art.GET(request);assert.equal(sheet.status,expected);assert.equal(image.status,expected);
 assert.match(sheet.headers.get('cache-control'),/no-store/);assert.match(image.headers.get('cache-control'),/no-store/);
 if(expected===200){assert.match(await sheet.text(),/html\.aquarium-theme/);assert.equal(image.headers.get('content-type'),'image/webp');assert.equal(new TextDecoder().decode((await image.arrayBuffer()).slice(0,4)),'RIFF')}
 else{assert.doesNotMatch(await sheet.text(),/--background/);assert.doesNotMatch(image.headers.get('content-type')??'',/image/)}
}
assert.equal((await art.GET(new Request('https://example.invalid/api/theme/aquarium/art?kind=__proto__'))).status,404);
console.log('PASS exclusive aquarium: anonymous, other administrators, renamed player, mismatched IDs and missing account denied; bound queen and persisted owner receive CSS/art with private no-store; invalid asset rejected');
