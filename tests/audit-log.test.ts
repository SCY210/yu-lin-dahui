import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditLogPage,auditWeek,auditPageSize} from '../lib/audit-log';
import {emptyState,type Audit,type Event} from '../lib/domain/types';

const now=Date.parse('2026-11-08T12:00:00Z');
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 const owner={id:'owner',playerId:'p1',email:'',role:'admin' as const},admin={...owner,id:'admin',playerId:'p2'};
 s.accounts=[owner,admin];return {s,owner,admin};
}
const row=(id:string,at:number):Audit=>({id,at,actor:'owner',action:'fixture',reason:'测试操作'});

test('最近七天按实际时间筛选，超过五十条仍可完整翻页且不修改历史',()=>{
 const {s,owner}=fixture();
 s.audits=Array.from({length:121},(_,i)=>row('row-'+String(i).padStart(3,'0'),now-i*1000));
 s.audits.push(row('old',now-auditWeek-1),row('edge',now-auditWeek),row('future',now+1));s.audits.reverse();
 const before=structuredClone(s),ids:string[]=[];let cursor:string|null=null;
 do{
  const page=auditLogPage(s,owner,now,cursor);assert.ok(page.audits.length<=auditPageSize);
  ids.push(...page.audits.map(a=>a.id));cursor=page.nextCursor;
 }while(cursor);
 assert.equal(ids.length,122);assert.equal(new Set(ids).size,122);assert.equal(ids[0],'row-000');assert.equal(ids.at(-1),'edge');assert.deepEqual(s,before);
});

test('相同时间以标识稳定翻页，新写入的日志不影响已打开的快照',()=>{
 const {s,owner}=fixture();s.audits=Array.from({length:65},(_,i)=>row('row-'+String(i).padStart(3,'0'),now));
 const first=auditLogPage(s,owner,now);assert.ok(first.nextCursor);
 s.audits.push(row('new',now+1000));
 const second=auditLogPage(s,owner,now+2000,first.nextCursor);
 assert.equal(second.audits.length,15);assert.ok(!second.audits.some(a=>a.id==='new'));
 assert.equal(new Set([...first.audits,...second.audits].map(a=>a.id)).size,65);
});

test('翻页参数不能查询一周以前或未来的日志',()=>{
 const {s,owner}=fixture();s.audits=[row('old',now-auditWeek-1)];
 for(const input of ['','{','x'.repeat(1025),JSON.stringify({at:now,id:'x',end:now+1}),JSON.stringify({at:now,id:'x',end:now-1}),JSON.stringify({at:now-auditWeek-2,id:'x',end:now-auditWeek-1})])assert.throws(()=>auditLogPage(s,owner,now,input));
 const forged=auditLogPage(s,owner,now,JSON.stringify({at:now-auditWeek-1,id:'x',end:now}));assert.deepEqual(forged.audits,[]);
});

test('日志沿用已删除活动和宝阁隐私，屏蔽词处理及管理员权限',()=>{
 const {s,owner,admin}=fixture();
 s.events=[{id:'deleted',creatorId:'owner',title:'已删除的活动',deletedAt:1} as Event];
 s.audits=[row('visible',now),{...row('private',now),changes:{eventId:'deleted'}},{...row('treasure',now),action:'treasureGrant',changes:{playerId:'p1'}}];
 s.settings.blockedWords=['测试操作'];
 const page=auditLogPage(s,admin,now);assert.deepEqual(page.audits.map(a=>a.id),['visible']);assert.equal(page.audits[0].reason,'****');
 assert.equal(auditLogPage(s,owner,now).audits.length,3);
 assert.throws(()=>auditLogPage(s,{...admin,role:'member'},now),/仅宗主或副宗主/);
});
