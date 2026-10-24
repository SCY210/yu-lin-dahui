// Real React components with fictional activities; never contacts production.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/home-arrival-entry.ts',"export {default as HomeArrival} from '../app/home-arrival';export {default as PointsMatchBadge} from '../app/points-match-badge';");
await build({entryPoints:['.test-output/home-arrival-entry.ts'],outfile:'.test-output/home-arrival-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'}});
const {HomeArrival,PointsMatchBadge}=await import(pathToFileURL(resolve('.test-output/home-arrival-ui.mjs')).href);
const prior=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=node=>typeof node==='string'?node:(Array.isArray(node)?node:node?.children??[]).map(text).join('');
const mount=async(Component,props)=>{if(ui)await act(()=>ui.unmount());await act(async()=>{ui=renderer.create(React.createElement(Component,props))})};
try{
 const now=Date.parse('2026-10-25T17:00:00Z'),hour=3600000,sent=[],opened=[];
 const event={id:'e',title:'Fictional doubles',start:now-hour,end:now+hour,status:'open',pointsSession:{attendance:[{playerId:'me',late:true,available:false,at:now-60000},{playerId:'friend',late:true,available:false,at:now-30000}],waiting:[]}};
 const props={events:[event],players:[{id:'me',ownerId:'alice',name:'Fictional Alice'},{id:'friend',ownerId:'alice',name:'Fictional Friend'}],me:{id:'alice',playerId:'me'},now,onArrive:(...args)=>sent.push(args),onOpen:id=>opened.push(id)};
 await mount(HomeArrival,props);const shown=text(ui.toJSON());
 assert.ok(shown.includes('你还没确认到场，暂时不会排你上场')&&shown.includes('被报告迟到'));
 const buttons=ui.root.findAllByType('button');
 await act(()=>buttons.find(b=>text(b).includes('我已到场')).props.onClick());
 assert.deepEqual(sent.at(-1),['pointsPresence',{eventId:'e',playerId:'me',status:'arrived'}]);
 await act(()=>buttons.find(b=>text(b).includes('Fictional Friend 已到场')).props.onClick());assert.equal(sent.at(-1)[1].playerId,'friend');
 await act(()=>buttons[0].props.onClick());assert.equal(opened.at(-1),'e');
 await act(async()=>ui.update(React.createElement(HomeArrival,{...props,now:event.end})));assert.equal(ui.toJSON(),null,'nothing after the activity ends');
 await act(async()=>ui.update(React.createElement(HomeArrival,{...props,me:{id:'bob',playerId:'bob'}})));assert.equal(ui.toJSON(),null,'other members see nothing');
 await mount(PointsMatchBadge,{e:{matchFormat:'doubles'}});assert.ok(text(ui.toJSON()).includes('积分赛'));assert.ok(ui.root.findAllByType('svg').length===1,'the badge carries its own mark');
 for(const e of [{matchFormat:'doubles',ranked:false},{matchFormat:'practice'}]){await mount(PointsMatchBadge,{e});assert.equal(ui.toJSON(),null,JSON.stringify(e))}
 assert.match(readFileSync('app/points-match-badge.css','utf8'),/html\.wuxia-theme \.badge\.points-match-badge/,'the badge keeps its look in the ink theme');
 console.log('PASS home arrival and points badge UI: own and proxy holds, resume commands, navigation, hidden after the end and for others, badge only on ranked activities');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=prior}
