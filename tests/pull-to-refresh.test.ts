import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pullBlocked,pullMax,pullProgress,pullThreshold} from '../lib/client/pull-to-refresh';

test('下拉距离减半并封顶，超过门槛才算松开刷新；往上推不算',()=>{
 assert.deepEqual(pullProgress(-30),{distance:0,ready:false});
 assert.deepEqual(pullProgress(100),{distance:50,ready:false});
 assert.equal(pullProgress(pullThreshold*2).ready,true);
 assert.equal(pullProgress(1000).distance,pullMax);
});

test('弹窗里、标记不下拉的区域和已经往下滚动的内部区域不触发下拉刷新',()=>{
 type Box={scrollTop:number;parentElement:Box|null;closest:()=>unknown};
 const box=(scrollTop:number,parent:Box|null=null,blocked=false):Box=>({scrollTop,parentElement:parent,closest:()=>blocked?{}:null});
 const scrollable=()=>true;
 assert.equal(pullBlocked(box(0,box(0)),scrollable),false);
 assert.equal(pullBlocked(box(0,box(120)),scrollable),true,'an inner list scrolled down keeps its own scroll');
 assert.equal(pullBlocked(box(0,null,true),scrollable),true,'dialogs never refresh the page');
 assert.equal(pullBlocked(box(0,box(120)),()=>false),false,'a non-scrollable ancestor does not block');
 assert.equal(pullBlocked(null,scrollable),false);
});
