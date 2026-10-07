import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findPrivateMaterial} from '../scripts/check-shared-source.mjs';

test('共享源码检查拒绝私有素材路径及改名后的私有主题实现',()=>{
 assert.deepEqual(findPrivateMaterial([
  {file:'public/icons/aquarium-512.png',content:''},
  {file:'app/innocent.tsx',content:'const selector="aquarium-theme"'},
  {file:'lib/config.ts',content:'const key="yulin-queen-ui-theme"'},
 ]),['public/icons/aquarium-512.png','app/innocent.tsx','lib/config.ts']);
});
test('共享源码检查允许共享功能，但仅允许规则文件引用拒绝词',()=>{
 assert.deepEqual(findPrivateMaterial([
  {file:'app/ranking-view.tsx',content:'realm progress'},
  {file:'public/brand/classic-v3.svg',content:'shuttlecock'},
  {file:'scripts/check-shared-source.mjs',content:'aquarium'},
  {file:'.gitignore',content:'*aquarium*'},
 ]),[]);
 assert.deepEqual(findPrivateMaterial([{file:'scripts/export.mjs',content:'aquarium'}]),['scripts/export.mjs']);
});
