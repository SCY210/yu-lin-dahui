import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';

mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/participation-ui-entry.ts',"export {default as Participation} from '../app/points-participation';export {emptyState} from '../lib/domain/types';export {apply} from '../lib/domain/commands';");
await build({entryPoints:['.test-output/participation-ui-entry.ts'],outfile:'.test-output/participation-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*']});
const {Participation,emptyState,apply}=await import(pathToFileURL(resolve('.test-output/participation-ui.mjs')).href),prior={act:globalThis.IS_REACT_ACT_ENVIRONMENT,window:globalThis.window,document:globalThis.document},listeners=new Set(),surface={addEventListener:(name,listener)=>listeners.add(listener),removeEventListener:(name,listener)=>listeners.delete(listener)};globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=surface;globalThis.document=surface;
const now=Date.now(),s=emptyState(),member={id:'member',email:'',playerId:'p1',role:'member'},owner={id:'owner',email:'',playerId:'p0',role:'admin'};
s.accounts=[owner,member];s.events=[{id:'e',creatorId:'owner',title:'Fixture',start:now-60000,end:now+3600000,venue:'Hall',address:'',capacity:8,signupDeadline:now,cancelDeadline:now,note:'',status:'open',courtMode:'equal',ballMode:'equal'}];
s.players=Array.from({length:5},(_,i)=>({id:'p'+i,name:'横向名字'+i,ownerId:i===1||i===2?'member':'owner',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
s.registrations=s.players.map((p,i)=>({id:'reg'+i,eventId:'e',playerId:p.id,status:'confirmed',sequence:i,arrival:s.events[0].start,departure:s.events[0].end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
const data={...s,me:member},sent=[],ctx={data,busy:false,name:id=>s.players.find(p=>p.id===id)?.name??id,send:(...args)=>sent.push(args)};
let ui;const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const mount=async()=>{if(ui)await act(()=>ui.unmount());Object.assign(data,s);await act(async()=>{ui=renderer.create(React.createElement(Participation,{e:s.events[0],ctx}))})};
const buttons=()=>ui.root.findAllByType('button');
try{
 await mount();assert.equal(buttons().length,2,'member can change self and their proxy only');assert.ok(buttons().every(b=>text(b)==='不再上场'));
 await act(()=>buttons()[0].props.onClick());assert.deepEqual(sent.at(-1),['pointsParticipation',{eventId:'e',playerId:'p1',playing:false}]);
 await apply(s,member,...sent.at(-1),now);await mount();assert.ok(text(ui.toJSON()).includes('本次不再上场'));assert.ok(buttons().some(b=>text(b)==='恢复排场'));
 s.matches.push({id:'pending',eventId:'e',roundId:'round',courtId:'court',a:['p1','p2'],b:['p3','p4'],status:'published',start:null,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]});
 await mount();const warning=ui.root.findByProps({role:'status'});assert.ok(text(warning).includes('横向名字1'));assert.ok(text(warning).includes('1 场预排'));assert.ok(text(warning).includes('调整阵容或重新预排'));assert.ok(text(warning).includes('不会自动判负'));
 s.matches[0].status='playing';s.matches[0].start=now;await mount();assert.ok(text(ui.toJSON()).includes('本局正常结束后生效'));assert.equal(ui.root.findAllByProps({role:'status'}).length,0,'already running match is not blocked');
 data.me=owner;await mount();assert.equal(buttons().length,5,'manager can control whole roster');ctx.busy=true;await mount();assert.ok(buttons().every(b=>b.props.disabled));ctx.busy=false;
 s.events[0].status='ended';await mount();assert.equal(buttons().length,0);assert.ok(text(ui.toJSON()).includes('本次不再上场'),'completed history preserves stop marker');
 console.log('PASS participation UI: self/proxy ownership, manager controls, persisted stop/resume display, running-game explanation, actionable blocked pending lineup and completed history');
}finally{if(ui)await act(()=>ui.unmount());assert.equal(listeners.size,0);Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:prior.act,window:prior.window,document:prior.document})}
