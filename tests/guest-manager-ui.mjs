// Real guest manager with fictional guests: likely duplicates, merge, edit, remove and duplicate signups.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/guest-manager-entry.ts',"export {default as GuestManager} from '../app/guest-manager';");
await build({entryPoints:['.test-output/guest-manager-entry.ts'],bundle:true,platform:'node',format:'esm',jsx:'automatic',outfile:'.test-output/guest-manager-ui.mjs',loader:{'.css':'empty'},external:['react','react/*','react-dom','react-dom/*','lucide-react','sonner']});
const {GuestManager}=await import(pathToFileURL(resolve('.test-output/guest-manager-ui.mjs')).href);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const day=86400000,start=Date.parse('2026-11-01T15:00:00Z');
const guest=(id,name,eventId,host,extra={})=>({id,name,guest:true,guestEventId:eventId,guestHost:host,guestHostId:host==='alice'?'p1':'p2',guestLevel:1000,guestGender:'female',enabled:true,...extra});
const data={events:[{id:'one',title:'周四双打',start},{id:'two',title:'周日双打',start:start+3*day}],
 players:[{id:'p1',name:'alice'},{id:'p2',name:'bob'},guest('g1','aq','one','alice'),guest('g2','aq','one','alice'),guest('g3','AQ 2','two','bob'),guest('g4','老王','two','bob',{guestHidden:true})],
 registrations:[{eventId:'one',playerId:'g1',status:'confirmed',sequence:3,bookingSignups:[{bookingId:'c1',status:'confirmed'}]},{eventId:'one',playerId:'g2',status:'confirmed',sequence:5,bookingSignups:[{bookingId:'c1',status:'confirmed'}]},{eventId:'two',playerId:'g3',status:'confirmed',sequence:1}]};
const opened=[],actions=[],ctx={data,busy:false,open:(...args)=>opened.push(args),action:async(...args)=>{actions.push(args)}};
const buttons=label=>ui.root.findAll(n=>n.type==='button'&&text(n.children).includes(label));
try{
 await act(()=>{ui=renderer.create(React.createElement(GuestManager,{ctx}))});
 const all=text(ui.toJSON());
 assert.match(all,/名单里的临时来宾 · 2 位/,'two aq records of alice are one friend; the removed friend is folded away');
 assert.equal((all.match(/可能重复/g)??[]).length,2,'aq and AQ 2 look alike');
 assert.match(all,/alice带来 · 女/);
 // Merge: pick both, choose the nickname and the host among their hosts.
 for(const box of ui.root.findAll(n=>n.type==='input'&&n.props.type==='checkbox'&&!n.props.disabled))await act(()=>box.props.onChange());
 await act(()=>buttons('合并所选')[0].props.onClick());
 const merge=opened.at(-1);assert.equal(merge[1],'guestFriendMerge');assert.deepEqual(merge[2].playerIds.sort(),['g2','g3']);
 assert.deepEqual(merge[3].find(f=>f.key==='hostPlayerId').options,[['p1','alice'],['p2','bob']]);
 // Edit and remove.
 await act(()=>buttons('修改')[0].props.onClick());assert.equal(opened.at(-1)[1],'guestFriendEdit');assert.throws(()=>opened.at(-1)[4]({...opened.at(-1)[2],gender:''}),/性别/);
 await act(()=>buttons('移出名单')[0].props.onClick());assert.equal(actions.at(-1)[0],'guestFriendHide');assert.equal(actions.at(-1)[1].hidden,true);
 await act(()=>buttons('恢复到名单')[0].props.onClick());assert.deepEqual(actions.at(-1).slice(0,2),['guestFriendHide',{playerId:'g4',hidden:false,reason:''}]);
 // The same friend twice in one activity: the first signup stays, the later one is cancelled court by court.
 assert.match(text(ui.toJSON()),/同一场活动里重复的接龙 · 1 处/);assert.match(text(ui.toJSON()),/第 3 位接龙 · alice带来 · 保留/);
 await act(async()=>{await buttons('取消这条接龙')[0].props.onClick()});
 assert.deepEqual(actions.at(-1).slice(0,2),['courtCancel',{bookingId:'c1',playerId:'g2',reason:'取消同场重复的临时来宾接龙'}]);
 console.log('PASS guest manager UI: grouped friends, likely duplicates, merge with host choice, edit, remove and restore, duplicate signups cancelled court by court');
}finally{if(ui)await act(()=>ui.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT}
