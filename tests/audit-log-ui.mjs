import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/audit-log-ui-entry.ts',"export {default as AuditLog} from '../app/audit-log';");
await build({entryPoints:['.test-output/audit-log-ui-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/audit-log-ui.mjs',loader:{'.css':'empty'},alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react']});
const {AuditLog}=await import(pathToFileURL(resolve('.test-output/audit-log-ui.mjs')).href);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const at=Date.UTC(2026,10,6,4);
const data={
 me:{id:'a1'},
 accounts:[{id:'a1',playerId:'p1',email:'host'}],players:[{id:'p1',name:'Fictional organiser'}],
 audits:[{id:'x1',at,actor:'a1',action:'bookingClaim',reason:'认领约场时段',changes:{eventId:'e'}},{id:'x2',at:at+60000,actor:'system:points-clock',action:'pointsStart',reason:'到点自动开赛'},{id:'x3',at:at+120000,actor:'old',action:'unknownAction',reason:'旧记录'}],
};
const originalFetch=globalThis.fetch,requests=[],replies=[];
const page=(audits,nextCursor=null)=>({accountId:'a1',from:at-7*86400000,to:at+120000,audits,nextCursor});
globalThis.fetch=async(url,options)=>{requests.push({url,options});const reply=replies.shift();assert.ok(reply,'unexpected audit request');return new Response(JSON.stringify(reply.body),{status:reply.status??200})};
replies.push({body:page(data.audits.slice().reverse())});
try{
 const labels={bookingClaim:'认领 / 纠正约场时段'};
 await act(async()=>{ui=renderer.create(React.createElement(AuditLog,{data,labels}))});
 const lines=ui.root.findAllByType('summary').map(s=>text(s.children));
 assert.equal(lines.length,3);
 assert.ok(lines[2].includes(' · Fictional organiser · 认领 / 纠正约场时段 · 认领约场时段'),lines[2]);
 assert.ok(lines[1].includes(' · 系统自动 · 其他操作 · 到点自动开赛'),lines[1]);
 assert.ok(lines[0].includes(' · 已删除的账号 · 其他操作 · 旧记录'),'newest first, and a removed account is still shown: '+lines[0]);
 assert.equal(ui.root.findAll(n=>n.props.className==='audit-actor').length,3);
 assert.equal(requests.length,1);assert.equal(requests[0].options.cache,'no-store');
 await act(async()=>ui.update(React.createElement(AuditLog,{data:{...data,audits:[]},labels})));
 assert.equal(requests.length,1,'regular club polling must not download weekly history again');
 const click=async(label)=>act(async()=>ui.root.findAllByType('button').find(b=>text(b.children)===label).props.onClick());
 const fifty=Array.from({length:50},(_,i)=>({...data.audits[0],id:'page-'+i,at:at-i}));
 replies.push({body:page(fifty,'next-page')});await click('刷新日志');
 assert.equal(ui.root.findAllByType('summary').length,50);
 replies.push({body:page([{...fifty[49],id:'page-50',at:at-50}])});await click('加载更早日志');
 assert.equal(new URL(requests.at(-1).url,'https://example.invalid').searchParams.get('cursor'),'next-page');
 assert.equal(ui.root.findAllByType('summary').length,51,'the interface no longer truncates history at fifty');
 replies.push({status:403,body:{error:'仅宗主或副宗主可以查看操作日志'}});await click('刷新日志');
 assert.equal(ui.root.findAllByType('summary').length,0,'lost access clears already loaded history');
 assert.match(text(ui.root.findByProps({role:'alert'}).children),/仅宗主或副宗主/);
 replies.push({body:page([])});await click('刷新日志');assert.match(text(ui.toJSON()),/最近 7 天暂无操作日志/);
 let finish;globalThis.fetch=(url,options)=>{requests.push({url,options});return new Promise(resolve=>finish=resolve)};
 await click('刷新日志');const pending=requests.at(-1);
 await act(()=>ui.unmount());ui=null;assert.ok(pending.options.signal.aborted);
 await act(async()=>finish(new Response(JSON.stringify(page(data.audits)))));
 const pendingAccounts=[];globalThis.fetch=(url,options)=>new Promise(resolve=>pendingAccounts.push({resolve,signal:options.signal}));
 await act(async()=>{ui=renderer.create(React.createElement(AuditLog,{data,labels}))});
 await act(async()=>ui.update(React.createElement(AuditLog,{data:{...data,me:{id:'a2'}},labels})));
 assert.ok(pendingAccounts[0].signal.aborted);
 await act(async()=>pendingAccounts[1].resolve(new Response(JSON.stringify({...page([]),accountId:'a2'}))));
 await act(async()=>pendingAccounts[0].resolve(new Response(JSON.stringify(page(data.audits)))));
 assert.equal(ui.root.findAllByType('summary').length,0,'late responses from another account cannot restore its audit rows');
 console.log('PASS audit log UI: actor names, newest-first weekly pages beyond fifty, explicit refresh, no repeated polling fetch, permission loss, empty state and cancelled unmount request');
}finally{if(ui)await act(()=>ui.unmount());globalThis.fetch=originalFetch;delete globalThis.IS_REACT_ACT_ENVIRONMENT}
