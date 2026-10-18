import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/fee-transfers-ui-entry.ts',"export {default as FeeTransfers} from '../app/fee-transfers';export {default as HomeUnpaid} from '../app/home-unpaid';export {default as CourtBookingsField} from '../app/court-bookings-field';export {default as CourtParts} from '../app/court-parts';");
await build({entryPoints:['.test-output/fee-transfers-ui-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/fee-transfers-ui.mjs',loader:{'.css':'empty'},external:['react','react/*','react-dom','react-dom/*','lucide-react','sonner']});
const {FeeTransfers,HomeUnpaid,CourtBookingsField,CourtParts}=await import(pathToFileURL(resolve('.test-output/fee-transfers-ui.mjs')).href);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const mount=async(Component,props)=>{if(ui)await act(()=>ui.unmount());await act(()=>{ui=renderer.create(React.createElement(Component,props))})};
const button=label=>ui.root.findAll(n=>n.type==='button'&&text(n.children).includes(label));
const names={p0:'群主',p1:'爱丽丝',p2:'小波',p3:'卡萝'};
const settlement={id:'v1',eventId:'e',version:1,created:1,confirmed:true,bills:[{playerId:'p0',total:840},{playerId:'p3',total:840}],advances:[{playerId:'p1',cents:2400},{playerId:'p2',cents:1200}],transfers:[{from:'p0',to:'p1',cents:720},{from:'p0',to:'p2',cents:120},{from:'p3',to:'p2',cents:240}]};
const e={id:'e',title:'虚构周四双打'},actions=[];
const ctx=(me,payments=[])=>({data:{me:{playerId:me},payments},name:id=>names[id]??id,busy:false,action:async(...args)=>{actions.push(args)}});
try{
 // The owner sees their two transfers first, can mark one, and sees the others folded away.
 await mount(FeeTransfers,{e,settlement,ctx:ctx('p0',[{eventId:'e',playerId:'p0',to:'p1',cents:720}]),manager:false});
 const all=text(ui.toJSON());assert.match(all,/已垫付：爱丽丝 €24\.00小波 €12\.00/);assert.match(all,/其他人的转账 · 1 笔 · 已转 0 笔/);
 assert.equal(button('撤销').length,1,'the marked transfer can be undone');
 await act(()=>button('标记已转')[0].props.onClick());
 assert.deepEqual(actions.pop(),['feeTransferPaid',{eventId:'e',settlementId:'v1',from:'p0',to:'p2',paid:true,reason:'标记已转账'},false]);
 // The receiver confirms receipt; someone else may not mark it.
 await mount(FeeTransfers,{e,settlement,ctx:ctx('p2'),manager:false});
 assert.equal(button('确认已收到').length,2);
 await mount(FeeTransfers,{e,settlement,ctx:ctx('p1'),manager:false});
 assert.equal(button('确认已收到').length,1,'Alice only for the transfer to her');assert.equal(button('标记已转').length,0);
 // A collector is named with their phone.
 await mount(FeeTransfers,{e:{...e,feeRecipient:{name:'卡萝',phone:'+34 600',playerId:'p3'}},settlement:{...settlement,collector:'p3'},ctx:ctx('p0'),manager:false});
 assert.match(text(ui.toJSON()),/收款人 卡萝（\+34 600）/);
 // Home: the open transfers of this member, marked together.
 const players=Object.entries(names).map(([id,name])=>({id,name,ownerId:id}));
 await mount(HomeUnpaid,{settlements:[settlement],payments:[{eventId:'e',playerId:'p0',to:'p1',cents:720}],players,me:{id:'owner',playerId:'p0'},events:[e],onOpen:()=>{},onMarkTransfers:list=>actions.push(['home',list])});
 assert.match(text(ui.toJSON()),/转给 小波 · €1\.20/);assert.doesNotMatch(text(ui.toJSON()),/转给 爱丽丝/,'a marked transfer disappears');
 await act(()=>button('标记已转')[0].props.onClick());assert.deepEqual(actions.pop(),['home',[{eventId:'e',settlementId:'v1',from:'p0',to:'p2'}]]);
 await mount(HomeUnpaid,{settlements:[settlement],payments:[],players,me:{id:'alice',playerId:'p1'},events:[e],onOpen:()=>{}});assert.equal(ui.toJSON(),null,'an advancer owes nothing');
 // Creation: a six-hour court booked in turn splits into two three-hour parts of the same court, shown to scale.
 let rows=[{name:'1号场',start:'2026-11-05T12:00',end:'2026-11-05T18:00',advancedBy:'p1'}];
 const members=[['p1','爱丽丝'],['p2','小波']],remount=()=>mount(CourtBookingsField,{rows,members,onChange:next=>{rows=next}});
 const pick=(label,value)=>act(()=>ui.root.find(n=>n.type==='select'&&n.props['aria-label']===label).props.onChange({target:{value}}));
 await remount();await act(()=>button('拆成两段')[0].props.onClick());
 assert.deepEqual(rows,[{name:'1号场',start:'2026-11-05T12:00',end:'2026-11-05T18:00',advancedBy:'p1',handovers:[{at:'2026-11-05T15:00',advancedBy:''}]}]);
 await remount();const bar=text(ui.root.find(n=>n.props.className==='court-parts-bar').children);
 assert.match(bar,/12:00–15:00爱丽丝15:00–18:00待选择/);assert.match(text(ui.toJSON()),/第 2 段15:00–18:00 · 3 小时/);
 await pick('场地 1 第 2 段 约场人','p2');assert.deepEqual(rows[0].handovers,[{at:'2026-11-05T15:00',advancedBy:'p2'}]);
 // Another split halves the longest part; deleting a part merges it into the one before.
 await remount();await act(()=>button('再拆一段')[0].props.onClick());assert.deepEqual(rows[0].handovers.map(h=>h.at),['2026-11-05T13:30','2026-11-05T15:00']);
 await remount();await act(()=>button('删除这一段')[0].props.onClick());assert.deepEqual(rows[0].handovers,[{at:'2026-11-05T15:00',advancedBy:'p2'}]);
 // Shortening the court drops a part that no longer fits.
 await remount();await act(()=>ui.root.find(n=>n.props.label==='场地 1 结束').props.onChange('2026-11-05T15:00'));assert.deepEqual(rows[0].handovers,[]);
 rows[0]={...rows[0],end:'2026-11-05T18:00',handovers:[{at:'2026-11-05T15:00',advancedBy:'p2'}]};
 await remount();await act(()=>button('添加另一片场地')[0].props.onClick());assert.deepEqual(rows[1],{name:'2号场',start:'2026-11-05T12:00',end:'2026-11-05T18:00',advancedBy:'',handovers:[]});
 await remount();await act(()=>button('删除这片场地')[1].props.onClick());assert.equal(rows.length,1);
 // The activity page's court settings use the same parts editor.
 let parts=[{start:'2026-11-05T12:00',advancedBy:'p1'},{start:'2026-11-05T15:00',advancedBy:'p2'}];
 await mount(CourtParts,{start:'2026-11-05T12:00',end:'2026-11-05T18:00',parts,members,label:'设置',onChange:next=>{parts=next}});
 await act(()=>ui.root.find(n=>n.props.label==='设置 第 2 段开始').props.onChange('2026-11-05T16:00'));assert.equal(parts[1].start,'2026-11-05T16:00','a later part can start at another time');
 await act(()=>ui.root.find(n=>n.props.label==='设置 第 2 段开始').props.onChange('2026-11-05T12:00'));assert.equal(parts[1].start,'2026-11-05T16:00','but not before the part it follows');
 console.log('PASS fee transfers UI: advances, own and folded transfers, payer/receiver marking, collector phone, home open transfers, court parts in creation and settings');
}finally{if(ui)await act(()=>ui.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT}
