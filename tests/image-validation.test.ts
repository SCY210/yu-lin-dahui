import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateImage} from '../lib/image-validation';

test('正常透明PNG能通过结构与像素校验',()=>{
 const png=new Uint8Array(readFileSync('tests/fixtures/shuttlecock.png'));const result=validateImage(png,'image/png');assert.equal(result.type,'image/png');assert.ok(result.width>0&&result.height>0);assert.ok(result.width*result.height<=50_000_000);
});
test('四字节伪PNG、HTML/SVG、声明格式与真实结构不一致均被拒绝',()=>{
 const fake=new Uint8Array([137,80,78,71,...new TextEncoder().encode('<script>alert(1)</script>')]);
 assert.throws(()=>validateImage(fake,'image/png'),/格式无效/);
 const svg=new TextEncoder().encode('<svg onload="alert(1)"></svg>');assert.throws(()=>validateImage(svg,'image/svg+xml'),/格式无效/);
 const png=new Uint8Array(readFileSync('tests/fixtures/shuttlecock.png'));assert.throws(()=>validateImage(png,'image/jpeg'),/格式无效/);assert.throws(()=>validateImage(png,'image/webp'),/格式无效/);
});
test('小文件宣称极端尺寸时不执行图像解码并拒绝超大像素',()=>{
 const png=new Uint8Array(readFileSync('tests/fixtures/shuttlecock.png'));
 const view=new DataView(png.buffer);view.setUint32(16,12001);assert.throws(()=>validateImage(png,'image/png'),/尺寸过大/);
 view.setUint32(16,10000);view.setUint32(20,10000);assert.throws(()=>validateImage(png,'image/png'),/尺寸过大/);
});
