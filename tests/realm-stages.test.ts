import {test} from 'node:test';
import assert from 'node:assert/strict';
import {realmStageRows} from '../lib/client/realm-stages';
import {realmProgress,realms} from '../lib/domain/realm-rating';

test('全部境界的十九个阶段与真实修为进度计算一致，边界没有空隙',()=>{
 const rows=realmStageRows();assert.deepEqual(rows.map(r=>r.realm),realms.map(r=>r.name));
 assert.equal(rows.reduce((sum,row)=>sum+row.stages.length,0),19);
 for(const [index,row] of rows.entries()){
  assert.deepEqual(row.stages.map(s=>s.stage),index===5?['初期','中期','后期','圆满']:['初期','中期','后期']);
  for(const stage of row.stages){
   const low=stage.from??-1000,high=stage.to===Infinity?2000:stage.to;
   for(let score=low;score<=high;score++)assert.equal(realmProgress(score,index).stage,stage.stage,row.realm+' '+score);
  }
  for(let i=1;i<row.stages.length;i++)assert.equal(row.stages[i].from,row.stages[i-1].to+1);
 }
 assert.deepEqual(rows[2].stages,[{stage:'初期',from:1000,to:1050},{stage:'中期',from:1051,to:1100},{stage:'后期',from:1101,to:1149}]);
});
