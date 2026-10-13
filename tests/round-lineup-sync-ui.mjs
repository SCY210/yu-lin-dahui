import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
await build({entryPoints:['app/event-scheduling.tsx'],outfile:'.test-output/round-lineup-sync-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'round-sync-shell',setup(b){
 b.onResolve({filter:/^\.\//},a=>{
  if(!a.importer.replaceAll('\\','/').endsWith('/app/event-scheduling.tsx')||a.path==='./form-fields'||a.path.endsWith('.css'))return;
  return {path:a.path,namespace:'round-sync'};
 });
 b.onLoad({filter:/.*/,namespace:'round-sync'},a=>({loader:'js',contents:a.path==='./match-card'
  ?`import{createElement as h}from'react';export default function Match({m,selected,onSelect}){return h('div',{},[...m.a,...m.b].map(id=>h('button',{key:id,'data-player':id,'data-selected':selected===id,onClick:()=>onSelect(id)},id)))}`
  :a.path==='./group-player'?`import{createElement as h}from'react';export default function Player({id,selected,onSelect}){return h('button',{'data-player':id,'data-selected':selected===id,onClick:()=>onSelect(id)},id)}`
  :`export default function Shell({children}){return children??null}`}));
}}]});
const {EventRounds}=await import(pathToFileURL(resolve('.test-output/round-lineup-sync-ui.mjs')).href);
const old=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const now=Date.now(),e={id:'event',creatorId:'admin',title:'Fixture',status:'open',start:now+3600000,end:now+7200000,venue:'Venue',capacity:8,attendanceMode:'automatic'};
const match={id:'match',eventId:e.id,roundId:'round',courtId:'court',a:['p0','p1'],b:['p2','p3'],status:'published',start:null,games:[],scoreA:null,scoreB:null,locked:false};
const data={attendance:[],accounts:[],me:{id:'admin',role:'admin'},players:Array.from({length:6},(_,i)=>({id:'p'+i,enabled:true})),events:[e],bookings:[{id:'court',eventId:e.id,start:e.start,end:e.end,venue:e.venue}],registrations:Array.from({length:6},(_,i)=>({id:'reg'+i,eventId:e.id,playerId:'p'+i,status:'confirmed',arrival:e.start,departure:e.end})),rounds:[{id:'round',eventId:e.id,start:e.start,duration:15,status:'published',rest:['p4','p5'],eligible:['p0','p1','p2','p3','p4','p5']}],matches:[match]};
const writes=[],ctx={data,name:id=>id,admin:true,busy:false,open(){},setDanger(){},send:(...args)=>writes.push(args)};
const props=()=>({e,ctx,mode:'planned',now});
const click=async id=>act(()=>ui.root.findByProps({'data-player':id}).props.onClick());
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
try{
 await act(()=>{ui=create(React.createElement(EventRounds,props()))});await click('p0');assert.equal(ui.root.findByProps({'data-player':'p0'}).props['data-selected'],true);
 ctx.data={...data,matches:[{...match,a:['p4','p1']}]};await act(()=>ui.update(React.createElement(EventRounds,props())));
 assert.ok(text(ui.toJSON()).includes('本轮阵容已更新'));assert.ok(!ui.root.findAllByType('button').some(b=>b.props['data-selected']));
 await click('p2');assert.equal(writes.length,0,'the second click after a remote update starts a fresh selection rather than submitting the old one');
 await click('p1');assert.equal(writes.length,1);assert.equal(writes[0][1].p1,'p2');assert.deepEqual(writes[0][1].expectedLineup,[{id:'match',a:['p4','p1'],b:['p2','p3']}]);
 console.log('PASS published round sync UI: remote lineup invalidation, visible notice, cleared highlight and a fresh two-click snapshot');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=old}
