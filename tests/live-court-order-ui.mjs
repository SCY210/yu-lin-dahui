// Real live-play view with fictional data: courts keep their place whether they are playing or waiting.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/live-court-order-entry.ts',"export {default as LivePlay} from '../app/event-live-play';export {createSimulation} from '../lib/admin-simulation';export {apply} from '../lib/domain/commands';export {projectClubState} from '../lib/club-view';export {month} from '../lib/domain/types';");
await build({entryPoints:['.test-output/live-court-order-entry.ts'],outfile:'.test-output/live-court-order-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react','sonner'],loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},plugins:[{name:'guide-shell',setup(b){b.onResolve({filter:/(?:^|\/)feature-guide$/},()=>({path:'guide',namespace:'live-order'}));b.onLoad({filter:/.*/,namespace:'live-order'},()=>({contents:'export default function Guide(){return null}',loader:'js'}))}}]});
const {LivePlay,createSimulation,apply,projectClubState,month}=await import(pathToFileURL(resolve('.test-output/live-court-order-ui.mjs')).href);
const original={window:globalThis.window,document:globalThis.document},listeners=new Set(),surface={addEventListener:(n,f)=>listeners.add(f),removeEventListener:(n,f)=>listeners.delete(f)};
globalThis.window=surface;globalThis.document={...surface,hidden:false};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const minute=60000,now=Date.now(),s=createSimulation(now-30*minute).state,e=s.events[0],owner=s.accounts[0];
// Three courts, listed out of order; 10号场 sorts after 2号场.
const first=s.bookings.find(b=>b.eventId===e.id);
s.bookings=s.bookings.filter(b=>b.eventId!==e.id).concat(['10号场','2号场','1号场'].map((name,i)=>({...first,id:'court-'+i,name})));
await apply(s,owner,'liveStart',{eventId:e.id},now-20*minute);
const on=name=>s.matches.find(m=>m.status==='playing'&&s.bookings.find(b=>b.id===m.courtId).name===name);
assert.ok(on('1号场')&&on('2号场')&&on('10号场'),'every court starts');
// 1号场 finishes first, then 10号场: both wait for 开始组队 while 2号场 is still playing.
await apply(s,owner,'score',{matchId:on('1号场').id,a:21,b:18},now-5*minute);await apply(s,owner,'score',{matchId:on('10号场').id,a:21,b:16},now-4*minute);
const data=projectClubState(s,owner,month(now),new Date(now).getUTCFullYear(),now),ev=data.events.find(x=>x.id===e.id),sent=[];
const ctx={data,admin:true,busy:false,name:id=>data.players.find(p=>p.id===id)?.name??id,open(){},send:(...args)=>sent.push(args),setDanger(){},action:async()=>{},openProfile(){}};
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');let ui;
try{
 await act(async()=>{ui=renderer.create(React.createElement(LivePlay,{e:ev,ctx}))});
 const grid=ui.root.find(n=>typeof n.props.className==='string'&&n.props.className.includes('live-current-courts'));
 const cards=grid.children.filter(c=>typeof c!=='string').map(c=>text(c.children??[]));
 assert.equal(cards.length,3);
 assert.deepEqual(cards.map(t=>['1号场','2号场','10号场'].find(name=>t.includes(name)&&!(name==='1号场'&&t.includes('10号场')))),['1号场','2号场','10号场'],'courts stay in number order whether waiting or playing');
 assert.ok(cards[0].includes('等待下一局')&&cards[2].includes('等待下一局')&&!cards[1].includes('等待下一局'));
 assert.ok(text(ui.toJSON()).includes('再点“开始组队”安排下一局'),'the help text describes the button');
 const start=ui.root.findAllByType('button').find(b=>text(b.children)==='开始组队');await act(()=>start.props.onClick());
 assert.equal(sent.at(-1)[0],'liveNext');assert.equal(sent.at(-1)[1].courtId,s.bookings.find(b=>b.name==='1号场').id);
 const tiny=createSimulation(now).state;tiny.players=tiny.players.slice(0,4);tiny.accounts=tiny.accounts.slice(0,4);tiny.registrations=tiny.registrations.slice(0,4);tiny.bookings=tiny.bookings.slice(0,1);
 const tinyEvent=tiny.events[0],tinyOwner=tiny.accounts[0];await apply(tiny,tinyOwner,'liveStart',{eventId:tinyEvent.id},now);await apply(tiny,tinyOwner,'score',{matchId:tiny.matches[0].id,a:21,b:19},now+1);
 tinyEvent.livePlay.rest=tiny.players.map(p=>({playerId:p.id,venue:tinyEvent.venue,after:now,reason:'win-limit'}));
 const tinyData=projectClubState(tiny,tinyOwner,month(now),new Date(now).getUTCFullYear(),now+2);
 await act(()=>ui.update(React.createElement(LivePlay,{e:tinyData.events[0],ctx:{...ctx,data:tinyData}})));
 const continueButton=ui.root.findAllByType('button').find(b=>text(b.children)==='开始组队');assert.ok(continueButton);assert.equal(continueButton.props.disabled,false,'four available players are not blocked by the old win limit or same-lineup rule');
 assert.ok(!text(ui.toJSON()).includes('两连胜，轮休一局'));
 tinyEvent.livePlay.rest=tiny.players.slice(0,2).map(p=>({playerId:p.id,venue:tinyEvent.venue,after:now,reason:'two-wins'}));
 const forcedData=projectClubState(tiny,tinyOwner,month(now),new Date(now).getUTCFullYear(),now+2);
 await act(()=>ui.update(React.createElement(LivePlay,{e:forcedData.events[0],ctx:{...ctx,data:forcedData}})));
 assert.ok(!text(ui.toJSON()).includes('两连胜，轮休一局'));
 assert.ok(!ui.root.findAllByType('button').some(b=>text(b.children)==='休息好了'),'mandatory rest offers no early ready button');
 assert.equal(ui.root.findAllByType('button').find(b=>text(b.children)==='开始组队').props.disabled,true,'insufficient substitutes leave the court waiting');
 const bench=()=>ui.root.find(n=>n.type==='div'&&n.props.className==='rest');
 assert.ok(text(bench()).includes('场下球友 · 4 人'),'resting players remain counted as off court');
 assert.ok(!text(bench()).includes('轮休'),'off-court names have no rest labels');
 const profiles=bench().findAllByType('button').filter(b=>b.props.className==='group-player-profile');
 assert.equal(profiles.length,4,'all off-court avatars and profile links stay visible');
 for(const p of tiny.players){const chip=bench().find(n=>n.type==='div'&&typeof n.props.className==='string'&&n.props.className.startsWith('group-player ')&&text(n).includes(p.name));assert.ok(chip.findAllByType('button').some(b=>b.props.className==='group-player-swap'),'automatic two-win breaks do not prevent manual selection');assert.ok(!text(chip).includes('轮休'))}
 tinyEvent.livePlay.rest.push({playerId:tiny.players[2].id,venue:tinyEvent.venue,after:now});
 const voluntaryData=projectClubState(tiny,tinyOwner,month(now),new Date(now).getUTCFullYear(),now+2);
 await act(()=>ui.update(React.createElement(LivePlay,{e:voluntaryData.events[0],ctx:{...ctx,data:voluntaryData}})));
 assert.ok(text(bench()).includes('场下球友 · 4 人'));assert.ok(!text(bench()).includes('轮休'));
 assert.equal(bench().findAllByType('button').filter(b=>b.props.className==='group-player-swap').length,3,'voluntary rest remains protected while automatic rest allows manual swaps');
 console.log('PASS live court order UI: stable court order, next target, legacy compatibility, visible off-court totals and manual two-win override and protected voluntary rest');
}finally{if(ui)await act(()=>ui.unmount());globalThis.window=original.window;globalThis.document=original.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT}
