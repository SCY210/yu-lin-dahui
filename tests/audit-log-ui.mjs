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
 accounts:[{id:'a1',playerId:'p1',email:'host'}],players:[{id:'p1',name:'Fictional organiser'}],
 audits:[{id:'x1',at,actor:'a1',action:'bookingClaim',reason:'认领约场时段',changes:{eventId:'e'}},{id:'x2',at:at+60000,actor:'system:points-clock',action:'pointsStart',reason:'到点自动开赛'},{id:'x3',at:at+120000,actor:'old',action:'unknownAction',reason:'旧记录'}],
};
try{
 await act(()=>{ui=renderer.create(React.createElement(AuditLog,{data,labels:{bookingClaim:'认领 / 纠正约场时段'}}))});
 const lines=ui.root.findAllByType('summary').map(s=>text(s.children));
 assert.equal(lines.length,3);
 assert.ok(lines[2].includes(' · Fictional organiser · 认领 / 纠正约场时段 · 认领约场时段'),lines[2]);
 assert.ok(lines[1].includes(' · 系统自动 · 其他操作 · 到点自动开赛'),lines[1]);
 assert.ok(lines[0].includes(' · 已删除的账号 · 其他操作 · 旧记录'),'newest first, and a removed account is still shown: '+lines[0]);
 assert.equal(ui.root.findAll(n=>n.props.className==='audit-actor').length,3);
 console.log('PASS audit log UI: every line names who acted (player, system or removed account), newest first, with the action label and reason');
}finally{if(ui)await act(()=>ui.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT}
