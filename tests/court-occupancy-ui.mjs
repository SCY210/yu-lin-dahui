import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/court-occupancy-entry.ts',"export {default as Occupancy,SignupOccupancy} from '../app/court-occupancy';export {default as Signup} from '../app/event-court-signup';export {createSimulation,simulationView} from '../lib/admin-simulation';");
await build({entryPoints:['.test-output/court-occupancy-entry.ts'],bundle:true,platform:'node',format:'esm',jsx:'automatic',outfile:'.test-output/court-occupancy-ui.mjs',external:['react','react/*','react-dom','react-dom/*','lucide-react','sonner'],loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},plugins:[{name:'guide-shell',setup(b){b.onResolve({filter:/(?:^|\/)feature-guide$/},()=>({path:'guide',namespace:'probe'}));b.onLoad({filter:/.*/,namespace:'probe'},()=>({contents:'export default function Guide(){return null}',loader:'js'}));}}]});
const {Occupancy,SignupOccupancy,Signup,createSimulation,simulationView}=await import(pathToFileURL(resolve('.test-output/court-occupancy-ui.mjs')).href);
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const prior={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT},surface={addEventListener(){},removeEventListener(){}};
globalThis.window=surface;globalThis.document=surface;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
try{
 const now=Date.parse('2030-11-05T11:00:00Z'),hour=3600000,doc=createSimulation(now),s=doc.state,e=s.events[0];e.start=now;e.end=now+4*hour;s.bookings.forEach(b=>{b.start=e.start;b.end=e.end});
 s.registrations=s.registrations.slice(0,4);s.registrations.forEach(r=>{r.arrival=now;r.departure=now+2*hour;r.registeredAt=now-hour;r.bookingSignups=[{bookingId:s.bookings[0].id,status:'confirmed',sequence:r.sequence,arrival:r.arrival,departure:r.departure,registeredAt:now-hour,joinedAsWaitlist:false,note:'',cancelRequested:false}]});
 const names=id=>s.players.find(p=>p.id===id)?.name??id,props={e,bookings:s.bookings,registrations:s.registrations,name:names};
 await act(()=>{ui=renderer.create(React.createElement(Occupancy,props))});
 assert.match(text(ui.toJSON()),/累计空档 6小时/);assert.match(text(ui.toJSON()),/14:00–16:00无人接龙 · 2小时/);
 const populated=ui.root.findAllByType('button').find(b=>b.props['aria-label'].includes('模拟 1 号场 12:00–14:00'));
 await act(()=>populated.props.onClick());assert.equal(populated.props['aria-pressed'],true);assert.match(text(ui.toJSON()),/模拟球友 01/);assert.match(text(ui.toJSON()),/4人 · 可开打/);
 // A live registration edit invalidates selection safely, without remounting or any write API.
 const updated=structuredClone(s.registrations);updated.forEach(r=>r.bookingSignups[0].departure=e.end);
 await act(()=>ui.update(React.createElement(Occupancy,{...props,registrations:updated})));
 assert.match(text(ui.toJSON()),/全程有人接龙/);assert.equal(ui.root.findAllByType('button').filter(b=>b.props['aria-pressed']).length,2);
 await act(()=>ui.unmount());ui=null;
 const data=simulationView(doc,now-hour).data;
 await act(()=>{ui=renderer.create(React.createElement(Signup,{e:data.events[0],ctx:{data,name:names,busy:false,open(){},openProfile(){}},rules:data.settings.rules}))});
 assert.equal(ui.root.findAll(n=>n.type==='section'&&n.props['aria-label']==='场地时间占用').length,0,'occupancy now sits at the bottom of the signup tab (app/event-view.tsx), after every signup section');
 await act(()=>ui.update(React.createElement(SignupOccupancy,{e:data.events[0],bookings:data.bookings,registrations:data.registrations,name:names})));
 assert.match(text(ui.toJSON()),/候补不计入，不代表实际对局/);
 // Use real server projections: being an admin or the club owner is not an exception.
 const signupCount=()=>ui.root.findAll(n=>n.type==='section'&&n.props['aria-label']==='场地时间占用').length;
 for(const [creator,viewer,visible]of [['other','admin',false],['other','member',false],['self','member',true],['missing','admin',false]]){
  const document=structuredClone(doc),account=document.state.accounts[0];account.role=viewer;
  document.state.events[0].creatorId=creator==='missing'?undefined:creator==='self'?account.id:'another-account';
  const projected=simulationView(document,now-hour).data;
  await act(()=>ui.update(React.createElement(SignupOccupancy,{e:projected.events[0],bookings:projected.bookings,registrations:projected.registrations,name:names})));
  assert.equal(signupCount(),Number(visible),creator+' / '+viewer);
  await act(()=>ui.update(React.createElement(Signup,{e:projected.events[0],ctx:{data:projected,name:names,busy:false,open(){},openProfile(){}},rules:projected.settings.rules})));
  assert.match(text(ui.toJSON()),/场地接龙/,'other members retain normal signups');
 }
 console.log('PASS court occupancy UI: real signup integration, per-court empty periods, accessible interactive rosters and updated signups');
}finally{if(ui)await act(()=>ui.unmount());globalThis.window=prior.window;globalThis.document=prior.document;globalThis.IS_REACT_ACT_ENVIRONMENT=prior.act}
