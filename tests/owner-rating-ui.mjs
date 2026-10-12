import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
await build({entryPoints:['app/owner-points.tsx'],outfile:'.test-output/owner-rating-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'owner-rating-shell',setup(b){
 b.onResolve({filter:/^\.\/disclosure$/},()=>({path:'disclosure',namespace:'rating-ui'}));
 b.onLoad({filter:/.*/,namespace:'rating-ui'},()=>({loader:'js',contents:"import{createElement as h}from'react';export default function Disclosure({label,children}){return h('details',{},h('summary',{},label),children)}"}));
}}]});
const Panel=(await import(pathToFileURL(resolve('.test-output/owner-rating-ui.mjs')).href)).default;
const prior=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const at=Date.UTC(2026,9,12),players=[{id:'owner',name:'Owner',enabled:true,rating:999,realmScore:{score:1000}},{id:'member',name:'Member',enabled:true,rating:1050},{id:'disabled',name:'Disabled',enabled:false},{id:'guest',name:'Guest',enabled:true,guest:true},{id:'event-guest',name:'Event guest',enabled:true,guestEventId:'event'}];
const pointGrants=[{id:'rating',playerId:'member',period:'2026-10',points:0,rating:100,reason:'Manual rating',at},{id:'points',playerId:'member',period:'2026-10',points:10,rating:0,reason:'Points only',at:at-1},{id:'mixed',playerId:'member',period:'2026-10',points:5,rating:-20,reason:'Mixed correction',at:at-2}];
const calls=[],open=(...args)=>calls.push(args),text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const mount=async(isOwner=true,busy=false,list=players)=>{if(ui)await act(()=>ui.unmount());await act(()=>{ui=create(React.createElement(Panel,{data:{me:{isOwner,role:'admin'},players:list,pointGrants,social:{stats:[{playerId:'owner',realmScore:{score:1000}},{playerId:'member',realmScore:{score:1050}}]}},open,busy}))})};
try{
 await mount();assert.ok(text(ui.toJSON()).includes('手动提升修为'));
 const button=ui.root.findAllByType('button').find(b=>text(b)==='提升修为');assert.ok(button&&!button.props.disabled);await act(()=>button.props.onClick());
 const [title,action,values,fields,convert]=calls[0];assert.equal(title,'手动提升修为');assert.equal(action,'grantPoints');assert.equal(values.points,0);assert.equal(values.rating,100);
 assert.deepEqual(fields.find(f=>f.key==='playerId').options.map(([id])=>id),['owner','member']);assert.ok(fields[0].options[0][1].includes('当前修为 1000'),'the selector uses visible settled rating');
 const amount=fields.find(f=>f.key==='rating');assert.equal(amount.min,1);assert.equal(amount.max,300);assert.equal(amount.step,1);
 const payload=convert({playerId:'member',rating:'80',points:999,period:'1999-01'});assert.equal(payload.rating,80);assert.equal(payload.points,0);assert.match(payload.period,/^20\d{2}-\d{2}$/);
 assert.ok(text(ui.toJSON()).includes('修为调整记录 · 2'));const pointHistory=ui.root.findByProps({'aria-label':'手动积分调整记录'});assert.ok(!text(pointHistory).includes('Manual rating'));assert.ok(text(pointHistory).includes('Points only'));
 await mount(false);assert.equal(ui.toJSON(),null,'ordinary administrators have no owner rating controls');
 await mount(true,true);assert.ok(ui.root.findAllByType('button').every(b=>b.props.disabled));
 await mount(true,false,players.filter(p=>!p.enabled||p.guest||p.guestEventId));assert.ok(ui.root.findAllByType('button').every(b=>b.props.disabled),'no eligible member means no grant action');
 console.log('PASS owner rating UI: visible owner-only entry, current score, permanent enabled players, rating-only payload, bounded increase, compact history and busy state');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=prior}
