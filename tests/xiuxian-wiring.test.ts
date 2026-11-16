import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=(file:string)=>readFileSync(new URL('../app/'+file,import.meta.url),'utf8');

// 线上用的是私有版本的 app/layout.tsx（docs/PRIVATE_RELEASES.md），只挂在公共 layout 上的样式和组件不会上线。
test('水墨特效样式和点按灵气挂在主题容器上，线上的私有 layout 也能带上',()=>{
 const theme=source('visual-theme.tsx');
 assert.match(theme,/import '\.\/xiuxian-fx\.css'/);
 assert.match(theme,/import SpiritTouch from '\.\/spirit-touch'/);
 assert.match(theme,/<SpiritTouch\/>\{children\}/);
});

test('点按灵气被挂了两份时只有一份响应',()=>{
 const touch=source('spirit-touch.tsx');
 assert.match(touch,/if\(mounted\+\+\)return/);
});
