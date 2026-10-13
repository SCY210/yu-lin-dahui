import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {findPrivateMaterial,privateFingerprints} from '../scripts/check-shared-source.mjs';
const hash=(value:string)=>createHash('sha256').update(value.toLowerCase()).digest('hex');
const markers=new Set([hash('privatefixture'),hash('restrictedselector')]);

test('opaque policy rejects deployment-only paths and renamed implementations',()=>{
 assert.deepEqual(findPrivateMaterial([
  {file:'assets/private-fixture/image.webp',content:''},
  {file:'app/innocent.tsx',content:'const selector="restricted-selector"'},
  {file:'lib/config.ts',content:'const key="privateFixture"'},
 ],markers),['assets/private-fixture/image.webp','app/innocent.tsx','lib/config.ts']);
});
test('all tracked files are checked, including policy files, without exposing configured names',()=>{
 assert.deepEqual(findPrivateMaterial([{file:'app/ranking-view.tsx',content:'realm progress'},{file:'public/brand/classic-v3.svg',content:'shuttlecock'}],markers),[]);
 for(const file of ['scripts/check-shared-source.mjs','tests/shared-source.test.ts','.gitignore'])assert.deepEqual(findPrivateMaterial([{file,content:'private-fixture'}],markers),[file]);
 assert.ok(privateFingerprints.size>=8);assert.ok([...privateFingerprints].every(value=>/^[0-9a-f]{64}$/.test(value)));
});
