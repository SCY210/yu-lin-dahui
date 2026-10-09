// Real home card rendering and navigation with isolated fictional data.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
await build({entryPoints:['app/home-live-matches.tsx'],outfile:'.test-output/home-live-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*'],loader:{'.css':'empty'}});
const {default:HomeLiveMatches}=await import(pathToFileURL(resolve('.test-output/home-live-ui.mjs')).href);
const original={document:globalThis.document,window:globalThis.window,act:globalThis.IS_REACT_ACT_ENVIRONMENT};const listeners=new Map();
const surface={addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:event=>listeners.delete(event)};globalThis.document=surface;globalThis.window=surface;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const now=Date.now(),event={id:'event',title:'Fictional active singles',matchFormat:'singles',start:now-60000,end:now+3600000,venue:'Fixture venue',status:'open'},round={id:'round',eventId:event.id,status:'playing',liveSequence:2},match={id:'match',eventId:event.id,roundId:round.id,courtId:'court',a:['a'],b:['b'],status:'playing',start:now-1000};
const data={events:[event],rounds:[round],matches:[match],bookings:[{id:'court',eventId:event.id,name:'Court 2'}],players:[{id:'a',name:'Fictional member A'},{id:'b',name:'Fictional member B'}]};let renderer;const opened=[];
try{
 await act(async()=>{renderer=create(React.createElement(HomeLiveMatches,{data,onOpen:id=>opened.push(id)}))});
 assert.equal(renderer.root.findAllByType('button').length,1);assert.equal(renderer.root.findAllByType('img').length,2);assert.ok(renderer.root.findAllByType('img').every(img=>img.props.src==='/default-avatar.svg'));
 const card=renderer.root.findByType('button');assert.match(card.props['aria-label'],/Fictional member A对阵Fictional member B/);await act(async()=>card.props.onClick());assert.deepEqual(opened,['event']);
 await act(async()=>renderer.update(React.createElement(HomeLiveMatches,{data:{...data,matches:[{...match,status:'complete'}]},onOpen:id=>opened.push(id)})));assert.equal(renderer.toJSON(),null,'Last completed game removes the whole region');
 await act(async()=>renderer.update(React.createElement(HomeLiveMatches,{data:{...data,events:[{...event,deletedAt:0}]},onOpen:id=>opened.push(id)})));assert.equal(renderer.toJSON(),null);
 await act(async()=>renderer.update(React.createElement(HomeLiveMatches,{data:{...data,events:[{...event,end:now-1}]},onOpen:id=>opened.push(id)})));assert.equal(renderer.toJSON(),null,'Clock boundary hides unscored stale games');
 await act(async()=>renderer.unmount());renderer=null;assert.equal(listeners.size,0);
 console.log('PASS home live cards: actual singles names and avatars, event navigation, empty/completed/deleted/ended hiding and listener cleanup');
}finally{if(renderer)await act(async()=>renderer.unmount());globalThis.document=original.document;globalThis.window=original.window;globalThis.IS_REACT_ACT_ENVIRONMENT=original.act}
